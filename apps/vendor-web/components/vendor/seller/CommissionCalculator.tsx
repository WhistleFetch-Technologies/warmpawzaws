'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee,
  TrendingUp,
  Percent,
  Calculator,
  PiggyBank,
  Wallet,
  RefreshCcw,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  formatCommissionRateDisplay,
  formatCommissionRateSource,
  parseVendorCommissionAnalytics,
  type VendorCommissionAnalytics,
} from '@/lib/vendor-commission-analytics';

interface CommissionCalculatorProps {
  sellerId: string;
}

const TIER_MEDALS = ['🥉', '🥈', '🥇', '🏆'];

function safeNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatRevenueRange(min: number, max: number | null): string {
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L` : `₹${n.toLocaleString('en-IN')}`;
  if (max == null) return `${fmt(min)}+ monthly sales`;
  if (min <= 0) return `₹0 - ${fmt(max)} monthly sales`;
  return `${fmt(min)} - ${fmt(max)} monthly sales`;
}

export function CommissionCalculator({ sellerId }: CommissionCalculatorProps) {
  const [analytics, setAnalytics] = useState<VendorCommissionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulatedSale, setSimulatedSale] = useState('1000');

  const loadCommissionData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<Record<string, unknown>>(
        `/vendor/${sellerId}/commission-analytics`
      );
      const parsed = parseVendorCommissionAnalytics(data);
      if (!parsed) {
        throw new Error('Invalid commission analytics response');
      }
      setAnalytics(parsed);
    } catch (err) {
      console.error('Error loading commission data:', err);
      setAnalytics(null);
      setError('Could not load commission data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadCommissionData();
  }, [loadCommissionData]);

  const commissionConfigured = analytics?.commissionConfigured === true;
  const commissionRate = commissionConfigured ? safeNum(analytics?.commissionRate, 0) : 0;
  const gstRate = safeNum(analytics?.gstRate, 0);
  const rateSourceLabel = formatCommissionRateSource(analytics?.commissionRateSource ?? null);

  const calculateBreakdown = (saleAmount: number) => {
    if (!commissionConfigured || commissionRate <= 0) {
      return {
        saleAmount,
        gstAmount: 0,
        baseAmount: saleAmount,
        commission: 0,
        netEarnings: saleAmount,
      };
    }
    if (gstRate <= 0) {
      const commission = saleAmount * (commissionRate / 100);
      return {
        saleAmount,
        gstAmount: 0,
        baseAmount: saleAmount,
        commission,
        netEarnings: saleAmount - commission,
      };
    }
    const gstAmount = saleAmount * (gstRate / (100 + gstRate));
    const baseAmount = saleAmount - gstAmount;
    const commission = baseAmount * (commissionRate / 100);
    const netEarnings = baseAmount - commission;
    return { saleAmount, gstAmount, baseAmount, commission, netEarnings };
  };

  const breakdown = calculateBreakdown(parseFloat(simulatedSale) || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading commission data...</p>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <p className="text-slate-700 font-medium">{error || 'Commission data unavailable'}</p>
          <button
            type="button"
            onClick={loadCommissionData}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Commission & Earnings</h1>
        <p className="text-slate-500 mt-1">Track your commissions and calculate net earnings</p>
      </div>

      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 rounded-2xl p-8 text-white shadow-xl shadow-orange-500/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-4 bg-white/20 rounded-xl">
                <Percent className="w-8 h-8" />
              </div>
              <div>
                <p className="text-orange-100 text-sm">Your Commission Rate</p>
                <p className="text-5xl font-bold mt-1">
                  {formatCommissionRateDisplay(
                    analytics.commissionRate,
                    analytics.commissionConfigured
                  )}
                </p>
                <p className="text-orange-100 text-sm mt-2">
                  {commissionConfigured
                    ? rateSourceLabel ?? 'Platform fee on each shop sale'
                    : 'Shop commission is not configured yet'}
                </p>
              </div>
            </div>
          </div>
          <div className="text-right space-y-4">
            <div>
              <p className="text-orange-100 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold">
                ₹{safeNum(analytics.totalRevenue).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-orange-100 text-sm">Net Earnings</p>
              <p className="text-3xl font-bold text-emerald-300">
                ₹{safeNum(analytics.netEarnings).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {!commissionConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-900">Commission not configured</p>
            <p className="text-sm text-amber-800 mt-1">
              Your shop commission rate has not been set up yet. Order earnings and the calculator
              below will update once WarmPawz configures your commission model.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-900">
                ₹{safeNum(analytics.totalRevenue).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-xl">
              <IndianRupee className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Commission Paid</p>
              <p className="text-2xl font-bold text-orange-600">
                ₹{safeNum(analytics.totalCommission).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Net Earnings</p>
              <p className="text-2xl font-bold text-blue-600">
                ₹{safeNum(analytics.netEarnings).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <PiggyBank className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Pending Payout</p>
              <p className="text-2xl font-bold text-purple-600">
                ₹{safeNum(analytics.pendingPayout).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl">
            <Calculator className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Earnings Calculator</h2>
            <p className="text-sm text-slate-500">Calculate your earnings for any sale amount</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Sale Amount (₹)</label>
            <div className="relative">
              <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="number"
                min="0"
                value={simulatedSale}
                onChange={(e) => setSimulatedSale(e.target.value)}
                className="w-full pl-12 pr-4 py-4 text-2xl font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <p className="text-sm text-slate-500">
              Enter the sale amount including GST to see your earnings breakdown
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-orange-50/30 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600">Sale Amount</span>
              <span className="font-bold text-slate-900">
                ₹{breakdown.saleAmount.toLocaleString('en-IN')}
              </span>
            </div>
            {gstRate > 0 && (
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <span className="text-slate-600">GST ({gstRate}%)</span>
                <span className="font-medium text-purple-600">
                  - ₹{breakdown.gstAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600">Base Amount</span>
              <span className="font-medium text-slate-900">
                ₹{breakdown.baseAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200">
              <span className="text-slate-600">
                Platform Commission
                {commissionConfigured && commissionRate > 0 ? ` (${commissionRate}%)` : ''}
              </span>
              <span className="font-medium text-orange-600">
                {commissionConfigured && commissionRate > 0
                  ? `- ₹${breakdown.commission.toFixed(2)}`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 bg-emerald-100 rounded-xl px-4 -mx-2">
              <span className="font-semibold text-emerald-900">Your Net Earnings</span>
              <span className="text-2xl font-bold text-emerald-600">
                ₹{breakdown.netEarnings.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {analytics.tiers.length > 0 && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-4">Commission Tier Benefits</h3>
          <div
            className={`grid grid-cols-1 gap-4 ${
              analytics.tiers.length >= 3
                ? 'md:grid-cols-3'
                : analytics.tiers.length === 2
                  ? 'md:grid-cols-2'
                  : ''
            }`}
          >
            {analytics.tiers.map((tier, index) => (
              <div
                key={`${tier.name}-${tier.level}`}
                className={`rounded-xl p-4 ${
                  tier.isCurrent ? 'bg-orange-500/30 ring-2 ring-orange-400' : 'bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{TIER_MEDALS[index] ?? '⭐'}</span>
                  <span className="font-semibold">{tier.name}</span>
                  {tier.isCurrent && (
                    <span className="text-xs bg-orange-400 text-white px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <p
                  className={`text-3xl font-bold ${
                    tier.isCurrent ? 'text-orange-400' : 'text-slate-300'
                  }`}
                >
                  {tier.commissionRate}%
                </p>
                <p className="text-slate-400 text-sm mt-2">
                  {formatRevenueRange(tier.minMonthlyRevenue, tier.maxMonthlyRevenue)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-slate-400 text-sm mt-4">
            Your commission rate automatically improves as your sales grow!
          </p>
        </div>
      )}
    </div>
  );
}
