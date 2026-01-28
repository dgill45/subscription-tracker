export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { plaidClient } from "@/lib/plaid";
import {
  createPlaidConnection,
  getPlaidConnectionByItemId,
  PlaidAccountInfo,
} from "@/server/plaidStorage";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { publicToken, metadata } = body;

    if (!publicToken) {
      return NextResponse.json(
        { error: "Missing public token" },
        { status: 400 }
      );
    }

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Check if this item is already connected
    const existingConnection = await getPlaidConnectionByItemId(
      session.user.id,
      itemId
    );

    if (existingConnection) {
      return NextResponse.json(
        { error: "This bank account is already connected" },
        { status: 409 }
      );
    }

    // Get account information
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accounts: PlaidAccountInfo[] = accountsResponse.data.accounts.map(
      (account) => ({
        accountId: account.account_id,
        name: account.name,
        officialName: account.official_name || null,
        type: account.type,
        subtype: account.subtype || null,
        mask: account.mask || null,
        currentBalance: account.balances.current,
        availableBalance: account.balances.available,
      })
    );

    // Get institution information
    const institutionId = metadata?.institution?.institution_id || "unknown";
    const institutionName = metadata?.institution?.name || "Unknown Bank";

    // Store the connection
    const connection = await createPlaidConnection(session.user.id, {
      itemId,
      accessToken,
      institutionId,
      institutionName,
      accounts,
    });

    return NextResponse.json(
      {
        success: true,
        connection: {
          id: connection.id,
          institutionName: connection.institutionName,
          accounts: connection.accounts.map((a) => ({
            accountId: a.accountId,
            name: a.name,
            type: a.type,
            mask: a.mask,
          })),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error exchanging token:", error);
    return NextResponse.json(
      { error: "Failed to connect bank account" },
      { status: 500 }
    );
  }
}
