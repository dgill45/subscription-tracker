import "server-only";
import { randomUUID, randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
// Resend disabled for MVP - re-enable after deployment
// import { Resend } from "resend";

// const resend = new Resend(process.env.AUTH_RESEND_KEY);
const EMAIL_FROM = process.env.AUTH_EMAIL_FROM || "noreply@example.com";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

// Email sending disabled for MVP
const RESEND_ENABLED = false;

const ACCESS_KEY_ID = process.env.APP_AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.APP_AWS_SECRET_ACCESS_KEY;

const dynamoClient = DynamoDBDocument.from(
  new DynamoDB({
    region: process.env.APP_AWS_REGION || "us-east-1",
    credentials:
      ACCESS_KEY_ID && SECRET_ACCESS_KEY
        ? {
            accessKeyId: ACCESS_KEY_ID,
            secretAccessKey: SECRET_ACCESS_KEY,
          }
        : undefined,
  }),
  {
    marshallOptions: {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
  }
);

const TABLE_NAME = process.env.APP_AUTH_DYNAMODB_TABLE || "AuthUsers";

export interface UserCredentials {
  id: string;
  email: string;
  name?: string;
  passwordHash: string;
  emailVerified?: Date | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Find a user by email for credentials login
 */
export async function findUserByEmail(email: string): Promise<UserCredentials | null> {
  try {
    // Query GSI1 to find user by email
    const result = await dynamoClient.query({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `USER#${email.toLowerCase()}`,
      },
    });

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    const item = result.Items[0];

    // Only return if this user has a password (credentials user)
    if (!item.passwordHash) {
      return null;
    }

    return {
      id: item.id,
      email: item.email,
      name: item.name,
      passwordHash: item.passwordHash,
      emailVerified: item.emailVerified ? new Date(item.emailVerified) : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  } catch (error) {
    console.error("Error finding user by email:", error);
    throw new Error("Failed to find user");
  }
}

/**
 * Create a new user with email and password
 */
export async function createUserWithPassword(
  email: string,
  password: string,
  name?: string
): Promise<{ id: string; email: string; name?: string }> {
  // Check if user already exists
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("User with this email already exists");
  }

  // Also check if email exists via OAuth (user without password)
  const oauthUser = await findOAuthUserByEmail(email);
  if (oauthUser) {
    throw new Error("An account with this email already exists. Try signing in with Google or GitHub.");
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  const user = {
    pk: `USER#${id}`,
    sk: `USER#${id}`,
    GSI1PK: `USER#${email.toLowerCase()}`,
    GSI1SK: `USER#${email.toLowerCase()}`,
    id,
    email: email.toLowerCase(),
    name,
    passwordHash,
    emailVerified: null,
    type: "credentials",
    createdAt: now,
    updatedAt: now,
  };

  try {
    await dynamoClient.put({
      TableName: TABLE_NAME,
      Item: user,
      ConditionExpression: "attribute_not_exists(pk)",
    });

    return { id, email: user.email, name };
  } catch (error) {
    console.error("Error creating user:", error);
    throw new Error("Failed to create user");
  }
}

/**
 * Verify a user's password
 */
export async function verifyPassword(
  email: string,
  password: string
): Promise<{ id: string; email: string; name?: string } | null> {
  const user = await findUserByEmail(email);

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
}

/**
 * Check if an OAuth user exists with this email (no password)
 */
async function findOAuthUserByEmail(email: string): Promise<boolean> {
  try {
    const result = await dynamoClient.query({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `USER#${email.toLowerCase()}`,
      },
    });

    if (!result.Items || result.Items.length === 0) {
      return false;
    }

    // Check if any user exists without a passwordHash (OAuth user)
    return result.Items.some(item => !item.passwordHash);
  } catch (error) {
    console.error("Error checking OAuth user:", error);
    return false;
  }
}

// ============================================
// Token Management (Password Reset & Email Verification)
// ============================================

const TOKEN_EXPIRY_HOURS = 24;

/**
 * Generate a secure token and its hash
 */
function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

/**
 * Hash a token for storage/lookup
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Store a verification token in DynamoDB
 */
async function storeToken(
  email: string,
  tokenHash: string,
  type: "password_reset" | "email_verification"
): Promise<void> {
  const expires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  await dynamoClient.put({
    TableName: TABLE_NAME,
    Item: {
      pk: `TOKEN#${tokenHash}`,
      sk: `TOKEN#${tokenHash}`,
      GSI1PK: `TOKEN#${email.toLowerCase()}#${type}`,
      GSI1SK: `TOKEN#${email.toLowerCase()}#${type}`,
      email: email.toLowerCase(),
      tokenHash,
      type,
      expires,
      createdAt: new Date().toISOString(),
    },
  });
}

/**
 * Get and validate a token
 */
async function getValidToken(
  tokenHash: string,
  type: "password_reset" | "email_verification"
): Promise<{ email: string } | null> {
  try {
    const result = await dynamoClient.get({
      TableName: TABLE_NAME,
      Key: {
        pk: `TOKEN#${tokenHash}`,
        sk: `TOKEN#${tokenHash}`,
      },
    });

    if (!result.Item) {
      return null;
    }

    const item = result.Item;

    // Check type matches
    if (item.type !== type) {
      return null;
    }

    // Check expiration
    if (new Date(item.expires) < new Date()) {
      // Delete expired token
      await deleteToken(tokenHash);
      return null;
    }

    return { email: item.email };
  } catch (error) {
    console.error("Error getting token:", error);
    return null;
  }
}

/**
 * Delete a token
 */
async function deleteToken(tokenHash: string): Promise<void> {
  try {
    await dynamoClient.delete({
      TableName: TABLE_NAME,
      Key: {
        pk: `TOKEN#${tokenHash}`,
        sk: `TOKEN#${tokenHash}`,
      },
    });
  } catch (error) {
    console.error("Error deleting token:", error);
  }
}

/**
 * Delete all tokens of a type for an email
 */
async function deleteTokensForEmail(
  email: string,
  type: "password_reset" | "email_verification"
): Promise<void> {
  try {
    const result = await dynamoClient.query({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `TOKEN#${email.toLowerCase()}#${type}`,
      },
    });

    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        await deleteToken(item.tokenHash);
      }
    }
  } catch (error) {
    console.error("Error deleting tokens for email:", error);
  }
}

// ============================================
// Password Reset
// ============================================

/**
 * Request a password reset - generates token and sends email
 */
export async function requestPasswordReset(email: string): Promise<boolean> {
  // Email disabled for MVP
  if (!RESEND_ENABLED) {
    console.warn("Password reset email disabled for MVP");
    return true;
  }

  try {
    // Check if user exists with password
    const user = await findUserByEmail(email);
    if (!user) {
      // Return true anyway to prevent email enumeration
      return true;
    }

    // Delete any existing password reset tokens for this email
    await deleteTokensForEmail(email, "password_reset");

    // Generate and store new token
    const { token, tokenHash } = generateToken();
    await storeToken(email, tokenHash, "password_reset");

    // Send email - disabled for MVP
    // const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;
    // await resend.emails.send({ ... });

    return true;
  } catch (error) {
    console.error("Error requesting password reset:", error);
    throw new Error("Failed to send password reset email");
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    const tokenHash = hashToken(token);
    const tokenData = await getValidToken(tokenHash, "password_reset");

    if (!tokenData) {
      return false;
    }

    // Get user
    const user = await findUserByEmail(tokenData.email);
    if (!user) {
      return false;
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await dynamoClient.update({
      TableName: TABLE_NAME,
      Key: {
        pk: `USER#${user.id}`,
        sk: `USER#${user.id}`,
      },
      UpdateExpression: "SET passwordHash = :hash, updatedAt = :now",
      ExpressionAttributeValues: {
        ":hash": passwordHash,
        ":now": new Date().toISOString(),
      },
    });

    // Delete the used token
    await deleteToken(tokenHash);

    return true;
  } catch (error) {
    console.error("Error resetting password:", error);
    throw new Error("Failed to reset password");
  }
}

// ============================================
// Email Verification
// ============================================

/**
 * Send email verification
 */
export async function sendEmailVerification(email: string): Promise<boolean> {
  // Email disabled for MVP
  if (!RESEND_ENABLED) {
    console.warn("Email verification disabled for MVP");
    return true;
  }

  try {
    // Delete any existing verification tokens for this email
    await deleteTokensForEmail(email, "email_verification");

    // Generate and store new token
    const { token, tokenHash } = generateToken();
    await storeToken(email, tokenHash, "email_verification");

    // Send email - disabled for MVP
    // const verifyUrl = `${APP_URL}/auth/verify-email?token=${token}`;
    // await resend.emails.send({ ... });

    return true;
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Failed to send verification email");
  }
}

/**
 * Verify email with token
 */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; email?: string }> {
  try {
    const tokenHash = hashToken(token);
    const tokenData = await getValidToken(tokenHash, "email_verification");

    if (!tokenData) {
      return { success: false };
    }

    // Find user and update emailVerified
    const result = await dynamoClient.query({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `USER#${tokenData.email}`,
      },
    });

    if (!result.Items || result.Items.length === 0) {
      return { success: false };
    }

    const user = result.Items[0];

    // Update emailVerified
    await dynamoClient.update({
      TableName: TABLE_NAME,
      Key: {
        pk: `USER#${user.id}`,
        sk: `USER#${user.id}`,
      },
      UpdateExpression: "SET emailVerified = :verified, updatedAt = :now",
      ExpressionAttributeValues: {
        ":verified": new Date().toISOString(),
        ":now": new Date().toISOString(),
      },
    });

    // Delete the used token
    await deleteToken(tokenHash);

    return { success: true, email: tokenData.email };
  } catch (error) {
    console.error("Error verifying email:", error);
    throw new Error("Failed to verify email");
  }
}

/**
 * Check if a user's email is verified
 */
export async function isEmailVerified(email: string): Promise<boolean> {
  try {
    const result = await dynamoClient.query({
      TableName: TABLE_NAME,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `USER#${email.toLowerCase()}`,
      },
    });

    if (!result.Items || result.Items.length === 0) {
      return false;
    }

    const user = result.Items[0];

    // OAuth users are always considered verified
    if (!user.passwordHash) {
      return true;
    }

    return !!user.emailVerified;
  } catch (error) {
    console.error("Error checking email verification:", error);
    return false;
  }
}
