export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createSubscription, listSubscriptions } from "@/server/storage";
import { validateSubscriptionInput } from "@/lib/types";


export async function GET() {
const subs = await listSubscriptions();
return NextResponse.json({ items: subs });
}


export async function POST(req: NextRequest) {
try {
const body = await req.json();
const valid = validateSubscriptionInput(body);
if (valid.ok !== true) {
return NextResponse.json({ error: "validation failed", details: valid.errors }, { status: 400 });
}
const sub = await createSubscription(body);
return NextResponse.json(sub, { status: 201 });
} catch (err: any) {
return NextResponse.json({ error: "bad request", details: String(err?.message || err) }, { status: 400 });
}
}