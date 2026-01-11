export type Period = "weekly" | "monthly" | "annual";


export type SubStatus = "active" | "canceled";


export interface Subscription {
id: string;
userId: string; // placeholder until Cognito; using "demo-user" for now
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


export function validateSubscriptionInput(input: unknown): { ok: true } | { ok: false; errors: string[] } {
const errors: string[] = [];
if (!input || typeof input !== "object") {
  errors.push("payload missing");
  return { ok: false, errors };
}
const data = input as Record<string, unknown>;
if (!data.merchant || typeof data.merchant !== "string") errors.push("merchant required");
const amount = Number(data.amount);
if (!Number.isFinite(amount) || amount <= 0) errors.push("amount must be a positive number");
if (data.period !== "weekly" && data.period !== "monthly" && data.period !== "annual") errors.push("period must be 'weekly', 'monthly', or 'annual'");
if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.nextBillDate))) errors.push("nextBillDate must be YYYY-MM-DD");
return errors.length ? { ok: false, errors } : { ok: true };
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