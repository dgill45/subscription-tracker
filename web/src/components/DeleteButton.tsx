"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    if (!confirm("Delete this subscription?")) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete subscription");
        setBusy(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={del} disabled={busy}>{busy ? "Deleting…" : "Delete"}</Button>
      {error && <span style={{ color: "red", fontSize: "0.85rem", marginLeft: "0.5rem" }}>{error}</span>}
    </>
  );
}
