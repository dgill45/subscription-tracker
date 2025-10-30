"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Subscription, SubscriptionInput } from "@/lib/types";
import { Button } from "@/components/Button";

export function EditSubscriptionForm({ initial }: { initial: Subscription }) {
  const router = useRouter();
  const [form, setForm] = useState<SubscriptionInput>({
    merchant: initial.merchant,
    amount: initial.amount,
    period: initial.period,
    nextBillDate: initial.nextBillDate,
    notes: initial.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SubscriptionInput>(key: K, value: SubscriptionInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/subscriptions/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j?.error || "Failed to update");
      return;
    }
    router.push("/subscriptions");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 rounded border px-3 py-2"
               value={form.merchant} onChange={(e) => update("merchant", e.target.value)} />
        <input type="number" step="0.01" min="0"
               className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 rounded border px-3 py-2"
               value={form.amount ? String(form.amount) : ""} onChange={(e) => update("amount", e.target.value === "" ? 0 : Number(e.target.value))} />
        <select className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 rounded border px-3 py-2"
                value={form.period} onChange={(e) => update("period", e.target.value as "monthly" | "annual")}>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
        <input type="date"
               className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 rounded border px-3 py-2"
               value={form.nextBillDate} onChange={(e) => update("nextBillDate", e.target.value)} />
      </div>
      <textarea className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100 rounded border px-3 py-2"
                value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} />
      <Button disabled={loading}>{loading ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}
