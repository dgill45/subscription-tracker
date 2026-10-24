export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createSubscription, listSubscriptions } from "@/server/storage";
import { validateSubscriptionInput } from "@/lib/types";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subs = await listSubscriptions(session.user.id);
  return NextResponse.json({ items: subs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const valid = validateSubscriptionInput(body);
  if (valid.ok !== true) {
    return NextResponse.json({ error: "validation failed", details: valid.errors }, { status: 400 });
  }

  try {
    const sub = await createSubscription(session.user.id, body);
    return NextResponse.json(sub, { status: 201 });
  } catch (err: unknown) {
    console.error("CREATE SUBSCRIPTION ERROR", err);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
