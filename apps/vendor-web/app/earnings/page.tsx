'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface EarningsSummary {
  totalEarnings: number;
  pendingSettlement: number;
  lastSettlement: number;
  thisMonth: number;
  lastMonth: number;
  totalBookings: number;
  completedBookings: number;
  averageBookingValue: number;
}

interface Transaction {
  id: string;
  type: 'booking' | 'settlement' | 'refund' | 'commission';
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

export default function EarningsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) {
      router.push('/onboarding');
      return;
    }
    loadEarnings();
  }, [router, period]);

  const loadEarnings = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (vendorId) {
        // ✅ Load real data from backend
        const [dashboardRes, settlementsRes, transactionsRes] = await Promise.all([
          apiClient.get<any>(`/vendor/${vendorId}/dashboard?timeframe=${period}`).catch(() => ({ success: false })),
          apiClient.get<any>(`/vendor/${vendorId}/settlements?summary=true`).catch(() => ({ success: false })),
          apiClient.get<{ transactions: Transaction[] }>(`/vendor/${vendorId}/transactions?period=${period}`).catch(() => ({ transactions: [] })),
        ]);
        
        // Extract earnings from dashboard stats
        const dashboardStats = dashboardRes?.stats || dashboardRes?.data?.stats || {};
        const settlementSummary = settlementsRes?.summary || {};
        
        // Calculate earnings from real data
        const completedEarnings = dashboardStats.earnings || 0;
        const pendingAmount = settlementSummary.pending_amount || settlementSummary.pendingAmount || 0;
        const settledAmount = settlementSummary.total_settled || settlementSummary.totalSettled || 0;
        
        setSummary({
          totalEarnings: completedEarnings + settledAmount,
          pendingSettlement: pendingAmount,
          lastSettlement: settlementSummary.last_settlement || 0,
          thisMonth: dashboardStats.thisMonthEarnings || completedEarnings,
          lastMonth: dashboardStats.lastMonthEarnings || 0,
          totalBookings: dashboardStats.totalBookings || dashboardStats.appointments || 0,
          completedBookings: dashboardStats.completedServices || dashboardStats.completedBookings || 0,
          averageBookingValue: dashboardStats.averageBookingValue || 
            (dashboardStats.totalBookings > 0 ? completedEarnings / dashboardStats.totalBookings : 0),
        });
        
        setTransactions(transactionsRes.transactions || []);
      }
    } catch (err) {
      console.error('Error loading earnings:', err);
      // Set default values
      setSummary({
        totalEarnings: 0,
        pendingSettlement: 0,
        lastSettlement: 0,
        thisMonth: 0,
        lastMonth: 0,
        totalBookings: 0,
        completedBookings: 0,
        averageBookingValue: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const requestPayout = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.post(`/settlements/request`, { vendorId });
      loadEarnings();
    } catch (err) {
      console.error('Error requesting payout:', err);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'booking': return '📅';
      case 'settlement': return '💸';
      case 'refund': return '↩️';
      case 'commission': return '💰';
      default: return '💵';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'booking': return 'text-green-600';
      case 'settlement': return 'text-blue-600';
      case 'refund': return 'text-red-600';
      case 'commission': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header - Match consistency pattern: max-w-7xl mx-auto px-6 py-4 */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {/* ✅ FIX: Match consistency - text-2xl font-bold */}
              <h1 className="text-2xl font-bold text-gray-800">Earnings</h1>
              <p className="text-sm text-gray-500 mt-1">Track your revenue and settlements</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                ← Back
              </button>
              <div className="flex bg-white rounded-lg shadow-sm">
                {(['week', 'month', 'year'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-2 capitalize transition ${
                      period === p ? 'bg-orange-500 text-white rounded-lg' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 or p-8 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-gray-500 text-sm">Total Earnings</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">₹{summary?.totalEarnings.toLocaleString()}</p>
            <p className="text-green-600 text-sm mt-2">+{summary?.completedBookings} bookings</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-gray-500 text-sm">Pending Settlement</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">₹{summary?.pendingSettlement.toLocaleString()}</p>
            {summary?.pendingSettlement ? (
              <button
                onClick={requestPayout}
                className="mt-2 text-orange-600 text-sm font-medium hover:underline"
              >
                Request Payout →
              </button>
            ) : (
              <p className="text-gray-400 text-sm mt-2">No pending amount</p>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-gray-500 text-sm">This Month</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">₹{summary?.thisMonth.toLocaleString()}</p>
            <p className={`text-sm mt-2 ${
              (summary?.thisMonth || 0) > (summary?.lastMonth || 0) ? 'text-green-600' : 'text-red-600'
            }`}>
              {((summary?.thisMonth || 0) > (summary?.lastMonth || 0) ? '+' : '')}
              {summary?.lastMonth ? (((summary.thisMonth - summary.lastMonth) / summary.lastMonth) * 100).toFixed(1) : 0}% vs last month
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-gray-500 text-sm">Average Booking</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">₹{summary?.averageBookingValue.toLocaleString()}</p>
            <p className="text-gray-400 text-sm mt-2">{summary?.totalBookings} total bookings</p>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Transaction History</h2>
          
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getTransactionIcon(transaction.type)}</span>
                    <div>
                      <p className="font-medium text-gray-800">{transaction.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(transaction.created_at).toLocaleDateString()} •{' '}
                        <span className="capitalize">{transaction.type}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                      {transaction.type === 'refund' || transaction.type === 'commission' ? '-' : '+'}
                      ₹{transaction.amount.toLocaleString()}
                    </p>
                    <p className={`text-xs ${
                      transaction.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {transaction.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

