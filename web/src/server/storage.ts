import { randomUUID } from "crypto";
import { ddb, TABLE_NAME } from "../../server/dynamo";
import {
    PutCommand,
    QueryCommand,
    UpdateCommand,
    DeleteCommand,
    GetCommand
 } from "@aws-sdk/lib-dynamodb";
import {
    Subscription,
    SubscriptionInput,
 } from "@/lib/types";

 function nowIso() {
  return new Date().toISOString();
}


export async function listSubscriptions(userId: string): Promise<Subscription[]> {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "userid = :uid",
        ExpressionAttributeValues: {
          ":uid": userId,
        },
      })
    );

    return (result.Items || []) as Subscription[];
  } catch (error) {
    console.error("Error listing subscriptions:", error);
    throw new Error("Failed to list subscriptions from database");
  }
}

export async function createSubscription(
  userId: string,
  input: SubscriptionInput
): Promise<Subscription> {
  const id = randomUUID();
  const timestamp = nowIso();

  const item: Subscription = {
    id,
    userId,
    merchant: input.merchant,
    amount: input.amount,
    period: input.period,
    nextBillDate: input.nextBillDate,
    notes: input.notes,
    status: "active",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          ...item,
          userid: userId, // Map to lowercase for DynamoDB
        },
      })
    );

    return item;
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw new Error("Failed to create subscription in database");
  }
}

export async function getSubscriptionById(userId: string, id: string): Promise<Subscription | null> {
  try {
    const res = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          userid: userId,
          id,
        },
      })
    );

    return (res.Item as Subscription) || null;
  } catch (error) {
    console.error("Error getting subscription by id:", error);
    throw new Error("Failed to retrieve subscription from database");
  }
}

export async function updateSubscription(
  userId: string,
  id: string,
  updates: Partial<
    Pick<
      Subscription,
      | "merchant"
      | "amount"
      | "period"
      | "nextBillDate"
      | "notes"
    >
  >
): Promise<Subscription | null> {

  const allowedKeys: Array<
    "merchant" | "amount" | "period" | "nextBillDate" | "notes" 
  > = [
    "merchant",
    "amount",
    "period",
    "nextBillDate",
    "notes",
  ];

  // Build an object of only the fields that are actually being updated
  const updatePayload: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    if (updates[key] !== undefined) {
      updatePayload[key] = updates[key];
    }
  }


  if (Object.keys(updatePayload).length === 0) {
    return await getSubscriptionById(userId, id);
  }


  const updatedAtVal = new Date().toISOString();
  updatePayload["updatedAt"] = updatedAtVal;


  const exprParts: string[] = [];
  const exprValues: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(updatePayload)) {
    const placeholder = `:${field}`;
    exprParts.push(`${field} = ${placeholder}`);
    exprValues[placeholder] = value;
  }

  const UpdateExpression = "SET " + exprParts.join(", ");

  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          userid: userId,
          id,
        },
        UpdateExpression,
        ExpressionAttributeValues: exprValues,
        ReturnValues: "ALL_NEW",
      })
    );

    return (res.Attributes as Subscription) || null;
  } catch (error) {
    console.error("Error updating subscription:", error);
    throw new Error("Failed to update subscription in database");
  }
}



export async function deleteSubscription(userId: string, id: string): Promise<boolean> {
  try {
    // First check if the item exists
    const existing = await getSubscriptionById(userId, id);
    if (!existing) {
      return false;
    }

    await ddb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          userid: userId,
          id,
        },
      })
    );

    return true;
  } catch (error) {
    console.error("Error deleting subscription:", error);
    throw new Error("Failed to delete subscription from database");
  }
}
