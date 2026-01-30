/**
 * ========================================
 * E-COMMERCE ANALYTICS DASHBOARD
 * ========================================
 * 
 * ✅ FIXED: Complete implementation
 * ✅ FIXED: Real API integration
 * ✅ FIXED: Charts and KPIs
 * 
 * Features:
 * - Revenue analytics
 * - Order analytics
 * - Seller analytics
 * - Product analytics
 * - Growth trends
 * - Top performers
 */

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  ShoppingCart, 
  Package, 
  Users, 
  DollarSign,
  ArrowUp,
  ArrowDown,
  Calendar,
  Download,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { authenticatedGet } from '../../../utils/authenticatedFetch';
import { getApiBaseUrl } from '../../../utils/api-config';
import { publicAnonKey } from '../../../utils/api-config';

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

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Call analytics API
      const data = await authenticatedGet(
        `${getApiBaseUrl()}/ecommerce/analytics?days=${dateRange}`,
        publicAnonKey
      );

      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

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
      ...analytics.topSellers.map(s => [s.name, s.revenue, s.orders])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecommerce-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-black text-xl font-semibold">E-Commerce Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">Platform performance and insights</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#FF8C42]" />
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-black text-xl font-semibold">E-Commerce Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">Platform performance and insights</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">{error || 'Failed to load analytics'}</p>
          <Button onClick={fetchAnalytics}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-black text-xl font-semibold">E-Commerce Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">Platform performance and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
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
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className={`flex items-center gap-1 text-sm ${analytics.revenue.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analytics.revenue.growth >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {Math.abs(analytics.revenue.growth)}%
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold">₹{analytics.revenue.total.toLocaleString()}</p>
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
              <div className={`flex items-center gap-1 text-sm ${analytics.orders.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analytics.orders.growth >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {Math.abs(analytics.orders.growth)}%
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <p className="text-2xl font-bold">{analytics.orders.total.toLocaleString()}</p>
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
              <div className={`flex items-center gap-1 text-sm ${analytics.sellers.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analytics.sellers.growth >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                {Math.abs(analytics.sellers.growth)}%
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Sellers</p>
              <p className="text-2xl font-bold">{analytics.sellers.active}/{analytics.sellers.total}</p>
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
              {analytics.products.lowStock > 0 && (
                <div className="text-sm text-orange-600">
                  {analytics.products.lowStock} low stock
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Products</p>
              <p className="text-2xl font-bold">{analytics.products.active}/{analytics.products.total}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart (Simple Bar Chart) */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>Revenue breakdown by period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.revenue.byPeriod.map((period, index) => {
              const maxAmount = Math.max(...analytics.revenue.byPeriod.map(p => p.amount));
              const percentage = (period.amount / maxAmount) * 100;
              
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{period.period}</span>
                    <span className="text-sm font-semibold">₹{period.amount.toLocaleString()}</span>
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
            <div className="space-y-3">
              {Object.entries(analytics.orders.byStatus).map(([status, count]) => {
                const percentage = ((count / analytics.orders.total) * 100).toFixed(1);
                const colors: Record<string, string> = {
                  pending: 'bg-yellow-500',
                  confirmed: 'bg-blue-500',
                  shipped: 'bg-purple-500',
                  delivered: 'bg-green-500',
                  cancelled: 'bg-red-500'
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
          </CardContent>
        </Card>

        {/* Top Sellers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Sellers</CardTitle>
            <CardDescription>Best performing sellers this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topSellers.map((seller, index) => (
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
                  <p className="font-semibold">₹{seller.revenue.toLocaleString()}</p>
                </div>
              ))}
            </div>
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
          <div className="space-y-4">
            {analytics.topProducts.map((product, index) => (
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
                <p className="font-semibold">₹{product.revenue.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}