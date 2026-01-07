'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Settlement {
  id: string;
  total_amount: number;
  commission_amount: number;
  net_amount: number;
  settlement_status: string;
  settlement_period_start: string;
  settlement_period_end: string;
  processed_at?: string;
}

interface EarningsStats {
  totalEarnings: number;
  pendingSettlement: number;
  completedSettlement: number;
  totalBookings: number;
  commissionPaid: number;
}

interface VendorEarningsPageProps {
  vendorId: string;
}

export function VendorEarningsPage({ vendorId }: VendorEarningsPageProps) {
  const [stats, setStats] = useState<EarningsStats | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadData();
  }, [vendorId, timeRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settlementsRes, statsRes] = await Promise.all([
        apiClient.get<any>(`/settlements/vendor/${vendorId}?timeRange=${timeRange}`),
        apiClient.get<any>(`/analytics/vendor/${vendorId}/earnings?timeRange=${timeRange}`),
      ]);
      
      if (settlementsRes.success) {
        setSettlements(settlementsRes.settlements || []);
      }
      if (statsRes.success) {
        setStats(statsRes.stats);
      }
    } catch (err) {
      console.error('Error loading earnings:', err);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Earnings & Settlements</h1>
        <div className="flex bg-white rounded-lg p-1 shadow-sm">
          {[
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: '90d', label: '90 Days' },
            { id: 'all', label: 'All Time' },
          ].map((period) => (
            <button
              key={period.id}
              onClick={() => setTimeRange(period.id as any)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                timeRange === period.id
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-lg">💰</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Earnings</p>
              <p className="text-xl font-bold text-gray-900">₹{(stats?.totalEarnings || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <span className="text-lg">⏳</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Settlement</p>
              <p className="text-xl font-bold text-gray-900">₹{(stats?.pendingSettlement || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-lg">✅</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Settled Amount</p>
              <p className="text-xl font-bold text-gray-900">₹{(stats?.completedSettlement || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-lg">📊</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Platform Commission</p>
              <p className="text-xl font-bold text-gray-900">₹{(stats?.commissionPaid || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Commission Info */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Your Commission Rate</p>
            <p className="text-2xl font-bold">15%</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">Current Tier</p>
            <p className="text-xl font-bold">🥈 Silver</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">Next Payout</p>
            <p className="text-lg font-bold">Every Tuesday</p>
          </div>
        </div>
      </div>

      {/* Settlement History */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Settlement History</h2>
        </div>
        
        {settlements.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl">📋</span>
            <p className="mt-4 text-gray-500">No settlements yet</p>
          </div>
        ) : (
          <div className="divide-y">
            {settlements.map((settlement) => (
              <div key={settlement.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        Settlement #{settlement.id.slice(0, 8)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(settlement.settlement_status)}`}>
                        {settlement.settlement_status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Period: {new Date(settlement.settlement_period_start).toLocaleDateString()} - {new Date(settlement.settlement_period_end).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">₹{settlement.net_amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">
                      Gross: ₹{settlement.total_amount.toLocaleString()} | Commission: ₹{settlement.commission_amount.toLocaleString()}
                    </p>
                  </div>
                </div>
                {settlement.processed_at && (
                  <p className="text-xs text-gray-400 mt-2">
                    Processed on {new Date(settlement.processed_at).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

