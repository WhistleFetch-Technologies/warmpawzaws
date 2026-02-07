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
  tier_deduction_amount?: number;
  hasBreakup?: boolean;
}

interface EarningsStats {
  totalEarnings: number;
  pendingSettlement: number;
  completedSettlement: number;
  totalBookings: number;
  commissionPaid: number;
}

interface TierInfo {
  current: string;
  commission: number;
  nextTier?: {
    name: string;
    eligible: boolean;
    requirements: any;
  };
}

interface TierDeduction {
  tierName: string;
  totalAmount: number;
  amountRemaining: number;
  installmentsRemaining: number;
}

interface VendorEarningsPageProps {
  vendorId: string;
}

export function VendorEarningsPage({ vendorId }: VendorEarningsPageProps) {
  const [stats, setStats] = useState<EarningsStats | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  // ✅ NEW: Tier info state
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [tierDeductions, setTierDeductions] = useState<TierDeduction[]>([]);
  const [pendingTierDeduction, setPendingTierDeduction] = useState(0);
  const [showBreakupModal, setShowBreakupModal] = useState(false);
  const [selectedSettlementBreakup, setSelectedSettlementBreakup] = useState<any>(null);

  useEffect(() => {
    loadData();
    loadTierInfo();
  }, [vendorId, timeRange]);

  const loadTierInfo = async () => {
    try {
      // Load vendor tier info
      const tierRes = await apiClient.get<any>(`/vendor/${vendorId}/tier`).catch(() => null);
      if (tierRes?.tier) {
        setTierInfo(tierRes.tier);
      }
      
      // Load pending tier deductions
      const deductionsRes = await apiClient.get<any>(`/vendor/${vendorId}/tier/deductions`).catch(() => null);
      if (deductionsRes?.success) {
        setTierDeductions(deductionsRes.deductions || []);
        setPendingTierDeduction(deductionsRes.summary?.totalPendingDeduction || 0);
      }
    } catch (err) {
      console.error('Error loading tier info:', err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [settlementsRes, earningsRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/settlements?timeRange=${timeRange}`).catch(() => ({ settlements: [] })),
        apiClient.get<any>(`/vendor/${vendorId}/earnings?period=${timeRange === 'all' ? 'lifetime' : timeRange === '7d' ? 'week' : 'month'}`).catch(() => ({ earnings: {} })),
      ]);
      
      // Set settlements
      setSettlements(settlementsRes.settlements || []);
      
      // Set stats from earnings response
      if (earningsRes.earnings) {
        const e = earningsRes.earnings;
        setStats({
          totalEarnings: e.totalEarnings || 0,
          pendingSettlement: e.pendingSettlement || 0,
          completedSettlement: e.settled || e.paidOut || 0,
          totalBookings: e.transactions?.length || 0,
          commissionPaid: e.totalCommission || 0,
        });
        
        // Update tier deductions from earnings
        if (e.pendingTierDeduction) {
          setPendingTierDeduction(e.pendingTierDeduction);
        }
        if (e.tierDeductions?.length) {
          setTierDeductions(e.tierDeductions);
        }
      }
    } catch (err) {
      console.error('Error loading earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Load settlement breakup
  const loadSettlementBreakup = async (settlementId: string) => {
    try {
      const result = await apiClient.get<any>(`/vendor/${vendorId}/settlements/${settlementId}/breakup`);
      if (result.breakup) {
        setSelectedSettlementBreakup(result);
        setShowBreakupModal(true);
      }
    } catch (err) {
      console.error('Error loading settlement breakup:', err);
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
    <div className="p-0">
      <div className="flex items-center justify-between mb-0">
        <h1 className="text-2xl font-bold text-gray-900">Earnings & Settlements</h1>
        <div className="flex bg-white rounded-lg p-0 shadow-sm">
          {[
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: '90d', label: '90 Days' },
            { id: 'all', label: 'All Time' },
          ].map((period) => (
            <button
              key={period.id}
              onClick={() => setTimeRange(period.id as any)}
              className={`px-0 py-0.5 text-sm font-medium rounded-md transition ${
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-0">
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

      {/* Commission Info - ✅ FIXED: Uses real tier data from API */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-4 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Your Commission Rate</p>
            <p className="text-2xl font-bold">{tierInfo?.commission || 15}%</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">Current Tier</p>
            <p className="text-xl font-bold">
              {tierInfo?.current === 'Platinum' ? '💎' : 
               tierInfo?.current === 'Gold' ? '🥇' : 
               tierInfo?.current === 'Silver' ? '🥈' : '🥉'} {tierInfo?.current || 'Bronze'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">Next Payout</p>
            <p className="text-lg font-bold">Every Tuesday</p>
          </div>
          {tierInfo?.nextTier && (
            <div className="text-right">
              <p className="text-sm opacity-90">Next Tier</p>
              <p className="text-lg font-bold">{tierInfo.nextTier.name}</p>
              {tierInfo.nextTier.eligible && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded">Eligible!</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ✅ NEW: Pending Tier Deductions Alert */}
      {pendingTierDeduction > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-amber-800">Tier Upgrade Recovery</h3>
              <p className="text-sm text-amber-700 mt-1">
                ₹{pendingTierDeduction.toLocaleString()} will be deducted from your upcoming settlements 
                for your tier upgrade cost.
              </p>
              {tierDeductions.map((d, i) => (
                <p key={i} className="text-xs text-amber-600 mt-1">
                  {d.tierName}: ₹{d.amountRemaining.toLocaleString()} remaining ({d.installmentsRemaining} payouts left)
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

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
                    <div className="flex items-center gap-3">
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
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="font-bold text-gray-900">₹{settlement.net_amount.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">
                        Gross: ₹{settlement.total_amount.toLocaleString()} | Commission: ₹{settlement.commission_amount.toLocaleString()}
                        {(settlement.tier_deduction_amount || 0) > 0 && (
                          <span className="text-amber-600"> | Tier: -₹{settlement.tier_deduction_amount?.toLocaleString()}</span>
                        )}
                      </p>
                    </div>
                    {/* ✅ NEW: View Breakup Button */}
                    <button
                      onClick={() => loadSettlementBreakup(settlement.id)}
                      className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
                    >
                      📊 Breakup
                    </button>
                  </div>
                </div>
                {settlement.processed_at && (
                  <p className="text-xs text-gray-400 mt-1">
                    Processed on {new Date(settlement.processed_at).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ NEW: Settlement Breakup Modal */}
      {showBreakupModal && selectedSettlementBreakup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Settlement Breakup</h3>
              <button
                onClick={() => {
                  setShowBreakupModal(false);
                  setSelectedSettlementBreakup(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {selectedSettlementBreakup.breakup && (
              <div className="space-y-4">
                {/* Booking Amount */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{selectedSettlementBreakup.breakup.booking?.label}</p>
                      <p className="text-xs text-gray-500">{selectedSettlementBreakup.breakup.booking?.explanation}</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">₹{selectedSettlementBreakup.breakup.booking?.amount?.toLocaleString()}</p>
                  </div>
                </div>

                {/* Commission */}
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-red-700">{selectedSettlementBreakup.breakup.commission?.label}</p>
                      <p className="text-xs text-red-600">{selectedSettlementBreakup.breakup.commission?.explanation}</p>
                      <p className="text-xs text-red-500 mt-1">How: {selectedSettlementBreakup.breakup.commission?.how}</p>
                    </div>
                    <p className="text-lg font-bold text-red-600">-₹{selectedSettlementBreakup.breakup.commission?.amount?.toLocaleString()}</p>
                  </div>
                </div>

                {/* Tier Deduction (if any) */}
                {selectedSettlementBreakup.breakup.tierDeduction && (
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-amber-700">{selectedSettlementBreakup.breakup.tierDeduction.label}</p>
                        <p className="text-xs text-amber-600">{selectedSettlementBreakup.breakup.tierDeduction.explanation}</p>
                        <p className="text-xs text-amber-500 mt-1">How: {selectedSettlementBreakup.breakup.tierDeduction.how}</p>
                        {selectedSettlementBreakup.breakup.tierDeduction.remaining > 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            Remaining: ₹{selectedSettlementBreakup.breakup.tierDeduction.remaining.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <p className="text-lg font-bold text-amber-600">-₹{selectedSettlementBreakup.breakup.tierDeduction.amount?.toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {/* Net Payout */}
                <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-green-700">{selectedSettlementBreakup.breakup.netPayout?.label}</p>
                      <p className="text-xs text-green-600">{selectedSettlementBreakup.breakup.netPayout?.explanation}</p>
                      <p className="text-xs text-green-500 mt-1 font-mono">{selectedSettlementBreakup.breakup.netPayout?.how}</p>
                    </div>
                    <p className="text-2xl font-bold text-green-700">₹{selectedSettlementBreakup.breakup.netPayout?.amount?.toLocaleString()}</p>
                  </div>
                </div>

                {/* Tier Summary */}
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Your Tier:</strong> {selectedSettlementBreakup.breakup.summary?.tierName} ({selectedSettlementBreakup.breakup.summary?.commissionRate}% commission)
                  </p>
                  <p className="text-xs text-blue-600 mt-1">{selectedSettlementBreakup.breakup.summary?.tierBenefit}</p>
                </div>
              </div>
            )}

            {/* Explanation Steps */}
            {selectedSettlementBreakup.explanation?.steps && (
              <div className="mt-6 border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-3">{selectedSettlementBreakup.explanation.title}</h4>
                <div className="space-y-3">
                  {selectedSettlementBreakup.explanation.steps.map((step: any, i: number) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-sm font-bold">
                        {step.step}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{step.title}</p>
                        <p className="text-sm text-gray-600">{step.description}</p>
                        {step.tip && <p className="text-xs text-green-600 mt-1">💡 {step.tip}</p>}
                        {step.note && <p className="text-xs text-amber-600 mt-1">📝 {step.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setShowBreakupModal(false);
                setSelectedSettlementBreakup(null);
              }}
              className="w-full mt-6 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

