import Link from "next/link";
import { listSubscriptions } from "@/server/storage";
import { computeTotals } from "@/lib/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { StatTile } from "@/components/StatTile";


export default async function SubscriptionsPage() {
const subs = await listSubscriptions();
const totals = computeTotals(subs);


return (
<div className="space-y-6">
<div className="flex items-center justify-between">
<h1 className="text-2xl font-semibold">Subscriptions</h1>
<Link href="/subscriptions/new">
<Button>Add subscription</Button>
</Link>
</div>


<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
<StatTile label="Monthly total" value={totals.monthly.toLocaleString(undefined, { style: "currency", currency: "USD" })} />
<StatTile label="Annualized" value={(totals.annual).toLocaleString(undefined, { style: "currency", currency: "USD" })} />
<StatTile label="Active subs" value={subs.length} />
</div>


<Card title="Your subscriptions">
{subs.length === 0 ? (
<p className="text-sm text-gray-600">No subscriptions yet.</p>
) : (
<div className="overflow-hidden rounded-md border">
<table className="w-full text-sm">
<thead className="bg-gray-50 text-left">
<tr>
<th className="px-3 py-2">Merchant</th>
<th className="px-3 py-2">Amount</th>
<th className="px-3 py-2">Period</th>
<th className="px-3 py-2">Next bill</th>
<th className="px-3 py-2">Status</th>
</tr>
</thead>
<tbody>
{subs.map((s) => (
<tr key={s.id} className="border-t">
<td className="px-3 py-2">{s.merchant}</td>
<td className="px-3 py-2">{s.amount.toLocaleString(undefined, { style: "currency", currency: "USD" })}</td>
<td className="px-3 py-2">{s.period}</td>
<td className="px-3 py-2">{s.nextBillDate}</td>
<td className="px-3 py-2">{s.status}</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</Card>
</div>
);
}