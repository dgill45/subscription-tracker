export type Period = "monthly" | "annual";

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

export function validateSubscriptionInput(input: any): { ok: true } | { ok: false; errors: string[] } {
const errors: string[] = [];
if (!input || typeof input !== "object") errors.push("payload missing");
if (!input.merchant || typeof input.merchant !== "string") errors.push("merchant required");
const amount = Number(input.amount);
if (!Number.isFinite(amount) || amount <= 0) errors.push("amount must be a positive number");
if (input.period !== "monthly" && input.period !== "annual") errors.push("period must be 'monthly' or 'annual'");
if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.nextBillDate))) errors.push("nextBillDate must be YYYY-MM-DD");
return errors.length ? { ok: false, errors } : { ok: true };
}


export function computeTotals(subs: Subscription[]) {
const monthly = subs
.filter((s) => s.status === "active")
.reduce((sum, s) => sum + (s.period === "monthly" ? s.amount : s.amount / 12), 0);
const annual = monthly * 12;
return { monthly, annual };
}
