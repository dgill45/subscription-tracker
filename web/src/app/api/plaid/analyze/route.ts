export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getTransactionsForAnalysis } from "@/server/transactionStorage";
import {
  detectRecurring,
  Transaction,
  SubscriptionSuggestion,
} from "@/lib/importUtils";
import { listSubscriptions } from "@/server/storage";
import { normalizeMerchant } from "@/lib/importUtils";

// Demo user ID (same as used elsewhere in the app)
const DEMO_USER_ID = "demo-user";

export interface AnalyzeResponse {
  suggestions: SubscriptionSuggestion[];
  transactionCount: number;
  existingMerchants: string[];
}

/**
 * GET /api/plaid/analyze
 * Analyzes synced bank transactions to detect recurring subscriptions.
 *
 * Query params:
 * - months: Number of months of transaction history to analyze (default: 6)
 * - includeExisting: If "true", include suggestions for merchants that already exist (default: false)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get("months") || "6", 10);
    const includeExisting = searchParams.get("includeExisting") === "true";

    // Fetch transactions formatted for analysis
    const rawTransactions = await getTransactionsForAnalysis(DEMO_USER_ID, {
      months,
    });

    if (rawTransactions.length === 0) {
      return NextResponse.json({
        suggestions: [],
        transactionCount: 0,
        existingMerchants: [],
      } satisfies AnalyzeResponse);
    }

    // Convert to the Transaction format expected by detectRecurring
    const transactions: Transaction[] = rawTransactions.map((t) => ({
      date: t.date,
      merchantRaw: t.merchant,
      merchant: normalizeMerchant(t.merchant),
      amount: t.amount,
      description: t.merchant,
    }));

    // Detect recurring charges
    let suggestions = detectRecurring(transactions);

    // Get existing subscriptions to filter out duplicates
    const existingSubscriptions = await listSubscriptions(DEMO_USER_ID);
    const existingMerchants = existingSubscriptions.map((s) =>
      normalizeMerchant(s.merchant).toLowerCase()
    );

    // Filter out suggestions for merchants that already exist as subscriptions
    if (!includeExisting) {
      suggestions = suggestions.filter((suggestion) => {
        const normalizedMerchant = suggestion.merchant.toLowerCase();
        return !existingMerchants.some(
          (existing) =>
            existing.includes(normalizedMerchant) ||
            normalizedMerchant.includes(existing)
        );
      });
    }

    return NextResponse.json({
      suggestions,
      transactionCount: rawTransactions.length,
      existingMerchants,
    } satisfies AnalyzeResponse);
  } catch (error) {
    console.error("Error analyzing transactions:", error);
    return NextResponse.json(
      { error: "Failed to analyze transactions" },
      { status: 500 }
    );
  }
}
