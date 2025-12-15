import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingBag,
  DollarSign,
  Activity,
  Calendar,
  Download,
  RefreshCw,
  BarChart3,
  PieChart,
  LineChart,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface PlatformMetrics {
  timestamp: string;
  period: string;
  users: {
    totalCustomers: number;
    totalVendors: number;
    newCustomers: number;
    newVendors: number;
    activeCustomers: number;
    activeVendors: number;
  };
  bookings: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    averageBookingValue: number;
  };
  revenue: {
    totalRevenue: number;
    grossRevenue: number;
    netRevenue: number;
    platformFees: number;
    growth: number;
  };
  performance: {
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
  };
}

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchMetrics();
  }, [period, dateRange]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BASE_URL}/analytics/platform-metrics?period=${period}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/analytics/export?period=${period}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${period}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Analytics exported successfully');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export analytics');
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(2)}K`;
    return `₹${num.toFixed(0)}`;
  };

  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Analytics Dashboard
            </h1>
            <p className="text-gray-600">
              Platform-wide metrics and insights
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={fetchMetrics}
              variant="outline"
              className="border-2 border-gray-200"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>

            <Button
              onClick={exportData}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg border-2 transition-colors capitalize ${
                  period === p
                    ? 'border-orange-600 bg-orange-50 text-orange-900'
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2 ml-auto">
            <Calendar className="w-4 h-4 text-gray-600" />
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-3 py-2 border-2 border-gray-200 rounded-lg"
            />
            <span className="text-gray-600">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-3 py-2 border-2 border-gray-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
        </div>
      ) : !metrics ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="font-bold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">Try adjusting the date range or period</p>
        </div>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Revenue */}
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full text-xs">
                  {metrics.revenue.growth >= 0 ? (
                    <ArrowUp className="w-3 h-3" />
                  ) : (
                    <ArrowDown className="w-3 h-3" />
                  )}
                  {formatPercentage(Math.abs(metrics.revenue.growth))}
                </div>
              </div>
              <p className="text-sm opacity-90 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold">
                {formatNumber(metrics.revenue.totalRevenue)}
              </p>
            </div>

            {/* Total Bookings */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full text-xs">
                  <TrendingUp className="w-3 h-3" />
                  {formatPercentage(
                    (metrics.bookings.completedBookings / metrics.bookings.totalBookings) * 100
                  )}
                </div>
              </div>
              <p className="text-sm opacity-90 mb-1">Total Bookings</p>
              <p className="text-3xl font-bold">
                {metrics.bookings.totalBookings.toLocaleString()}
              </p>
            </div>

            {/* Active Customers */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <Users className="w-6 h-6" />
                </div>
                <span className="px-2 py-1 bg-white/20 rounded-full text-xs">
                  +{metrics.users.newCustomers} new
                </span>
              </div>
              <p className="text-sm opacity-90 mb-1">Active Customers</p>
              <p className="text-3xl font-bold">
                {metrics.users.activeCustomers.toLocaleString()}
              </p>
            </div>

            {/* Success Rate */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <Activity className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-white/20 rounded-full text-xs">
                  <TrendingUp className="w-3 h-3" />
                  Excellent
                </div>
              </div>
              <p className="text-sm opacity-90 mb-1">Success Rate</p>
              <p className="text-3xl font-bold">
                {formatPercentage(metrics.performance.successRate)}
              </p>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* User Metrics */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">User Metrics</h3>
                  <p className="text-sm text-gray-600">Customer & vendor activity</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <span className="text-gray-600">Total Customers</span>
                  <span className="font-bold text-gray-900">
                    {metrics.users.totalCustomers.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <span className="text-gray-600">Total Vendors</span>
                  <span className="font-bold text-gray-900">
                    {metrics.users.totalVendors.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <span className="text-gray-600">New Customers</span>
                  <span className="font-bold text-green-600">
                    +{metrics.users.newCustomers.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-600">New Vendors</span>
                  <span className="font-bold text-green-600">
                    +{metrics.users.newVendors.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Booking Metrics */}
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ShoppingBag className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Booking Metrics</h3>
                  <p className="text-sm text-gray-600">Order performance</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-bold text-green-600">
                    {metrics.bookings.completedBookings.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <span className="text-gray-600">Cancelled</span>
                  <span className="font-bold text-red-600">
                    {metrics.bookings.cancelledBookings.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <span className="text-gray-600">Average Value</span>
                  <span className="font-bold text-gray-900">
                    {formatNumber(metrics.bookings.averageBookingValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-gray-600">Completion Rate</span>
                  <span className="font-bold text-blue-600">
                    {formatPercentage(
                      (metrics.bookings.completedBookings / metrics.bookings.totalBookings) * 100
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Revenue Breakdown</h3>
                <p className="text-sm text-gray-600">Financial performance</p>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Gross Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatNumber(metrics.revenue.grossRevenue)}
                </p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Net Revenue</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatNumber(metrics.revenue.netRevenue)}
                </p>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Platform Fees</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatNumber(metrics.revenue.platformFees)}
                </p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Growth Rate</p>
                <p className="text-2xl font-bold text-purple-600 flex items-center justify-center gap-1">
                  {metrics.revenue.growth >= 0 ? (
                    <ArrowUp className="w-5 h-5" />
                  ) : (
                    <ArrowDown className="w-5 h-5" />
                  )}
                  {formatPercentage(Math.abs(metrics.revenue.growth))}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
