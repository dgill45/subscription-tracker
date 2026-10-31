export type Period = "weekly" | "monthly" | "annual";


export type SubStatus = "active" | "canceled";


export interface Subscription {
id: string;
userId: string; // derived from authenticated session (NextAuth)
userid?: string; // for DynamoDB PK(legacy naming)
merchant: string;
amount: number; // positive, USD for now
period: Period;
nextBillDate: string; // ISO date (YYYY-MM-DD)
notes?: string;
status: SubStatus;
createdAt: string; // ISO timestamp
updatedAt: string; // ISO timestamp
}


export interface SubscriptionInput {
merchant: string;
amount: number;
period: Period;
nextBillDate: string;
notes?: string;
}


const MAX_MERCHANT_LENGTH = 200;
const MAX_NOTES_LENGTH = 1000;
const MAX_AMOUNT = 1_000_000;

// Checks only the fields present in data; callers decide which are required
function validateFields(data: Record<string, unknown>): string[] {
const errors: string[] = [];
if ("merchant" in data && (typeof data.merchant !== "string" || !data.merchant.trim() || data.merchant.length > MAX_MERCHANT_LENGTH)) errors.push(`merchant must be 1-${MAX_MERCHANT_LENGTH} characters`);
if ("amount" in data && (typeof data.amount !== "number" || !Number.isFinite(data.amount) || data.amount <= 0 || data.amount > MAX_AMOUNT)) errors.push("amount must be a positive number");
if ("period" in data && data.period !== "weekly" && data.period !== "monthly" && data.period !== "annual") errors.push("period must be 'weekly', 'monthly', or 'annual'");
if ("nextBillDate" in data && (typeof data.nextBillDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.nextBillDate) || Number.isNaN(new Date(data.nextBillDate).getTime()))) errors.push("nextBillDate must be YYYY-MM-DD");
if ("notes" in data && data.notes !== undefined && data.notes !== null && (typeof data.notes !== "string" || data.notes.length > MAX_NOTES_LENGTH)) errors.push(`notes must be at most ${MAX_NOTES_LENGTH} characters`);
return errors;
}


export function validateSubscriptionInput(input: unknown): { ok: true } | { ok: false; errors: string[] } {
if (!input || typeof input !== "object") {
  return { ok: false, errors: ["payload missing"] };
}
const data = input as Record<string, unknown>;
const errors: string[] = [];
for (const k of ["merchant", "amount", "period", "nextBillDate"]) if (!(k in data)) errors.push(`${k} required`);
errors.push(...validateFields(data));
return errors.length ? { ok: false, errors } : { ok: true };
}


export function validateSubscriptionPatch(input: unknown): { ok: true; patch: Partial<SubscriptionInput> } | { ok: false; errors: string[] } {
if (!input || typeof input !== "object") {
  return { ok: false, errors: ["payload missing"] };
}
const data = input as Record<string, unknown>;
const patch: Record<string, unknown> = {};
for (const k of ["merchant", "amount", "period", "nextBillDate", "notes"] as const) if (k in data) patch[k] = data[k];
const errors = validateFields(patch);
return errors.length ? { ok: false, errors } : { ok: true, patch: patch as Partial<SubscriptionInput> };
}


export function computeTotals(subs: Subscription[]) {
const monthly = subs
.filter((s) => s.status === "active")
.reduce((sum, s) => {
  if (s.period === "monthly") return sum + s.amount;
  if (s.period === "annual") return sum + (s.amount / 12);
  if (s.period === "weekly") return sum + (s.amount * 52 / 12);
  return sum;
}, 0);
const annual = monthly * 12;
return { monthly, annual };
}