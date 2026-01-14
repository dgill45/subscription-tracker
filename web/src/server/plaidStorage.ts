import "server-only";
import { randomUUID } from "crypto";
import { ddb } from "../../server/dynamo";
import {
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { PLAID_CONNECTIONS_TABLE } from "@/lib/plaid";

// Plaid connection stored for each user
export interface PlaidConnection {
  id: string;
  userId: string;
  itemId: string; // Plaid item ID
  accessToken: string; // Plaid access token (encrypted in production)
  institutionId: string;
  institutionName: string;
  accounts: PlaidAccountInfo[];
  cursor: string | null; // Transaction sync cursor
  lastSyncedAt: string | null;
  status: "active" | "error" | "disconnected";
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaidAccountInfo {
  accountId: string;
  name: string;
  officialName: string | null;
  type: string; // depository, credit, loan, investment, etc.
  subtype: string | null;
  mask: string | null; // Last 4 digits
  currentBalance: number | null;
  availableBalance: number | null;
}

export interface PlaidConnectionInput {
  itemId: string;
  accessToken: string;
  institutionId: string;
  institutionName: string;
  accounts: PlaidAccountInfo[];
}

function nowIso() {
  return new Date().toISOString();
}

export async function listPlaidConnections(userId: string): Promise<PlaidConnection[]> {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: PLAID_CONNECTIONS_TABLE,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: {
          ":uid": userId,
        },
      })
    );

    return (result.Items || []) as PlaidConnection[];
  } catch (error) {
    console.error("Error listing Plaid connections:", error);
    throw new Error("Failed to list Plaid connections from database");
  }
}

export async function createPlaidConnection(
  userId: string,
  input: PlaidConnectionInput
): Promise<PlaidConnection> {
  const id = randomUUID();
  const timestamp = nowIso();

  const item: PlaidConnection = {
    id,
    userId,
    itemId: input.itemId,
    accessToken: input.accessToken,
    institutionId: input.institutionId,
    institutionName: input.institutionName,
    accounts: input.accounts,
    cursor: null,
    lastSyncedAt: null,
    status: "active",
    errorCode: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: PLAID_CONNECTIONS_TABLE,
        Item: item,
      })
    );

    return item;
  } catch (error) {
    console.error("Error creating Plaid connection:", error);
    throw new Error("Failed to create Plaid connection in database");
  }
}

export async function getPlaidConnectionById(
  userId: string,
  id: string
): Promise<PlaidConnection | null> {
  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: PLAID_CONNECTIONS_TABLE,
        Key: {
          userId,
          id,
        },
      })
    );

    return (result.Item as PlaidConnection) || null;
  } catch (error) {
    console.error("Error getting Plaid connection by id:", error);
    throw new Error("Failed to retrieve Plaid connection from database");
  }
}

export async function getPlaidConnectionByItemId(
  userId: string,
  itemId: string
): Promise<PlaidConnection | null> {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: PLAID_CONNECTIONS_TABLE,
        KeyConditionExpression: "userId = :uid",
        FilterExpression: "itemId = :itemId",
        ExpressionAttributeValues: {
          ":uid": userId,
          ":itemId": itemId,
        },
      })
    );

    const items = result.Items as PlaidConnection[];
    return items.length > 0 ? items[0] : null;
  } catch (error) {
    console.error("Error getting Plaid connection by item ID:", error);
    throw new Error("Failed to retrieve Plaid connection from database");
  }
}

export async function updatePlaidConnection(
  userId: string,
  id: string,
  updates: Partial<Pick<PlaidConnection, "accounts" | "cursor" | "lastSyncedAt" | "status" | "errorCode">>
): Promise<PlaidConnection | null> {
  const allowedKeys: Array<keyof typeof updates> = [
    "accounts",
    "cursor",
    "lastSyncedAt",
    "status",
    "errorCode",
  ];

  const updatePayload: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    if (updates[key] !== undefined) {
      updatePayload[key] = updates[key];
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return await getPlaidConnectionById(userId, id);
  }

  updatePayload["updatedAt"] = nowIso();

  const exprParts: string[] = [];
  const exprValues: Record<string, unknown> = {};
  const exprNames: Record<string, string> = {};

  for (const [field, value] of Object.entries(updatePayload)) {
    const placeholder = `:${field}`;
    const nameKey = `#${field}`;
    exprParts.push(`${nameKey} = ${placeholder}`);
    exprValues[placeholder] = value;
    exprNames[nameKey] = field;
  }

  const UpdateExpression = "SET " + exprParts.join(", ");

  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: PLAID_CONNECTIONS_TABLE,
        Key: {
          userId,
          id,
        },
        UpdateExpression,
        ExpressionAttributeValues: exprValues,
        ExpressionAttributeNames: exprNames,
        ReturnValues: "ALL_NEW",
      })
    );

    return (result.Attributes as PlaidConnection) || null;
  } catch (error) {
    console.error("Error updating Plaid connection:", error);
    throw new Error("Failed to update Plaid connection in database");
  }
}

export async function deletePlaidConnection(userId: string, id: string): Promise<boolean> {
  try {
    const existing = await getPlaidConnectionById(userId, id);
    if (!existing) {
      return false;
    }

    await ddb.send(
      new DeleteCommand({
        TableName: PLAID_CONNECTIONS_TABLE,
        Key: {
          userId,
          id,
        },
      })
    );

    return true;
  } catch (error) {
    console.error("Error deleting Plaid connection:", error);
    throw new Error("Failed to delete Plaid connection from database");
  }
}
