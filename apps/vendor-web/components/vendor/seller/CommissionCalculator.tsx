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
    <div className="space-y-3 p-1 sm:space-y-6 sm:p-6 lg:p-8">
      <div className="rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 p-3 text-white shadow-lg shadow-orange-500/20 sm:rounded-2xl sm:p-6 lg:p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="shrink-0 rounded-lg bg-white/20 p-2 sm:rounded-xl sm:p-4">
              <Percent className="h-5 w-5 sm:h-8 sm:w-8" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-orange-100 sm:text-sm">Your commission rate</p>
              <p className="text-2xl font-bold sm:text-5xl">
                {formatCommissionRateDisplay(
                  analytics.commissionRate,
                  analytics.commissionConfigured
                )}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-orange-100 sm:mt-2 sm:text-sm">
                {commissionConfigured
                  ? rateSourceLabel ?? 'Platform fee on each shop sale'
                  : 'Shop commission is not configured yet'}
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 space-y-3 text-right sm:block">
            <div>
              <p className="text-sm text-orange-100">Total Revenue</p>
              <p className="text-2xl font-bold lg:text-3xl">
                ₹{safeNum(analytics.totalRevenue).toLocaleString('en-IN')}
              </p>
            </div>
            <div>
              <p className="text-sm text-orange-100">Net Earnings</p>
              <p className="text-2xl font-bold text-emerald-300 lg:text-3xl">
                ₹{safeNum(analytics.netEarnings).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {!commissionConfigured && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:gap-3 sm:rounded-2xl sm:p-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 sm:h-5 sm:w-5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Commission not configured</p>
            <p className="mt-1 text-xs text-amber-800 sm:text-sm">
              Your shop commission rate has not been set up yet. Order earnings and the calculator
              below will update once WarmPawz configures your commission model.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-emerald-100 p-1.5 sm:rounded-xl sm:p-3">
              <Wallet className="h-4 w-4 text-emerald-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Total Revenue</p>
              <p className="text-base font-bold text-slate-900 sm:text-2xl">
                ₹{safeNum(analytics.totalRevenue).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-orange-100 p-1.5 sm:rounded-xl sm:p-3">
              <IndianRupee className="h-4 w-4 text-orange-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Commission Paid</p>
              <p className="text-base font-bold text-orange-600 sm:text-2xl">
                ₹{safeNum(analytics.totalCommission).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-blue-100 p-1.5 sm:rounded-xl sm:p-3">
              <TrendingUp className="h-4 w-4 text-blue-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Net Earnings</p>
              <p className="text-base font-bold text-blue-600 sm:text-2xl">
                ₹{safeNum(analytics.netEarnings).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-purple-100 p-1.5 sm:rounded-xl sm:p-3">
              <PiggyBank className="h-4 w-4 text-purple-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Pending Payout</p>
              <p className="text-base font-bold text-purple-600 sm:text-2xl">
                ₹{safeNum(analytics.pendingPayout).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-6">
        <div className="mb-3 flex items-center gap-2 sm:mb-6 sm:gap-3">
          <div className="rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 p-2 sm:rounded-xl sm:p-3">
            <Calculator className="h-4 w-4 text-orange-600 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 sm:text-lg">Earnings Calculator</h2>
            <p className="text-[11px] text-slate-500 sm:text-sm">See net earnings for a sale amount</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 sm:gap-8">
          <div className="space-y-2 sm:space-y-4">
            <label className="block text-xs font-medium text-slate-700 sm:text-sm">Sale Amount (₹)</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-4 sm:h-5 sm:w-5" />
              <input
                type="number"
                min="0"
                value={simulatedSale}
                onChange={(e) => setSimulatedSale(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-lg font-bold focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 sm:rounded-xl sm:py-4 sm:pl-12 sm:pr-4 sm:text-2xl"
              />
            </div>
            <p className="text-[11px] text-slate-500 sm:text-sm">
              Enter the sale amount including GST to see your earnings breakdown
            </p>
          </div>

          <div className="space-y-2 rounded-xl bg-gradient-to-br from-slate-50 to-orange-50/30 p-3 text-sm sm:space-y-4 sm:p-6">
            <div className="flex items-center justify-between py-1 sm:py-2">
              <span className="text-slate-600">Sale Amount</span>
              <span className="font-bold text-slate-900">
                ₹{breakdown.saleAmount.toLocaleString('en-IN')}
              </span>
            </div>
            {gstRate > 0 && (
              <div className="flex items-center justify-between border-b border-slate-200 py-1 sm:py-2">
                <span className="text-slate-600">GST ({gstRate}%)</span>
                <span className="font-medium text-purple-600">
                  - ₹{breakdown.gstAmount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-1 sm:py-2">
              <span className="text-slate-600">Base Amount</span>
              <span className="font-medium text-slate-900">
                ₹{breakdown.baseAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 py-1 sm:py-2">
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
            <div className="flex items-center justify-between rounded-lg bg-emerald-100 px-3 py-2 sm:rounded-xl sm:px-4 sm:py-3">
              <span className="text-xs font-semibold text-emerald-900 sm:text-sm">Your Net Earnings</span>
              <span className="text-base font-bold text-emerald-600 sm:text-2xl">
                ₹{breakdown.netEarnings.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {analytics.tiers.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 p-3 text-white sm:rounded-2xl sm:p-6">
          <h3 className="mb-3 text-sm font-semibold sm:mb-4 sm:text-lg">Commission Tier Benefits</h3>
          <div
            className={`grid grid-cols-2 gap-2 sm:gap-4 ${
              analytics.tiers.length >= 3
                ? 'md:grid-cols-3'
                : analytics.tiers.length === 2
                  ? 'md:grid-cols-2'
                  : 'grid-cols-1'
            }`}
          >
            {analytics.tiers.map((tier, index) => (
              <div
                key={`${tier.name}-${tier.level}`}
                className={`rounded-lg p-2.5 sm:rounded-xl sm:p-4 ${
                  tier.isCurrent ? 'bg-orange-500/30 ring-2 ring-orange-400' : 'bg-white/10'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5 sm:mb-2 sm:gap-2">
                  <span className="text-base sm:text-2xl">{TIER_MEDALS[index] ?? '⭐'}</span>
                  <span className="text-xs font-semibold sm:text-sm">{tier.name}</span>
                  {tier.isCurrent && (
                    <span className="rounded-full bg-orange-400 px-1.5 py-0.5 text-[10px] text-white sm:text-xs">
                      Current
                    </span>
                  )}
                </div>
                <p
                  className={`text-xl font-bold sm:text-3xl ${
                    tier.isCurrent ? 'text-orange-400' : 'text-slate-300'
                  }`}
                >
                  {tier.commissionRate}%
                </p>
                <p className="mt-1 text-[11px] text-slate-400 sm:mt-2 sm:text-sm">
                  {formatRevenueRange(tier.minMonthlyRevenue, tier.maxMonthlyRevenue)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400 sm:mt-4 sm:text-sm">
            Your commission rate automatically improves as your sales grow!
          </p>
        </div>
      )}
    </div>
  );
}
