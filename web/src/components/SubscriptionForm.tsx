"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";
import type { SubscriptionInput } from "@/lib/types";


export function SubscriptionForm() {
const router = useRouter();
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);


async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
e.preventDefault();
setError(null);
const form = e.currentTarget;
const formData = new FormData(form);
const payload: SubscriptionInput = {
merchant: String(formData.get("merchant") ?? "").trim(),
amount: Number(formData.get("amount")),
period: (formData.get("period") as "monthly" | "annual") ?? "monthly",
nextBillDate: String(formData.get("nextBillDate") ?? ""),
notes: (String(formData.get("notes") ?? "").trim() || undefined),
};


setLoading(true);
const res = await fetch("/api/subscriptions", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});
setLoading(false);
if (!res.ok) {
const j = await res.json().catch(() => ({}));
setError(j?.details?.join?.(", ") || j?.error || "Failed to save");
return;
}
router.push("/subscriptions");
router.refresh();
}


return (
<form onSubmit={onSubmit} className="space-y-3">
{error && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
<input name="merchant" placeholder="Merchant (e.g., Netflix)" className="w-full rounded border px-3 py-2" required />
<input name="amount" type="number" step="0.01" min="0" placeholder="Amount (e.g., 15.99)" className="w-full rounded border px-3 py-2" required />
<select name="period" className="w-full rounded border px-3 py-2">
<option value="monthly">Monthly</option>
<option value="annual">Annual</option>
</select>
<input name="nextBillDate" type="date" className="w-full rounded border px-3 py-2" required />
</div>
<textarea name="notes" placeholder="Notes (optional)" className="w-full rounded border px-3 py-2" />
<Button disabled={loading}>{loading ? "Saving…" : "Save subscription"}</Button>
</form>
);
}