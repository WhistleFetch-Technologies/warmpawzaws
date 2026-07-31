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
  Download,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface AnalyticsData {
  revenue: {
    gmv: number;
    delivered: number;
    growth: number;
    byPeriod: Array<{ period: string; gmv: number; delivered: number }>;
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

function GrowthBadge({ value, growth }: { value: number; growth: number }) {
  if (value === 0 && growth === 0) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  const positive = growth >= 0;
  return (
    <div className={`flex items-center gap-1 text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
      {Math.abs(growth)}%
    </div>
  );
}

function formatPeriodLabel(raw: string): string {
  if (!raw) return 'Unknown';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function ECommerceAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<any>(`/admin/ecommerce/analytics?days=${dateRange}`);
      const apiData = (response as any).data || response;
      const revenueArray = apiData.revenue || [];
      const growth = apiData.growth || {};
      const products = apiData.products || {};

      const byPeriod = revenueArray.map((row: any) => ({
        period: String(row.date || ''),
        gmv: parseFloat(String(row.gmv ?? row.revenue ?? 0)) || 0,
        delivered: parseFloat(String(row.delivered_revenue ?? row.revenue ?? 0)) || 0,
      }));

      const ordersByStatus: Record<string, number> = {};
      for (const [status, count] of Object.entries(apiData.ordersByStatus || {})) {
        const numeric = Number(count);
        if (status !== 'all' && numeric > 0) {
          ordersByStatus[status] = numeric;
        }
      }

      const transformedData: AnalyticsData = {
        revenue: {
          gmv: parseFloat(String(apiData.totalGMV ?? 0)) || 0,
          delivered: parseFloat(String(apiData.totalRevenue ?? 0)) || 0,
          growth: Number(growth.gmv ?? 0) || 0,
          byPeriod,
        },
        orders: {
          total: parseInt(String(apiData.totalOrders ?? 0), 10) || 0,
          growth: Number(growth.orders ?? 0) || 0,
          byStatus: ordersByStatus,
        },
        sellers: {
          total: parseInt(String(apiData.totalSellers ?? 0), 10) || 0,
          active: parseInt(String(apiData.activeSellers ?? 0), 10) || 0,
          growth: Number(growth.sellersWithOrders ?? 0) || 0,
        },
        products: {
          total: parseInt(String(products.total ?? 0), 10) || 0,
          active: parseInt(String(products.active ?? 0), 10) || 0,
          lowStock: parseInt(String(products.lowStock ?? 0), 10) || 0,
        },
        topSellers: (apiData.topSellers || []).map((s: any) => ({
          name: s.name || s.business_name || 'Unknown Seller',
          revenue: parseFloat(String(s.revenue ?? 0)) || 0,
          orders: parseInt(String(s.orders ?? 0), 10) || 0,
        })),
        topProducts: (apiData.topProducts || []).map((p: any) => ({
          name: p.name || 'Unknown Product',
          sales: parseInt(String(p.sales ?? 0), 10) || 0,
          revenue: parseFloat(String(p.revenue ?? 0)) || 0,
        })),
      };

      setAnalytics(transformedData);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      if (err?.message?.includes('401') || err?.message?.includes('Unauthorized')) {
        console.warn('API returned 401 - showing empty state (UAT mode)');
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

    const statusRows = Object.entries(analytics.orders.byStatus).map(([status, count]) => [
      status,
      count,
    ]);

    const csv = [
      ['E-Commerce Analytics Report'],
      ['Generated', new Date().toISOString()],
      ['Period (days)', dateRange],
      [''],
      ['GMV', analytics.revenue.gmv],
      ['Delivered Revenue', analytics.revenue.delivered],
      ['GMV Growth %', analytics.revenue.growth],
      [''],
      ['Orders', analytics.orders.total],
      ['Orders Growth %', analytics.orders.growth],
      [''],
      ['Active Products', analytics.products.active],
      ['Total Products', analytics.products.total],
      ['Low Stock Products', analytics.products.lowStock],
      [''],
      ['Order Status', 'Count'],
      ...statusRows,
      [''],
      ['Top Sellers', 'Revenue', 'Orders'],
      ...analytics.topSellers.map((s) => [s.name, s.revenue, s.orders]),
      [''],
      ['Top Products', 'Units Sold', 'Revenue'],
      ...analytics.topProducts.map((p) => [p.name, p.sales, p.revenue]),
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

  const hasTrendData = (analytics?.revenue?.byPeriod || []).some(
    (period) => period.gmv > 0 || period.delivered > 0,
  );

  return (
    <div className="p-6 space-y-6 relative">
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#FF8C42]" />
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      )}

      {error && !loading && !analytics && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">{error || 'Failed to load analytics'}</p>
          <Button onClick={fetchAnalytics}>Retry</Button>
        </div>
      )}

      {analytics && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-black text-xl font-semibold">E-Commerce Analytics</h2>
              <p className="text-gray-500 text-sm mt-1">Platform performance and insights</p>
              <p className="text-gray-400 text-xs mt-1">
                GMV includes all shop orders; delivered revenue counts completed deliveries only.
              </p>
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <IndianRupee className="w-6 h-6 text-green-600" />
                  </div>
                  <GrowthBadge value={analytics.revenue.gmv} growth={analytics.revenue.growth} />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Revenue (GMV)</p>
                  <p className="text-2xl font-bold">₹{analytics.revenue.gmv.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    ₹{analytics.revenue.delivered.toLocaleString()} delivered
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <ShoppingCart className="w-6 h-6 text-blue-600" />
                  </div>
                  <GrowthBadge value={analytics.orders.total} growth={analytics.orders.growth} />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Orders</p>
                  <p className="text-2xl font-bold">{analytics.orders.total.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <GrowthBadge value={analytics.sellers.active} growth={analytics.sellers.growth} />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Sellers</p>
                  <p className="text-2xl font-bold">
                    {analytics.sellers.active}/{analytics.sellers.total}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <Package className="w-6 h-6 text-orange-600" />
                  </div>
                  {analytics.products.lowStock > 0 && (
                    <div className="text-sm text-orange-600">{analytics.products.lowStock} low stock</div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Products</p>
                  <p className="text-2xl font-bold">
                    {analytics.products.active}/{analytics.products.total}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>GMV and delivered revenue by day</CardDescription>
            </CardHeader>
            <CardContent>
              {hasTrendData ? (
                <div className="space-y-5">
                  {(analytics.revenue.byPeriod || []).map((period, index) => {
                    const maxGmv = Math.max(
                      ...analytics.revenue.byPeriod.map((row) => row.gmv || 0),
                      1,
                    );
                    const gmvWidth = ((period.gmv || 0) / maxGmv) * 100;
                    const deliveredWidth = ((period.delivered || 0) / maxGmv) * 100;

                    return (
                      <div key={`${period.period}-${index}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{formatPeriodLabel(period.period)}</span>
                          <div className="text-right text-sm">
                            <p className="font-semibold">₹{(period.gmv || 0).toLocaleString()} GMV</p>
                            <p className="text-xs text-gray-500">
                              ₹{(period.delivered || 0).toLocaleString()} delivered
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="w-full bg-gray-100 rounded-full h-2.5">
                            <div
                              className="bg-[#FF8C42] h-2.5 rounded-full transition-all duration-500"
                              style={{ width: `${gmvWidth}%` }}
                            />
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${deliveredWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-[#FF8C42]" />
                      GMV
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-teal-500" />
                      Delivered
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">No revenue data available</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Revenue data will appear here once shop orders are placed
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Status</CardTitle>
                <CardDescription>Distribution of orders by status</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(analytics.orders.byStatus).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(analytics.orders.byStatus).map(([status, count]) => {
                      const totalOrders = analytics.orders.total || 1;
                      const percentage =
                        totalOrders > 0 ? ((Number(count) / totalOrders) * 100).toFixed(1) : '0';
                      const colors: Record<string, string> = {
                        pending: 'bg-yellow-500',
                        pending_payment: 'bg-amber-500',
                        confirmed: 'bg-blue-500',
                        processing: 'bg-indigo-500',
                        shipped: 'bg-purple-500',
                        delivered: 'bg-green-500',
                        cancelled: 'bg-red-500',
                        returned: 'bg-gray-500',
                      };

                      return (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${colors[status] || 'bg-gray-500'}`} />
                            <span className="text-sm capitalize">{status.replace(/_/g, ' ')}</span>
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
                    <p className="text-gray-400 text-xs mt-1">
                      Order status distribution will appear here once orders are placed
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

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
                    <p className="text-gray-400 text-xs mt-1">
                      Top sellers will appear here once they make sales
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

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
                  <p className="text-gray-400 text-xs mt-1">
                    Top products will appear here once they are sold
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
