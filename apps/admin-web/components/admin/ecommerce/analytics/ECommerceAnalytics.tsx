'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  IndianRupee,
  ArrowUp,
  ArrowDown,
  Calendar,
  Download,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface AnalyticsData {
  revenue: {
    total: number;
    growth: number;
    byPeriod: Array<{ period: string; amount: number }>;
  };
  orders: {
    total: number;
    growth: number;
    byStatus: Record<string, number>;
  };
  sellers: {
    total: number;
    active: number;
    growth: number;
  };
  products: {
    total: number;
    active: number;
    lowStock: number;
  };
  topSellers: Array<{ name: string; revenue: number; orders: number }>;
  topProducts: Array<{ name: string; sales: number; revenue: number }>;
}

export function ECommerceAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30'); // days

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<any>(`/admin/ecommerce/analytics?days=${dateRange}`);
      const apiData = (response as any).data || response;
      
      // Transform API response to match component's expected structure
      const revenueArray = apiData.revenue || [];
      const totalRevenue = apiData.totalRevenue || revenueArray.reduce((sum: number, row: any) => sum + parseFloat(row.revenue || '0'), 0);
      const totalOrders = apiData.totalOrders || revenueArray.reduce((sum: number, row: any) => sum + parseInt(row.order_count || '0', 10), 0);
      
      const transformedData: AnalyticsData = {
        revenue: {
          total: totalRevenue || 0,
          growth: 0, // Calculate if needed
          byPeriod: revenueArray.map((row: any) => ({
            period: row.date || '',
            amount: parseFloat(row.revenue || '0'),
          })),
        },
        orders: {
          total: totalOrders || 0,
          growth: 0, // Calculate if needed
          byStatus: {}, // Calculate from orders if needed
        },
        sellers: {
          total: apiData.totalSellers || 0,
          active: apiData.activeSellers || 0,
          growth: 0,
        },
        products: {
          total: 0,
          active: 0,
          lowStock: 0,
        },
        topSellers: (apiData.topSellers || []).map((s: any) => ({
          name: s.name || s.business_name || 'Unknown Seller',
          revenue: parseFloat(s.revenue || '0'),
          orders: parseInt(s.orders || '0', 10),
        })),
        topProducts: (apiData.topProducts || []).map((p: any) => ({
          name: p.name || 'Unknown Product',
          sales: parseInt(p.sales || '0', 10),
          revenue: parseFloat(p.revenue || '0'),
        })),
      };
      
      setAnalytics(transformedData);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        console.warn('⚠️ API returned 401 - showing empty state (UAT mode)');
        setError(null);
        setAnalytics(null);
      } else {
        setError(err.message || 'Failed to load analytics data');
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const exportReport = () => {
    if (!analytics) return;

    const csv = [
      ['E-Commerce Analytics Report'],
      ['Generated', new Date().toISOString()],
      [''],
      ['Revenue'],
      ['Total', analytics.revenue.total],
      ['Growth', `${analytics.revenue.growth}%`],
      [''],
      ['Orders'],
      ['Total', analytics.orders.total],
      ['Growth', `${analytics.orders.growth}%`],
      [''],
      ['Top Sellers'],
      ['Name', 'Revenue', 'Orders'],
      ...analytics.topSellers.map((s) => [s.name, s.revenue, s.orders]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecommerce-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Always render UI structure - show loading/error overlays when needed
  return (
    <div className="p-6 space-y-6 relative">
      {/* Loading overlay - only show when actively loading */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#FF8C42]" />
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      )}
      
      {/* Error state - show if error and not loading */}
      {error && !loading && !analytics && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">{error || 'Failed to load analytics'}</p>
          <Button onClick={fetchAnalytics}>Retry</Button>
        </div>
      )}
      
      {/* Analytics content - show if data available */}
      {analytics && (
        <>
          {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-black text-xl font-semibold">E-Commerce Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">Platform performance and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <Button onClick={exportReport} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Revenue */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <IndianRupee className="w-6 h-6 text-green-600" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${
                  (analytics.revenue?.growth || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {(analytics.revenue?.growth || 0) >= 0 ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
                {Math.abs(analytics.revenue?.growth || 0)}%
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold">₹{(analytics.revenue?.total || 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Orders */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${
                  (analytics.orders?.growth || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {(analytics.orders?.growth || 0) >= 0 ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
                {Math.abs(analytics.orders?.growth || 0)}%
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <p className="text-2xl font-bold">{(analytics.orders?.total || 0).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Sellers */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div
                className={`flex items-center gap-1 text-sm ${
                  (analytics.sellers?.growth || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {(analytics.sellers?.growth || 0) >= 0 ? (
                  <ArrowUp className="w-4 h-4" />
                ) : (
                  <ArrowDown className="w-4 h-4" />
                )}
                {Math.abs(analytics.sellers?.growth || 0)}%
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Sellers</p>
              <p className="text-2xl font-bold">
                {analytics.sellers?.active || 0}/{analytics.sellers?.total || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-50 rounded-lg">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              {(analytics.products?.lowStock || 0) > 0 && (
                <div className="text-sm text-orange-600">{analytics.products?.lowStock || 0} low stock</div>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Products</p>
              <p className="text-2xl font-bold">
                {analytics.products?.active || 0}/{analytics.products?.total || 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>Revenue breakdown by period</CardDescription>
        </CardHeader>
        <CardContent>
          {(analytics.revenue?.byPeriod || []).length > 0 ? (
            <div className="space-y-4">
              {(analytics.revenue?.byPeriod || []).map((period, index) => {
                const periods = analytics.revenue?.byPeriod || [];
                const maxAmount = periods.length > 0 ? Math.max(...periods.map((p) => p.amount || 0)) : 0;
                const percentage = (period.amount / maxAmount) * 100;

                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{period.period}</span>
                      <span className="text-sm font-semibold">₹{(period.amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div
                        className="bg-[#FF8C42] h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No revenue data available</p>
              <p className="text-gray-400 text-xs mt-1">Revenue data will appear here once orders are placed</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Distribution of orders by status</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(analytics.orders?.byStatus || {}).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(analytics.orders?.byStatus || {}).map(([status, count]) => {
                  const totalOrders = analytics.orders?.total || 1;
                  const percentage = totalOrders > 0 ? ((Number(count) / totalOrders) * 100).toFixed(1) : '0';
                  const colors: Record<string, string> = {
                    pending: 'bg-yellow-500',
                    confirmed: 'bg-blue-500',
                    shipped: 'bg-purple-500',
                    delivered: 'bg-green-500',
                    cancelled: 'bg-red-500',
                  };

                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${colors[status] || 'bg-gray-500'}`} />
                        <span className="text-sm capitalize">{status}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">{percentage}%</span>
                        <span className="text-sm font-semibold min-w-[40px] text-right">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">No order data available</p>
                <p className="text-gray-400 text-xs mt-1">Order status distribution will appear here once orders are placed</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Sellers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Sellers</CardTitle>
            <CardDescription>Best performing sellers this period</CardDescription>
          </CardHeader>
          <CardContent>
            {(analytics.topSellers || []).length > 0 ? (
              <div className="space-y-4">
                {(analytics.topSellers || []).map((seller, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#FF8C42] text-white rounded-full flex items-center justify-center font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{seller.name}</p>
                        <p className="text-xs text-gray-600">{seller.orders} orders</p>
                      </div>
                    </div>
                    <p className="font-semibold">₹{(seller.revenue || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">No top sellers yet</p>
                <p className="text-gray-400 text-xs mt-1">Top sellers will appear here once they make sales</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
          <CardDescription>Best selling products this period</CardDescription>
        </CardHeader>
        <CardContent>
          {(analytics.topProducts || []).length > 0 ? (
            <div className="space-y-4">
              {(analytics.topProducts || []).map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-gray-600">{product.sales} units sold</p>
                    </div>
                  </div>
                  <p className="font-semibold">₹{(product.revenue || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium">No top products yet</p>
              <p className="text-gray-400 text-xs mt-1">Top products will appear here once they are sold</p>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}
