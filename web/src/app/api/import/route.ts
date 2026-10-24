export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { parseCsv, detectRecurring } from "@/lib/importUtils";
import { auth } from "@/lib/auth";

const MAX_CSV_LENGTH = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const csvText = body.csv as string | undefined;

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json(
        { error: "csv is required" },
        { status: 400 }
      );
    }

    if (csvText.length > MAX_CSV_LENGTH) {
      return NextResponse.json(
        { error: "CSV is too large (max 2 MB)" },
        { status: 413 }
      );
    }

    const transactions = parseCsv(csvText);
    const suggestions = detectRecurring(transactions);

    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    console.error("IMPORT ERROR", err);
    return NextResponse.json(
        { error: "Failed to analyze CSV" },
        { status: 500 }
    );
  }
}
