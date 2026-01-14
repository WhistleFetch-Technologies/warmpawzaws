'use client';

/**
 * Revenue Analytics Screen
 * Revenue analysis and trends
 * Batch 3 - Screen 7
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface RevenueAnalyticsScreenProps {
  vendorId: string;
  onBack?: () => void;
}

interface RevenueAnalytics {
  totalRevenue: number;
  avgPerBooking: number;
  totalBookings: number;
  growth: number;
  growthRate: number;
  peakDay?: string;
  byService?: Array<{ serviceName: string; revenue: number }>;
}

export function RevenueAnalyticsScreen({ vendorId, onBack }: RevenueAnalyticsScreenProps) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<RevenueAnalytics | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadAnalytics();
  }, [vendorId, period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const response = await apiClient.get<{
        success: boolean;
        analytics?: RevenueAnalytics;
        error?: string;
      }>(`/vendor/analytics/revenue?period=${period}`);

      if (response.success && response.analytics) {
        setAnalytics(response.analytics);
      } else {
        toast.error(response.error || 'Failed to load revenue analytics');
        setAnalytics({
          totalRevenue: 0,
          avgPerBooking: 0,
          totalBookings: 0,
          growth: 0,
          growthRate: 0,
          peakDay: 'N/A',
          byService: [],
        });
      }
    } catch (error: any) {
      console.error('[RevenueAnalyticsScreen] Error loading analytics:', error);
      toast.error('Failed to load revenue analytics');
      setAnalytics({
        totalRevenue: 0,
        avgPerBooking: 0,
        totalBookings: 0,
        growth: 0,
        growthRate: 0,
        peakDay: 'N/A',
        byService: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading revenue analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          {onBack && (
            <button
              onClick={onBack}
              className="text-orange-500 text-sm font-medium mb-2"
            >
              ← Back
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900">Revenue Analytics</h1>
        </div>

        {/* Period Selector */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex space-x-2">
            {(['week', 'month', 'year'] as const).map((p) => (
              <button
                key={p}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  period === p ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setPeriod(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Analytics Content */}
        <div className="px-4 py-6 space-y-6">
          {analytics && (
            <>
              {/* Summary Card */}
              <div className="bg-gradient-to-r from-orange-400 to-orange-600 rounded-xl p-6 text-white">
                <p className="text-sm text-orange-100 mb-1">Total Revenue</p>
                <div className="text-3xl font-bold mb-1">
                  {formatCurrency(analytics.totalRevenue || 0)}
                </div>
                <p className="text-orange-100 text-sm">
                  {analytics.growth >= 0 ? '↑' : '↓'} {Math.abs(analytics.growth || 0)}% vs previous period
                </p>
              </div>

              {/* Stat Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(analytics.avgPerBooking || 0)}
                  </div>
                  <div className="text-xs text-gray-500">Avg per Booking</div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
                  <div className="text-2xl font-bold text-gray-900">{analytics.totalBookings || 0}</div>
                  <div className="text-xs text-gray-500">Total Bookings</div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
                  <div className="text-2xl font-bold text-gray-900">{analytics.peakDay || 'N/A'}</div>
                  <div className="text-xs text-gray-500">Peak Day</div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
                  <div className="text-2xl font-bold text-green-600">{analytics.growthRate || 0}%</div>
                  <div className="text-xs text-gray-500">Growth Rate</div>
                </div>
              </div>

              {/* Revenue by Service */}
              {analytics.byService && analytics.byService.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Revenue by Service</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {analytics.byService.map((item, index) => (
                      <div key={index} className="flex items-center justify-between px-4 py-3">
                        <span className="text-gray-800 font-medium">{item.serviceName}</span>
                        <span className="text-gray-900 font-semibold">{formatCurrency(item.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

