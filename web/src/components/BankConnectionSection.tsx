"use client";

import { useState } from "react";
import Link from "next/link";
import { PlaidLinkButton, ConnectedAccounts } from "./PlaidLink";

export function BankConnectionSection() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleConnectionChange = () => {
    // Force refresh of connected accounts list
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Bank Connections
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Connect your bank to automatically detect subscriptions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/analyze"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            Detect Subscriptions
          </Link>
          <PlaidLinkButton onSuccess={handleConnectionChange}>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Connect Bank
          </PlaidLinkButton>
        </div>
      </div>

      <ConnectedAccounts
        key={refreshKey}
        onDisconnect={handleConnectionChange}
        onSync={handleConnectionChange}
      />
    </div>
  );
}
