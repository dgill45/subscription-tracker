import Link from "next/link";
import { listSubscriptions } from "@/server/storage";
import { computeTotals } from "@/lib/types";
import { StatTile } from "@/components/StatTile";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default async function DashboardPage() {
  const subscriptions = await listSubscriptions();
  const totals = computeTotals(subscriptions);

  // Get active subscriptions and sort by next bill date
  const activeSubscriptions = subscriptions
    .filter((s) => s.status === "active")
    .sort((a, b) => a.nextBillDate.localeCompare(b.nextBillDate));

  // Get upcoming bills (next 5)
  const upcomingBills = activeSubscriptions.slice(0, 5);

  // Calculate how many days until next bill
  const getDaysUntil = (dateString: string) => {
    const billDate = new Date(dateString + "T00:00:00Z");
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const diffTime = billDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track your subscriptions and recurring charges
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile
          label="Monthly Total"
          value={totals.monthly.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })}
        />
        <StatTile
          label="Annual Total"
          value={totals.annual.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })}
        />
        <StatTile label="Active Subscriptions" value={activeSubscriptions.length} />
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions">
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/subscriptions/new">
            <Button>Add Subscription</Button>
          </Link>
          <Link href="/import">
            <Button>Import from CSV</Button>
          </Link>
          <Link href="/subscriptions">
            <Button>View All Subscriptions</Button>
          </Link>
        </div>
      </Card>

      {/* Upcoming Bills */}
      <Card title="Upcoming Bills">
        {upcomingBills.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No upcoming bills. Add a subscription to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {upcomingBills.map((sub) => {
              const daysUntil = getDaysUntil(sub.nextBillDate);
              const isOverdue = daysUntil < 0;
              const isDueSoon = daysUntil >= 0 && daysUntil <= 7;

              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {sub.merchant}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {sub.nextBillDate} • {sub.period}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {sub.amount.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                      })}
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        isOverdue
                          ? "text-red-600 dark:text-red-400"
                          : isDueSoon
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {isOverdue
                        ? `${Math.abs(daysUntil)} days overdue`
                        : daysUntil === 0
                        ? "Due today"
                        : daysUntil === 1
                        ? "Due tomorrow"
                        : `In ${daysUntil} days`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {upcomingBills.length > 0 && activeSubscriptions.length > 5 && (
          <div className="mt-4 text-center">
            <Link
              href="/subscriptions"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all {activeSubscriptions.length} subscriptions →
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
