export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionById, updateSubscription, deleteSubscription } from "@/server/storage";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const sub = await getSubscriptionById(id);
  if (!sub) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(sub);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const allowed = ["merchant", "amount", "period", "nextBillDate", "notes"] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = (body as any)[k];

  if ("amount" in patch && (!Number.isFinite(Number(patch.amount)) || Number(patch.amount) <= 0))
    return NextResponse.json({ error: "amount must be positive" }, { status: 400 });

  const updated = await updateSubscription(id, patch);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await deleteSubscription(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
