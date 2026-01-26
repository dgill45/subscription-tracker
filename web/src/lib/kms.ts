import "server-only";
import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";

const REGION = process.env.AWS_REGION || "us-east-1";
const KMS_KEY_ID = process.env.KMS_KEY_ID;

// Prefix to identify encrypted values
const ENCRYPTED_PREFIX = "enc:";

const kmsClient = new KMSClient({
  region: REGION,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

/**
 * Check if KMS encryption is enabled.
 * Returns true if KMS_KEY_ID is configured.
 */
export function isKmsEnabled(): boolean {
  return Boolean(KMS_KEY_ID);
}

/**
 * Check if a value is already encrypted (has the encryption prefix).
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Encrypt a plaintext value using AWS KMS.
 * Returns the encrypted value with a prefix for identification.
 * If KMS is not configured, returns the original value (for development).
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!KMS_KEY_ID) {
    console.warn(
      "KMS_KEY_ID not configured - storing access token without encryption. " +
        "Set KMS_KEY_ID environment variable for production use."
    );
    return plaintext;
  }

  try {
    const command = new EncryptCommand({
      KeyId: KMS_KEY_ID,
      Plaintext: Buffer.from(plaintext, "utf-8"),
    });

    const response = await kmsClient.send(command);

    if (!response.CiphertextBlob) {
      throw new Error("KMS encryption returned no ciphertext");
    }

    const ciphertext = Buffer.from(response.CiphertextBlob).toString("base64");
    return ENCRYPTED_PREFIX + ciphertext;
  } catch (error) {
    console.error("KMS encryption failed:", error);
    throw new Error("Failed to encrypt sensitive data");
  }
}

/**
 * Decrypt an encrypted value using AWS KMS.
 * Handles both encrypted values (with prefix) and legacy plaintext values.
 * If KMS is not configured or value is not encrypted, returns as-is.
 */
export async function decrypt(ciphertext: string): Promise<string> {
  // Handle legacy unencrypted values
  if (!isEncrypted(ciphertext)) {
    if (KMS_KEY_ID) {
      console.warn(
        "Found unencrypted access token in database. " +
          "Consider running a migration to encrypt existing tokens."
      );
    }
    return ciphertext;
  }

  if (!KMS_KEY_ID) {
    throw new Error(
      "Cannot decrypt: KMS_KEY_ID not configured but encrypted value found"
    );
  }

  try {
    const base64Ciphertext = ciphertext.slice(ENCRYPTED_PREFIX.length);
    const ciphertextBlob = Buffer.from(base64Ciphertext, "base64");

    const command = new DecryptCommand({
      CiphertextBlob: ciphertextBlob,
    });

    const response = await kmsClient.send(command);

    if (!response.Plaintext) {
      throw new Error("KMS decryption returned no plaintext");
    }

    return Buffer.from(response.Plaintext).toString("utf-8");
  } catch (error) {
    console.error("KMS decryption failed:", error);
    throw new Error("Failed to decrypt sensitive data");
  }
}

/**
 * Encrypt an access token for storage.
 * Wrapper function with specific error messaging for Plaid tokens.
 */
export async function encryptAccessToken(accessToken: string): Promise<string> {
  return encrypt(accessToken);
}

/**
 * Decrypt an access token from storage.
 * Wrapper function with specific error messaging for Plaid tokens.
 */
export async function decryptAccessToken(
  encryptedToken: string
): Promise<string> {
  return decrypt(encryptedToken);
}
