'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Percent, Calculator, 
  ArrowRight, IndianRupee, PiggyBank, Wallet, Clock
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface CommissionCalculatorProps {
  sellerId: string;
}

export function CommissionCalculator({ sellerId }: CommissionCalculatorProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [simulatedSale, setSimulatedSale] = useState('1000');

  useEffect(() => {
    loadCommissionData();
  }, [sellerId]);

  const loadCommissionData = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>(`/vendor/${sellerId}/commission-analytics`);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading commission data:', error);
      // Use mock data
      setAnalytics({
        commissionRate: 15,
        totalRevenue: 0,
        totalCommission: 0,
        netEarnings: 0,
        pendingPayout: 0,
        lastPayout: null,
        payoutHistory: []
      });
    } finally {
      setLoading(false);
    }
  };

  const commissionRate = analytics?.commissionRate || 15;
  const gstRate = 18;
  
  const calculateBreakdown = (saleAmount: number) => {
    const gstAmount = saleAmount * (gstRate / (100 + gstRate));
    const baseAmount = saleAmount - gstAmount;
    const commission = baseAmount * (commissionRate / 100);
    const netEarnings = baseAmount - commission;
    
    return {
      saleAmount,
      gstAmount,
      baseAmount,
      commission,
      netEarnings
    };
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

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Commission & Earnings</h1>
        <p className="text-slate-500 mt-1">Track your commissions and calculate net earnings</p>
      </div>

      {/* Commission Rate Card */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 rounded-2xl p-8 text-white shadow-xl shadow-orange-500/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-4 bg-white/20 rounded-xl">
                <Percent className="w-8 h-8" />
              </div>
              <div>
                <p className="text-orange-100 text-sm">Your Commission Rate</p>
                <p className="text-5xl font-bold mt-1">{commissionRate}%</p>
                <p className="text-orange-100 text-sm mt-2">Platform fee on each sale</p>
              </div>
            </div>
          </div>
          <div className="text-right space-y-4">
            <div>
              <p className="text-orange-100 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold">₹{(analytics?.totalRevenue || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-orange-100 text-sm">Net Earnings</p>
              <p className="text-3xl font-bold text-emerald-300">₹{(analytics?.netEarnings || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-900">₹{(analytics?.totalRevenue || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-xl">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Commission Paid</p>
              <p className="text-2xl font-bold text-orange-600">₹{(analytics?.totalCommission || 0).toLocaleString()}</p>
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
              <p className="text-2xl font-bold text-blue-600">₹{(analytics?.netEarnings || 0).toLocaleString()}</p>
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
              <p className="text-2xl font-bold text-purple-600">₹{(analytics?.pendingPayout || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calculator */}
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
          {/* Input */}
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
            <p className="text-sm text-slate-500">Enter the sale amount including GST to see your earnings breakdown</p>
          </div>

          {/* Breakdown */}
          <div className="bg-gradient-to-br from-slate-50 to-orange-50/30 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600">Sale Amount</span>
              <span className="font-bold text-slate-900">₹{breakdown.saleAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200">
              <span className="text-slate-600">GST ({gstRate}%)</span>
              <span className="font-medium text-purple-600">- ₹{breakdown.gstAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600">Base Amount</span>
              <span className="font-medium text-slate-900">₹{breakdown.baseAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-200">
              <span className="text-slate-600">Platform Commission ({commissionRate}%)</span>
              <span className="font-medium text-orange-600">- ₹{breakdown.commission.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between py-3 bg-emerald-100 rounded-xl px-4 -mx-2">
              <span className="font-semibold text-emerald-900">Your Net Earnings</span>
              <span className="text-2xl font-bold text-emerald-600">₹{breakdown.netEarnings.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Commission Tiers Info */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-4">Commission Tier Benefits</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🥉</span>
              <span className="font-semibold">Starter</span>
            </div>
            <p className="text-3xl font-bold text-orange-400">15%</p>
            <p className="text-slate-400 text-sm mt-2">₹0 - ₹50,000 monthly sales</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🥈</span>
              <span className="font-semibold">Growth</span>
            </div>
            <p className="text-3xl font-bold text-slate-300">12%</p>
            <p className="text-slate-400 text-sm mt-2">₹50,000 - ₹2,00,000 monthly</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🥇</span>
              <span className="font-semibold">Premium</span>
            </div>
            <p className="text-3xl font-bold text-amber-400">10%</p>
            <p className="text-slate-400 text-sm mt-2">₹2,00,000+ monthly sales</p>
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-4">
          💡 Your commission rate automatically improves as your sales grow!
        </p>
      </div>
    </div>
  );
}
