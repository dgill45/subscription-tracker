import { NextResponse } from "next/server";
import { parseCsv, detectRecurring } from "@/lib/importUtils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const csvText = body.csv as string | undefined;

    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json(
        { error: "csv is required" },
        { status: 400 }
      );
    }

    const transactions = parseCsv(csvText);
    const suggestions = detectRecurring(transactions);

    return NextResponse.json({ suggestions });
  } catch (err: any) {
    console.error("IMPORT ERROR", err);
    return NextResponse.json(
        { error: "Failed to analyze CSV", details: String(err?.message || err) },
        { status: 500 }
    );
  }
}
