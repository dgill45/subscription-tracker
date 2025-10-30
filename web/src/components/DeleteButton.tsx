"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm("Delete this subscription?")) return;
    setBusy(true);
    await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }
  return <Button onClick={del} disabled={busy}>{busy ? "Deleting…" : "Delete"}</Button>;
}
