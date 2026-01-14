"use client";

import { useCallback, useEffect, useState } from "react";
import {
  usePlaidLink,
  PlaidLinkOnSuccess,
  PlaidLinkOnExit,
  PlaidLinkOptions,
} from "react-plaid-link";

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  onExit?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function PlaidLinkButton({
  onSuccess,
  onExit,
  className,
  children,
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch link token on mount
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        const response = await fetch("/api/plaid/link-token", {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error("Failed to get link token");
        }

        const data = await response.json();
        setLinkToken(data.linkToken);
      } catch (err) {
        console.error("Error fetching link token:", err);
        setError("Unable to connect to banking service");
      }
    };

    fetchLinkToken();
  }, []);

  const handleSuccess: PlaidLinkOnSuccess = useCallback(
    async (publicToken, metadata) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            publicToken,
            metadata,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to connect bank");
        }

        // Trigger initial transaction sync
        await fetch("/api/plaid/sync", {
          method: "POST",
        });

        onSuccess?.();
      } catch (err) {
        console.error("Error exchanging token:", err);
        setError(err instanceof Error ? err.message : "Failed to connect bank");
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess]
  );

  const handleExit: PlaidLinkOnExit = useCallback(
    (err) => {
      if (err) {
        console.error("Plaid Link exit error:", err);
      }
      onExit?.();
    },
    [onExit]
  );

  const config: PlaidLinkOptions = {
    token: linkToken,
    onSuccess: handleSuccess,
    onExit: handleExit,
  };

  const { open, ready } = usePlaidLink(config);

  const handleClick = () => {
    if (ready && !isLoading) {
      open();
    }
  };

  if (error) {
    return (
      <div className="text-red-600 text-sm">
        {error}
        <button
          onClick={() => window.location.reload()}
          className="ml-2 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={!ready || isLoading}
      className={
        className ||
        "inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      }
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Connecting...
        </>
      ) : (
        children || "Connect Bank Account"
      )}
    </button>
  );
}

// Connected accounts display component
interface ConnectedAccount {
  id: string;
  institutionName: string;
  status: string;
  lastSyncedAt: string | null;
  accounts: Array<{
    accountId: string;
    name: string;
    type: string;
    mask: string | null;
    currentBalance: number | null;
  }>;
}

interface ConnectedAccountsProps {
  onDisconnect?: () => void;
  onSync?: () => void;
}

export function ConnectedAccounts({
  onDisconnect,
  onSync,
}: ConnectedAccountsProps) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/plaid/accounts");
      if (!response.ok) {
        throw new Error("Failed to fetch accounts");
      }
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
      setError("Failed to load connected accounts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm("Are you sure you want to disconnect this bank account?")) {
      return;
    }

    try {
      const response = await fetch(`/api/plaid/accounts?id=${connectionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect");
      }

      await fetchAccounts();
      onDisconnect?.();
    } catch (err) {
      console.error("Error disconnecting:", err);
      setError("Failed to disconnect bank account");
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/plaid/sync", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to sync");
      }

      const data = await response.json();
      alert(`Synced ${data.summary?.added || 0} new transactions`);
      await fetchAccounts();
      onSync?.();
    } catch (err) {
      console.error("Error syncing:", err);
      setError("Failed to sync transactions");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-20 bg-gray-200 rounded-lg" />
        <div className="h-20 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 text-sm">{error}</div>;
  }

  if (accounts.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        <p>No bank accounts connected</p>
        <p className="text-sm mt-1">
          Connect a bank account to automatically track your subscriptions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Connected Accounts</h3>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          {isSyncing ? "Syncing..." : "Sync All"}
        </button>
      </div>

      {accounts.map((connection) => (
        <div
          key={connection.id}
          className="border rounded-lg p-4 bg-white shadow-sm"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-medium">{connection.institutionName}</h4>
              <p className="text-xs text-gray-500">
                {connection.status === "active" ? (
                  connection.lastSyncedAt ? (
                    `Last synced: ${new Date(connection.lastSyncedAt).toLocaleDateString()}`
                  ) : (
                    "Never synced"
                  )
                ) : (
                  <span className="text-red-600">
                    Status: {connection.status}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => handleDisconnect(connection.id)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Disconnect
            </button>
          </div>

          <div className="space-y-2">
            {connection.accounts.map((account) => (
              <div
                key={account.accountId}
                className="flex justify-between items-center text-sm bg-gray-50 rounded px-3 py-2"
              >
                <div>
                  <span className="font-medium">{account.name}</span>
                  {account.mask && (
                    <span className="text-gray-500 ml-2">
                      ****{account.mask}
                    </span>
                  )}
                  <span className="text-gray-400 ml-2 text-xs capitalize">
                    {account.type}
                  </span>
                </div>
                {account.currentBalance !== null && (
                  <span className="font-medium">
                    ${account.currentBalance.toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
