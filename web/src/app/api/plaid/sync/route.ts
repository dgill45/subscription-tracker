export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { plaidClient } from "@/lib/plaid";
import {
  listPlaidConnections,
  getPlaidConnectionById,
  updatePlaidConnection,
} from "@/server/plaidStorage";
import {
  batchCreateTransactions,
  TransactionInput,
} from "@/server/transactionStorage";
import { RemovedTransaction, Transaction } from "plaid";

interface SyncResult {
  connectionId: string;
  institutionName: string;
  added: number;
  modified: number;
  removed: number;
  error?: string;
}

// Sync transactions for a specific connection or all connections
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { connectionId } = body;

    let connections;

    if (connectionId) {
      // Sync a specific connection
      const connection = await getPlaidConnectionById(
        session.user.id,
        connectionId
      );
      if (!connection) {
        return NextResponse.json(
          { error: "Connection not found" },
          { status: 404 }
        );
      }
      connections = [connection];
    } else {
      // Sync all connections
      connections = await listPlaidConnections(session.user.id);
    }

    if (connections.length === 0) {
      return NextResponse.json({
        message: "No connected accounts to sync",
        results: [],
      });
    }

    const results: SyncResult[] = [];

    for (const connection of connections) {
      if (connection.status !== "active") {
        results.push({
          connectionId: connection.id,
          institutionName: connection.institutionName,
          added: 0,
          modified: 0,
          removed: 0,
          error: `Connection status is ${connection.status}`,
        });
        continue;
      }

      try {
        const syncResult = await syncConnectionTransactions(
          session.user.id,
          connection.id,
          connection.accessToken,
          connection.cursor,
          connection.itemId,
          connection.institutionName
        );
        results.push(syncResult);
      } catch (error) {
        console.error(
          `Error syncing connection ${connection.id}:`,
          error
        );

        // Update connection status if there's a Plaid error
        const errorCode = (error as { response?: { data?: { error_code?: string } } })
          ?.response?.data?.error_code;

        if (errorCode) {
          await updatePlaidConnection(session.user.id, connection.id, {
            status: "error",
            errorCode,
          });
        }

        results.push({
          connectionId: connection.id,
          institutionName: connection.institutionName,
          added: 0,
          modified: 0,
          removed: 0,
          error: "Failed to sync transactions",
        });
      }
    }

    const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
    const totalModified = results.reduce((sum, r) => sum + r.modified, 0);
    const totalRemoved = results.reduce((sum, r) => sum + r.removed, 0);

    return NextResponse.json({
      message: `Synced ${totalAdded} new transactions`,
      summary: {
        added: totalAdded,
        modified: totalModified,
        removed: totalRemoved,
      },
      results,
    });
  } catch (error) {
    console.error("Error syncing transactions:", error);
    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 }
    );
  }
}

async function syncConnectionTransactions(
  userId: string,
  connectionId: string,
  accessToken: string,
  cursor: string | null,
  itemId: string,
  institutionName: string
): Promise<SyncResult> {
  let added: Transaction[] = [];
  let modified: Transaction[] = [];
  let removed: RemovedTransaction[] = [];
  let hasMore = true;
  let currentCursor = cursor;

  // Fetch all transaction updates since the last cursor
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

  // Convert Plaid transactions to our format
  const transactionInputs: TransactionInput[] = [...added, ...modified].map(
    (t) => ({
      transactionId: t.transaction_id,
      accountId: t.account_id,
      itemId,
      amount: t.amount, // Plaid: positive = money out, negative = money in
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

  // Batch create/update transactions
  const { created, failed } = await batchCreateTransactions(
    userId,
    transactionInputs
  );

  if (failed > 0) {
    console.warn(`Failed to store ${failed} transactions`);
  }

  // Update the connection with the new cursor and sync time
  await updatePlaidConnection(userId, connectionId, {
    cursor: currentCursor,
    lastSyncedAt: new Date().toISOString(),
    status: "active",
    errorCode: null,
  });

  return {
    connectionId,
    institutionName,
    added: added.length,
    modified: modified.length,
    removed: removed.length,
  };
}

// GET endpoint to check sync status
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connections = await listPlaidConnections(session.user.id);

    const status = connections.map((conn) => ({
      id: conn.id,
      institutionName: conn.institutionName,
      status: conn.status,
      lastSyncedAt: conn.lastSyncedAt,
      errorCode: conn.errorCode,
    }));

    return NextResponse.json({ connections: status });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}
