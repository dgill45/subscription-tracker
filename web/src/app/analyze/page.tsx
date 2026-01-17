'use client';

import React, { useState } from 'react';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import Link from 'next/link';

interface Suggestion {
  merchant: string;
  displayName: string;
  averageAmount: number;
  cadence: 'weekly' | 'monthly' | 'annual' | 'unknown';
  lastChargeDate: string;
  confidence: number;
  confidenceReasons: string[];
  sampleTransactions: {
    date: string;
    merchantRaw: string;
    merchant: string;
    amount: number;
    description?: string;
  }[];
}

interface AnalyzeResponse {
  suggestions: Suggestion[];
  transactionCount: number;
  existingMerchants: string[];
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function estimateNextBillDate(lastChargeDate: string, cadence: Suggestion['cadence']) {
  switch (cadence) {
    case 'weekly':
      return addDays(lastChargeDate, 7);
    case 'monthly':
      return addDays(lastChargeDate, 30);
    case 'annual':
      return addDays(lastChargeDate, 365);
    default:
      return addDays(lastChargeDate, 30);
  }
}

function choosePeriod(cadence: Suggestion['cadence']): 'weekly' | 'monthly' | 'annual' {
  if (cadence === 'annual') return 'annual';
  if (cadence === 'weekly') return 'weekly';
  return 'monthly';
}

export default function AnalyzePage() {
  const [loading, setLoading] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [transactionCount, setTransactionCount] = useState(0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [statusMsg, setStatusMsg] = useState('');
  const [months, setMonths] = useState(6);

  async function handleAnalyze() {
    setLoading(true);
    setStatusMsg('');
    setAnalyzed(false);

    try {
      const res = await fetch(`/api/plaid/analyze?months=${months}`);
      const data: AnalyzeResponse = await res.json();

      if (!res.ok) {
        setStatusMsg('Error analyzing transactions');
        setSuggestions([]);
        setSelected({});
        return;
      }

      setSuggestions(data.suggestions || []);
      setTransactionCount(data.transactionCount);
      setAnalyzed(true);

      if (data.transactionCount === 0) {
        setStatusMsg('No transactions found. Make sure you have connected a bank account and synced transactions.');
        return;
      }

      if (data.suggestions.length === 0) {
        setStatusMsg(`Analyzed ${data.transactionCount} transactions but found no recurring charges.`);
        return;
      }

      // Auto-select items with confidence >= 70%
      const sel: Record<string, boolean> = {};
      (data.suggestions || []).forEach((s: Suggestion) => {
        sel[s.merchant] = s.confidence >= 70;
      });
      setSelected(sel);

      setStatusMsg(`Found ${data.suggestions.length} potential subscriptions from ${data.transactionCount} transactions.`);
    } catch (err) {
      console.error(err);
      setStatusMsg('Network or server error.');
    } finally {
      setLoading(false);
    }
  }

  function toggleOne(merchant: string) {
    setSelected((prev) => ({
      ...prev,
      [merchant]: !prev[merchant],
    }));
  }

  async function handleAddSelected() {
    setLoading(true);
    setStatusMsg('');

    try {
      const existingRes = await fetch('/api/subscriptions');
      const existingJson = await existingRes.json();

      const existingItems: Array<{ merchant: string }> = Array.isArray(existingJson.items)
        ? existingJson.items
        : [];

      const existingMerchants = new Set(
        existingItems.map((sub) =>
          (sub.merchant || '').toLowerCase().trim()
        )
      );

      let skipped = 0;
      let created = 0;

      for (const sug of suggestions) {
        if (!selected[sug.merchant]) continue;

        const merchantName = (sug.displayName || sug.merchant || '').trim();
        const merchantKey = merchantName.toLowerCase();

        if (existingMerchants.has(merchantKey)) {
          skipped += 1;
          continue;
        }

        const period = choosePeriod(sug.cadence);
        const nextBillDate = estimateNextBillDate(sug.lastChargeDate, sug.cadence);

        const newSub = {
          merchant: merchantName,
          amount: sug.averageAmount,
          period,
          nextBillDate,
          notes: `Detected from bank transactions. cadence=${sug.cadence}`,
        };

        const res = await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSub),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          console.error('Failed to create sub', newSub, errJson);
          continue;
        }

        existingMerchants.add(merchantKey);
        created += 1;
      }

      if (created === 0 && skipped > 0) {
        setStatusMsg(`No new subscriptions added (all duplicates).`);
      } else if (created > 0 && skipped > 0) {
        setStatusMsg(`${created} added, ${skipped} skipped (duplicates).`);
      } else if (created > 0 && skipped === 0) {
        setStatusMsg(`${created} subscriptions added successfully!`);
      } else {
        setStatusMsg(`Nothing selected.`);
      }

    } catch (err) {
      console.error(err);
      setStatusMsg('Error adding subscriptions.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Detect Subscriptions
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Analyze your synced bank transactions to find recurring charges
        </p>
      </div>

      {/* Analysis Controls */}
      <Card title="Analyze Bank Transactions">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            We&apos;ll scan your synced bank transactions to detect recurring subscription charges.
            Make sure you&apos;ve <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">connected a bank account</Link> first.
          </p>

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Analyze last
            </label>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400">of transactions</span>
          </div>

          <Button onClick={handleAnalyze} disabled={loading}>
            {loading ? 'Analyzing...' : 'Detect Subscriptions'}
          </Button>
        </div>
      </Card>

      {/* Status Message */}
      {statusMsg && (
        <div className={`rounded-md p-4 border ${
          statusMsg.includes('error') || statusMsg.includes('Error') || statusMsg.includes('No transactions')
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          <p className={`text-sm font-medium ${
            statusMsg.includes('error') || statusMsg.includes('Error') || statusMsg.includes('No transactions')
              ? 'text-yellow-800 dark:text-yellow-200'
              : 'text-blue-800 dark:text-blue-200'
          }`}>
            {statusMsg}
          </p>
        </div>
      )}

      {/* Results Section */}
      {analyzed && suggestions.length > 0 && (
        <Card title={`Detected Recurring Charges (from ${transactionCount} transactions)`}>
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Items with confidence &ge;70% are auto-selected. Review all items before adding.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">
                    Select
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">
                    Merchant
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">
                    Confidence
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">
                    Avg Amount
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">
                    Cadence
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">
                    Last Charge
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">
                    Sample Transactions
                  </th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((sug) => {
                  const confidenceColor =
                    sug.confidence >= 70
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : sug.confidence >= 50
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      : 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200';

                  return (
                    <tr
                      key={sug.merchant}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!selected[sug.merchant]}
                          onChange={() => toggleOne(sug.merchant)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {sug.displayName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          ({sug.merchant})
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${confidenceColor}`}>
                            {sug.confidence}%
                          </span>
                          <details className="text-xs text-gray-600 dark:text-gray-400">
                            <summary className="cursor-pointer hover:text-gray-900 dark:hover:text-gray-200">
                              Why?
                            </summary>
                            <ul className="mt-1 ml-2 space-y-0.5 list-disc list-inside">
                              {sug.confidenceReasons.map((reason, idx) => (
                                <li key={idx}>{reason}</li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-900 dark:text-gray-100">
                        ${sug.averageAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {sug.cadence}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-900 dark:text-gray-100">
                        {sug.lastChargeDate}
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-1">
                          {sug.sampleTransactions.slice(0, 3).map((t, idx) => (
                            <div key={idx} className="text-xs">
                              <div className="text-gray-900 dark:text-gray-100">{t.date}</div>
                              <div className="text-gray-500 dark:text-gray-400">
                                ${t.amount.toFixed(2)} - {t.merchantRaw}
                              </div>
                            </div>
                          ))}
                          {sug.sampleTransactions.length > 3 && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              +{sug.sampleTransactions.length - 3} more...
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Button onClick={handleAddSelected} disabled={loading}>
              {loading ? 'Saving...' : 'Add Selected Subscriptions'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
