import "server-only";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DynamoDB } from "@aws-sdk/client-dynamodb";

const dynamoClient = DynamoDBDocument.from(
  new DynamoDB({
    region: process.env.AWS_REGION || "us-east-1",
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
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

const TABLE_NAME = process.env.AUTH_DYNAMODB_TABLE || "AuthUsers";

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
