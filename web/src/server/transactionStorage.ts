import "server-only";
import { ddb } from "../../server/dynamo";
import {
  PutCommand,
  QueryCommand,
  BatchWriteCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { TRANSACTIONS_TABLE } from "@/lib/plaid";

// Transaction from Plaid stored in DynamoDB
export interface StoredTransaction {
  userId: string; // Partition key
  transactionId: string; // Sort key (Plaid transaction_id)
  accountId: string;
  itemId: string; // Links to PlaidConnection
  amount: number; // Positive = money out, Negative = money in
  date: string; // ISO date (YYYY-MM-DD)
  name: string; // Merchant name from Plaid
  merchantName: string | null; // Cleaned merchant name
  category: string[]; // Plaid categories
  categoryId: string | null;
  pending: boolean;
  paymentChannel: string; // online, in store, other
  transactionType: string; // place, digital, special, unresolved
  logoUrl: string | null;
  createdAt: string;
}

export interface TransactionInput {
  transactionId: string;
  accountId: string;
  itemId: string;
  amount: number;
  date: string;
  name: string;
  merchantName: string | null;
  category: string[];
  categoryId: string | null;
  pending: boolean;
  paymentChannel: string;
  transactionType: string;
  logoUrl: string | null;
}

function nowIso() {
  return new Date().toISOString();
}

export async function listTransactions(
  userId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    accountId?: string;
    limit?: number;
  }
): Promise<StoredTransaction[]> {
  try {
    let filterExpression: string | undefined;
    const expressionValues: Record<string, unknown> = {
      ":uid": userId,
    };

    const filters: string[] = [];

    if (options?.startDate) {
      filters.push("#date >= :startDate");
      expressionValues[":startDate"] = options.startDate;
    }

    if (options?.endDate) {
      filters.push("#date <= :endDate");
      expressionValues[":endDate"] = options.endDate;
    }

    if (options?.accountId) {
      filters.push("accountId = :accountId");
      expressionValues[":accountId"] = options.accountId;
    }

    if (filters.length > 0) {
      filterExpression = filters.join(" AND ");
    }

    const result = await ddb.send(
      new QueryCommand({
        TableName: TRANSACTIONS_TABLE,
        KeyConditionExpression: "userId = :uid",
        FilterExpression: filterExpression,
        ExpressionAttributeValues: expressionValues,
        ExpressionAttributeNames: filters.some(f => f.includes("#date"))
          ? { "#date": "date" }
          : undefined,
        Limit: options?.limit,
        ScanIndexForward: false, // Most recent first
      })
    );

    return (result.Items || []) as StoredTransaction[];
  } catch (error) {
    console.error("Error listing transactions:", error);
    throw new Error("Failed to list transactions from database");
  }
}

export async function createTransaction(
  userId: string,
  input: TransactionInput
): Promise<StoredTransaction> {
  const item: StoredTransaction = {
    userId,
    transactionId: input.transactionId,
    accountId: input.accountId,
    itemId: input.itemId,
    amount: input.amount,
    date: input.date,
    name: input.name,
    merchantName: input.merchantName,
    category: input.category,
    categoryId: input.categoryId,
    pending: input.pending,
    paymentChannel: input.paymentChannel,
    transactionType: input.transactionType,
    logoUrl: input.logoUrl,
    createdAt: nowIso(),
  };

  try {
    await ddb.send(
      new PutCommand({
        TableName: TRANSACTIONS_TABLE,
        Item: item,
      })
    );

    return item;
  } catch (error) {
    console.error("Error creating transaction:", error);
    throw new Error("Failed to create transaction in database");
  }
}

export async function batchCreateTransactions(
  userId: string,
  inputs: TransactionInput[]
): Promise<{ created: number; failed: number }> {
  if (inputs.length === 0) {
    return { created: 0, failed: 0 };
  }

  const timestamp = nowIso();
  let created = 0;
  let failed = 0;

  // DynamoDB BatchWrite supports max 25 items per request
  const batches: TransactionInput[][] = [];
  for (let i = 0; i < inputs.length; i += 25) {
    batches.push(inputs.slice(i, i + 25));
  }

  for (const batch of batches) {
    const putRequests = batch.map((input) => ({
      PutRequest: {
        Item: {
          userId,
          transactionId: input.transactionId,
          accountId: input.accountId,
          itemId: input.itemId,
          amount: input.amount,
          date: input.date,
          name: input.name,
          merchantName: input.merchantName,
          category: input.category,
          categoryId: input.categoryId,
          pending: input.pending,
          paymentChannel: input.paymentChannel,
          transactionType: input.transactionType,
          logoUrl: input.logoUrl,
          createdAt: timestamp,
        },
      },
    }));

    try {
      const result = await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [TRANSACTIONS_TABLE]: putRequests,
          },
        })
      );

      // Handle unprocessed items
      const unprocessed = result.UnprocessedItems?.[TRANSACTIONS_TABLE]?.length || 0;
      created += batch.length - unprocessed;
      failed += unprocessed;
    } catch (error) {
      console.error("Error batch creating transactions:", error);
      failed += batch.length;
    }
  }

  return { created, failed };
}

export async function deleteTransaction(
  userId: string,
  transactionId: string
): Promise<boolean> {
  try {
    await ddb.send(
      new DeleteCommand({
        TableName: TRANSACTIONS_TABLE,
        Key: {
          userId,
          transactionId,
        },
      })
    );

    return true;
  } catch (error) {
    console.error("Error deleting transaction:", error);
    throw new Error("Failed to delete transaction from database");
  }
}

export async function deleteTransactionsByItemId(
  userId: string,
  itemId: string
): Promise<number> {
  try {
    // First, query all transactions for this item
    const result = await ddb.send(
      new QueryCommand({
        TableName: TRANSACTIONS_TABLE,
        KeyConditionExpression: "userId = :uid",
        FilterExpression: "itemId = :itemId",
        ExpressionAttributeValues: {
          ":uid": userId,
          ":itemId": itemId,
        },
        ProjectionExpression: "transactionId",
      })
    );

    const items = result.Items || [];
    if (items.length === 0) {
      return 0;
    }

    // Batch delete in groups of 25
    let deleted = 0;
    const batches: Array<{ transactionId: string }[]> = [];
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25) as Array<{ transactionId: string }>);
    }

    for (const batch of batches) {
      const deleteRequests = batch.map((item) => ({
        DeleteRequest: {
          Key: {
            userId,
            transactionId: item.transactionId,
          },
        },
      }));

      await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [TRANSACTIONS_TABLE]: deleteRequests,
          },
        })
      );

      deleted += batch.length;
    }

    return deleted;
  } catch (error) {
    console.error("Error deleting transactions by item ID:", error);
    throw new Error("Failed to delete transactions from database");
  }
}

// Get transactions formatted for the recurring detection algorithm
export async function getTransactionsForAnalysis(
  userId: string,
  options?: { months?: number }
): Promise<Array<{ date: string; merchant: string; amount: number }>> {
  const months = options?.months || 6;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const transactions = await listTransactions(userId, {
    startDate: startDate.toISOString().split("T")[0],
  });

  return transactions
    .filter((t) => !t.pending && t.amount > 0) // Only completed outflows
    .map((t) => ({
      date: t.date,
      merchant: t.merchantName || t.name,
      amount: t.amount,
    }));
}
