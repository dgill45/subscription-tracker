'use client';

import { useState, useMemo } from 'react';
import { Subscription } from '@/lib/types';
import { DeleteButton } from './DeleteButton';

type SortField = 'merchant' | 'amount' | 'nextBillDate' | 'status' | 'period';
type SortDirection = 'asc' | 'desc';

interface SubscriptionsTableProps {
  subscriptions: Subscription[];
}

export function SubscriptionsTable({ subscriptions }: SubscriptionsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('nextBillDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'canceled'>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'weekly' | 'monthly' | 'annual'>('all');

  const filteredAndSorted = useMemo(() => {
    let result = [...subscriptions];

    // Apply search filter
    if (searchTerm) {
      result = result.filter((sub) =>
        sub.merchant.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((sub) => sub.status === statusFilter);
    }

    // Apply period filter
    if (periodFilter !== 'all') {
      result = result.filter((sub) => sub.period === periodFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'merchant':
          aVal = a.merchant.toLowerCase();
          bVal = b.merchant.toLowerCase();
          break;
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        case 'nextBillDate':
          aVal = a.nextBillDate;
          bVal = b.nextBillDate;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'period':
          aVal = a.period;
          bVal = b.period;
          break;
        default:
          aVal = a.nextBillDate;
          bVal = b.nextBillDate;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [subscriptions, searchTerm, sortField, sortDirection, statusFilter, periodFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return (
      <span className="ml-1">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Search
          </label>
          <input
            id="search"
            type="text"
            placeholder="Search merchants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Status
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>

        {/* Period Filter */}
        <div>
          <label htmlFor="period" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Period
          </label>
          <select
            id="period"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>

        {/* Results count */}
        <div className="flex items-end">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredAndSorted.length} of {subscriptions.length} subscriptions
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredAndSorted.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400 py-8 text-center">
          No subscriptions match your filters.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left">
              <tr>
                <th
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('merchant')}
                >
                  Merchant <SortIcon field="merchant" />
                </th>
                <th
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('amount')}
                >
                  Amount <SortIcon field="amount" />
                </th>
                <th
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('period')}
                >
                  Period <SortIcon field="period" />
                </th>
                <th
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('nextBillDate')}
                >
                  Next Bill <SortIcon field="nextBillDate" />
                </th>
                <th
                  className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900">
              {filteredAndSorted.map((sub) => (
                <tr key={sub.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{sub.merchant}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                    {sub.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {sub.period}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{sub.nextBillDate}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        sub.status === 'active'
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 flex gap-2">
                    <a
                      href={`/subscriptions/${sub.id}/edit`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Edit
                    </a>
                    <DeleteButton id={sub.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
