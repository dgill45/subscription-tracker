export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import {
  updatePlaidConnection,
  findPlaidConnectionByItemId,
} from "@/server/plaidStorage";
import {
  batchCreateTransactions,
  TransactionInput,
} from "@/server/transactionStorage";
import { RemovedTransaction, Transaction } from "plaid";

// Plaid webhook types
type WebhookType =
  | "TRANSACTIONS"
  | "ITEM"
  | "HOLDINGS"
  | "INVESTMENTS_TRANSACTIONS"
  | "LIABILITIES"
  | "AUTH"
  | "IDENTITY"
  | "ASSETS"
  | "INCOME";

interface PlaidWebhookBody {
  webhook_type: WebhookType;
  webhook_code: string;
  item_id: string;
  error?: {
    error_code: string;
    error_message: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body: PlaidWebhookBody = await req.json();

    console.log("Received Plaid webhook:", {
      type: body.webhook_type,
      code: body.webhook_code,
      itemId: body.item_id,
    });

    // Find the connection by item_id using the ItemIdIndex GSI
    const connection = await findPlaidConnectionByItemId(body.item_id);

    if (!connection) {
      console.warn(`No connection found for item ${body.item_id}`);
      // Return 200 to prevent Plaid from retrying
      return NextResponse.json({ received: true });
    }

    switch (body.webhook_type) {
      case "TRANSACTIONS":
        await handleTransactionsWebhook(
          body.webhook_code,
          connection.userId,
          connection.id,
          connection.accessToken,
          connection.cursor,
          connection.itemId
        );
        break;

      case "ITEM":
        await handleItemWebhook(
          body.webhook_code,
          connection.userId,
          connection.id,
          body.error
        );
        break;

      default:
        console.log(`Unhandled webhook type: ${body.webhook_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Return 200 to prevent infinite retries on parsing errors
    return NextResponse.json({ received: true, error: "Processing error" });
  }
}

async function handleTransactionsWebhook(
  code: string,
  userId: string,
  connectionId: string,
  accessToken: string,
  cursor: string | null,
  itemId: string
) {
  switch (code) {
    case "SYNC_UPDATES_AVAILABLE":
    case "INITIAL_UPDATE":
    case "HISTORICAL_UPDATE":
    case "DEFAULT_UPDATE":
      // Sync new transactions
      await syncTransactionsFromWebhook(
        userId,
        connectionId,
        accessToken,
        cursor,
        itemId
      );
      break;

    case "TRANSACTIONS_REMOVED":
      // Handle removed transactions
      console.log("Transactions removed webhook received");
      break;

    default:
      console.log(`Unhandled transactions webhook code: ${code}`);
  }
}

async function handleItemWebhook(
  code: string,
  userId: string,
  connectionId: string,
  error?: { error_code: string; error_message: string }
) {
  switch (code) {
    case "ERROR":
      console.error("Item error:", error);
      await updatePlaidConnection(userId, connectionId, {
        status: "error",
        errorCode: error?.error_code || "UNKNOWN_ERROR",
      });
      break;

    case "PENDING_EXPIRATION":
      console.warn("Item pending expiration");
      await updatePlaidConnection(userId, connectionId, {
        status: "error",
        errorCode: "PENDING_EXPIRATION",
      });
      break;

    case "USER_PERMISSION_REVOKED":
      await updatePlaidConnection(userId, connectionId, {
        status: "disconnected",
        errorCode: "USER_PERMISSION_REVOKED",
      });
      break;

    case "WEBHOOK_UPDATE_ACKNOWLEDGED":
      console.log("Webhook URL updated successfully");
      break;

    default:
      console.log(`Unhandled item webhook code: ${code}`);
  }
}

async function syncTransactionsFromWebhook(
  userId: string,
  connectionId: string,
  accessToken: string,
  cursor: string | null,
  itemId: string
) {
  let added: Transaction[] = [];
  let modified: Transaction[] = [];
  let removed: RemovedTransaction[] = [];
  let hasMore = true;
  let currentCursor = cursor;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: currentCursor || undefined,
      count: 500,
    });

    added = added.concat(response.data.added);
    modified = modified.concat(response.data.modified);
    removed = removed.concat(response.data.removed);
    hasMore = response.data.has_more;
    currentCursor = response.data.next_cursor;
  }

  // Convert and store transactions
  const transactionInputs: TransactionInput[] = [...added, ...modified].map(
    (t) => ({
      transactionId: t.transaction_id,
      accountId: t.account_id,
      itemId,
      amount: t.amount,
      date: t.date,
      name: t.name,
      merchantName: t.merchant_name || null,
      category: t.category || [],
      categoryId: t.category_id || null,
      pending: t.pending,
      paymentChannel: t.payment_channel,
      transactionType: t.transaction_type || "unresolved",
      logoUrl: t.logo_url || null,
    })
  );

  if (transactionInputs.length > 0) {
    await batchCreateTransactions(userId, transactionInputs);
  }

  // Update cursor
  await updatePlaidConnection(userId, connectionId, {
    cursor: currentCursor,
    lastSyncedAt: new Date().toISOString(),
    status: "active",
    errorCode: null,
  });

  console.log(
    `Webhook sync complete: ${added.length} added, ${modified.length} modified, ${removed.length} removed`
  );
}

// GET endpoint to verify webhook URL is accessible
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Plaid webhook endpoint is active",
  });
}
