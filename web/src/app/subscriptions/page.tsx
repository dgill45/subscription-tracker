import Link from "next/link";
import { listSubscriptions } from "@/server/storage";
import { computeTotals } from "@/lib/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatTile } from "@/components/StatTile";
import { SubscriptionsTable } from "@/components/SubscriptionsTable";

export default async function SubscriptionsPage() {
  const subs = await listSubscriptions();
  const totals = computeTotals(subs);
  const activeSubs = subs.filter((s) => s.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Subscriptions</h1>
        <Link href="/subscriptions/new">
          <Button>Add subscription</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          label="Monthly total"
          value={totals.monthly.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        />
        <StatTile
          label="Annualized"
          value={totals.annual.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        />
        <StatTile label="Active subs" value={activeSubs.length} />
      </div>

      <Card title="Your subscriptions">
        {subs.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">No subscriptions yet.</p>
        ) : (
          <SubscriptionsTable subscriptions={subs} />
        )}
      </Card>
    </div>
  );
}