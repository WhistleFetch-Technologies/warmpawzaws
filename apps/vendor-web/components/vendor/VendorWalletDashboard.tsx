'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

interface VendorWalletTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  timestamp: string;
}

interface VendorWalletResponse {
  success?: boolean;
  data?: {
    vendorId: string;
    balance: number;
    currency: string;
    lastUpdated: string;
    recentTransactions: VendorWalletTransaction[];
    loyaltyPointsConverted: number;
    loyaltyTransactionsCount: number;
  };
}

interface VendorWalletDashboardProps {
  vendorId: string;
}

export function VendorWalletDashboard({ vendorId }: VendorWalletDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<VendorWalletResponse['data'] | null>(null);
  const [transactions, setTransactions] = useState<VendorWalletTransaction[]>([]);

  useEffect(() => {
    const loadWallet = async () => {
      setLoading(true);
      setError(null);
      try {
        const [walletRes, txRes] = await Promise.allSettled([
          apiClient.get<VendorWalletResponse>(`/vendor/wallet/${vendorId}`),
          apiClient.get<{ transactions: VendorWalletTransaction[] }>(
            `/vendor/wallet/${vendorId}/transactions?limit=20`
          ),
        ]);
        if (walletRes.status === 'fulfilled') {
          setWallet(walletRes.value?.data || null);
        }
        if (txRes.status === 'fulfilled') {
          setTransactions(txRes.value?.transactions || []);
        }
        if (walletRes.status === 'rejected' && txRes.status === 'rejected') {
          setError('Failed to load wallet data. Please try again.');
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load vendor wallet');
      } finally {
        setLoading(false);
      }
    };

    loadWallet();
  }, [vendorId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-[430px] mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">Vendor Wallet</h1>
            <p className="text-xs text-gray-600 mt-0.5">Track wallet credits and transactions</p>
          </div>
          <Link href="/finance/settlements" className="text-xs text-orange-700 hover:text-orange-800 font-medium whitespace-nowrap min-h-[44px] flex items-center">
            View Settlements
          </Link>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{error}</div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-orange-100 p-5">
            <p className="text-sm text-gray-500">Current Balance</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {wallet?.currency || 'INR'} {Number(wallet?.balance || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-orange-100 p-5">
            <p className="text-sm text-gray-500">Loyalty Converted</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {wallet?.currency || 'INR'} {Number(wallet?.loyaltyPointsConverted || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-orange-100 p-5">
            <p className="text-sm text-gray-500">Loyalty Transactions</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{wallet?.loyaltyTransactionsCount || 0}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-orange-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Wallet Transactions</h2>
          {transactions.length === 0 ? (
            <p className="text-sm text-gray-500">No wallet transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Balance After</th>
                    <th className="py-2 pr-4">Reference</th>
                    <th className="py-2 pr-4">When</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 capitalize">{tx.type}</td>
                      <td className="py-2 pr-4">{Number(tx.amount).toFixed(2)}</td>
                      <td className="py-2 pr-4">{Number(tx.balanceAfter).toFixed(2)}</td>
                      <td className="py-2 pr-4">{tx.referenceType || '-'}</td>
                      <td className="py-2 pr-4">{new Date(tx.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

