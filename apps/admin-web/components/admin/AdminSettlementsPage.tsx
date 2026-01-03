'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Settlement {
  id: string;
  vendor_id: string;
  vendor_name?: string;
  total_amount: number;
  commission_amount: number;
  net_amount: number;
  settlement_status: string;
  settlement_period_start: string;
  settlement_period_end: string;
  created_at: string;
  processed_at?: string;
}

interface SettlementStats {
  totalPending: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  pendingAmount: number;
  completedAmount: number;
}

export function AdminSettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [stats, setStats] = useState<SettlementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const [settlementsRes, statsRes] = await Promise.all([
        apiClient.get<any>(`/admin/settlements${params}`),
        apiClient.get<any>('/admin/settlements/stats'),
      ]);
      if (settlementsRes.success) setSettlements(settlementsRes.settlements || []);
      if (statsRes.success) setStats(statsRes.stats);
    } catch (err) {
      console.error('Error loading settlements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDailySettlement = async () => {
    if (!confirm('This will calculate settlements for all eligible bookings. Continue?')) return;
    setProcessing(true);
    try {
      await apiClient.post('/settlements/calculate-daily', {});
      alert('Daily settlement calculation completed');
      loadData();
    } catch (err) {
      console.error('Error calculating settlements:', err);
      alert('Failed to calculate settlements');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessPayouts = async () => {
    if (!confirm('This will process payouts for all pending settlements. Continue?')) return;
    setProcessing(true);
    try {
      await apiClient.post('/settlements/process-payouts', {});
      alert('Payouts processed successfully');
      loadData();
    } catch (err) {
      console.error('Error processing payouts:', err);
      alert('Failed to process payouts');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settlements & Payouts</h1>
        <div className="flex gap-3">
          <button
            onClick={handleTriggerDailySettlement}
            disabled={processing}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {processing ? 'Processing...' : '📊 Calculate Daily'}
          </button>
          <button
            onClick={handleProcessPayouts}
            disabled={processing}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            {processing ? 'Processing...' : '💸 Process Payouts'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">⏳</div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalPending}</p>
                <p className="text-sm text-gray-400">₹{stats.pendingAmount?.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">⚙️</div>
              <div>
                <p className="text-sm text-gray-500">Processing</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalProcessing}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">✅</div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalCompleted}</p>
                <p className="text-sm text-gray-400">₹{stats.completedAmount?.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">❌</div>
              <div>
                <p className="text-sm text-gray-500">Failed</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalFailed}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex bg-white rounded-lg p-1 shadow-sm mb-6 w-fit">
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'Pending' },
          { id: 'processing', label: 'Processing' },
          { id: 'completed', label: 'Completed' },
          { id: 'failed', label: 'Failed' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === tab.id ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Settlement ID</th>
                <th className="text-left p-4 font-medium text-gray-600">Vendor</th>
                <th className="text-left p-4 font-medium text-gray-600">Period</th>
                <th className="text-right p-4 font-medium text-gray-600">Gross</th>
                <th className="text-right p-4 font-medium text-gray-600">Commission</th>
                <th className="text-right p-4 font-medium text-gray-600">Net Payout</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {settlements.map((settlement) => (
                <tr key={settlement.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <span className="font-mono text-sm text-gray-600">
                      {settlement.id.slice(0, 8)}...
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{settlement.vendor_name || 'Vendor'}</p>
                    <p className="text-xs text-gray-400">{settlement.vendor_id.slice(0, 8)}</p>
                  </td>
                  <td className="p-4 text-sm text-gray-600">
                    {new Date(settlement.settlement_period_start).toLocaleDateString()} - {new Date(settlement.settlement_period_end).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right font-medium text-gray-900">
                    ₹{settlement.total_amount.toLocaleString()}
                  </td>
                  <td className="p-4 text-right text-sm text-red-600">
                    -₹{settlement.commission_amount.toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-bold text-green-600">
                    ₹{settlement.net_amount.toLocaleString()}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(settlement.settlement_status)}`}>
                      {settlement.settlement_status}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(settlement.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {settlements.length === 0 && (
            <div className="text-center py-12">
              <span className="text-5xl">📋</span>
              <p className="mt-4 text-gray-500">No settlements found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

