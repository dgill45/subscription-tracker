"use client";

import { useState } from "react";
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

      <ConnectedAccounts
        key={refreshKey}
        onDisconnect={handleConnectionChange}
        onSync={handleConnectionChange}
      />
    </div>
  );
}
