export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { plaidClient } from "@/lib/plaid";
import {
  listPlaidConnections,
  getPlaidConnectionById,
  deletePlaidConnection,
  updatePlaidConnection,
} from "@/server/plaidStorage";
import { deleteTransactionsByItemId } from "@/server/transactionStorage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connections = await listPlaidConnections(session.user.id);

    // Return sanitized connection data (no access tokens)
    const accounts = connections.map((conn) => ({
      id: conn.id,
      institutionId: conn.institutionId,
      institutionName: conn.institutionName,
      status: conn.status,
      lastSyncedAt: conn.lastSyncedAt,
      accounts: conn.accounts.map((a) => ({
        accountId: a.accountId,
        name: a.name,
        officialName: a.officialName,
        type: a.type,
        subtype: a.subtype,
        mask: a.mask,
        currentBalance: a.currentBalance,
        availableBalance: a.availableBalance,
      })),
      createdAt: conn.createdAt,
    }));

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error("Error listing accounts:", error);
    return NextResponse.json(
      { error: "Failed to list connected accounts" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("id");

    if (!connectionId) {
      return NextResponse.json(
        { error: "Missing connection ID" },
        { status: 400 }
      );
    }

    // Get the connection to access the access token
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

    // Remove the item from Plaid
    try {
      await plaidClient.itemRemove({
        access_token: connection.accessToken,
      });
    } catch (plaidError) {
      console.error("Error removing item from Plaid:", plaidError);
      // Continue with local deletion even if Plaid removal fails
    }

    // Delete all transactions associated with this connection
    await deleteTransactionsByItemId(session.user.id, connection.itemId);

    // Delete the connection from our database
    await deletePlaidConnection(session.user.id, connectionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting connection:", error);
    return NextResponse.json(
      { error: "Failed to disconnect bank account" },
      { status: 500 }
    );
  }
}

// Refresh account balances
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("id");

    if (!connectionId) {
      return NextResponse.json(
        { error: "Missing connection ID" },
        { status: 400 }
      );
    }

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

    // Refresh account balances from Plaid
    const accountsResponse = await plaidClient.accountsGet({
      access_token: connection.accessToken,
    });

    const updatedAccounts = accountsResponse.data.accounts.map((account) => ({
      accountId: account.account_id,
      name: account.name,
      officialName: account.official_name || null,
      type: account.type,
      subtype: account.subtype || null,
      mask: account.mask || null,
      currentBalance: account.balances.current,
      availableBalance: account.balances.available,
    }));

    // Update connection with new account data
    await updatePlaidConnection(session.user.id, connectionId, {
      accounts: updatedAccounts,
    });

    return NextResponse.json({
      success: true,
      accounts: updatedAccounts,
    });
  } catch (error) {
    console.error("Error refreshing accounts:", error);
    return NextResponse.json(
      { error: "Failed to refresh account balances" },
      { status: 500 }
    );
  }
}
