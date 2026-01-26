import "server-only";
import { createHash } from "crypto";
import { importJWK, jwtVerify, decodeProtectedHeader } from "jose";
import { plaidClient } from "./plaid";

// Cache for public keys (Plaid recommends caching these)
const keyCache = new Map<string, { key: CryptoKey; expiresAt: number }>();
const KEY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Verify a Plaid webhook request signature.
 *
 * @param body - The raw request body as a string
 * @param plaidVerificationHeader - The Plaid-Verification header value (JWT)
 * @returns true if verification succeeds
 * @throws Error if verification fails
 */
export async function verifyPlaidWebhook(
  body: string,
  plaidVerificationHeader: string | null
): Promise<boolean> {
  if (!plaidVerificationHeader) {
    throw new Error("Missing Plaid-Verification header");
  }

  // 1. Decode the JWT header to get the key ID
  const header = decodeProtectedHeader(plaidVerificationHeader);
  const keyId = header.kid;

  if (!keyId) {
    throw new Error("No key ID (kid) in JWT header");
  }

  // 2. Get the public key from Plaid (with caching)
  const publicKey = await getPlaidPublicKey(keyId);

  // 3. Verify the JWT signature and get the payload
  const { payload } = await jwtVerify(plaidVerificationHeader, publicKey, {
    algorithms: ["ES256"],
    // Plaid JWTs have a 5-minute expiration
    maxTokenAge: "5 minutes",
  });

  // 4. Verify the request body hash
  const expectedBodyHash = payload.request_body_sha256 as string;
  if (!expectedBodyHash) {
    throw new Error("No request_body_sha256 in JWT payload");
  }

  const actualBodyHash = createHash("sha256").update(body).digest("hex");

  if (actualBodyHash !== expectedBodyHash) {
    throw new Error("Request body hash mismatch");
  }

  return true;
}

/**
 * Fetch and cache a public key from Plaid.
 */
async function getPlaidPublicKey(keyId: string): Promise<CryptoKey> {
  // Check cache first
  const cached = keyCache.get(keyId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  // Fetch from Plaid
  const response = await plaidClient.webhookVerificationKeyGet({
    key_id: keyId,
  });

  const jwk = response.data.key;

  // Convert JWK to CryptoKey
  const publicKey = await importJWK(
    {
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      y: jwk.y,
    },
    "ES256"
  );

  // Cache the key
  keyCache.set(keyId, {
    key: publicKey as CryptoKey,
    expiresAt: Date.now() + KEY_CACHE_TTL_MS,
  });

  return publicKey as CryptoKey;
}

/**
 * Check if webhook verification is enabled.
 * In development/sandbox, you might want to skip verification.
 */
export function isWebhookVerificationEnabled(): boolean {
  // Always verify in production
  if (process.env.PLAID_ENV === "production") {
    return true;
  }

  // Allow explicit override via environment variable
  if (process.env.PLAID_VERIFY_WEBHOOKS === "true") {
    return true;
  }

  if (process.env.PLAID_VERIFY_WEBHOOKS === "false") {
    return false;
  }

  // Default: verify in development, skip in sandbox for easier testing
  return process.env.PLAID_ENV === "development";
}
