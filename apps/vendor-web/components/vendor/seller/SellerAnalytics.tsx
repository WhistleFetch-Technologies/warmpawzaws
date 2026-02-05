'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, TrendingDown, IndianRupee, ShoppingCart, 
  Package, Users, Calendar, ArrowUp, ArrowDown, Eye
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SellerAnalyticsProps {
  sellerId: string;
}

export function SellerAnalytics({ sellerId }: SellerAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    loadAnalytics();
  }, [sellerId, period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>(`/vendor/${sellerId}/analytics?period=${period}`);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      // Use mock data
      setAnalytics({
        revenue: { current: 0, previous: 0, change: 0 },
        orders: { current: 0, previous: 0, change: 0 },
        products: { total: 0, active: 0, views: 0 },
        customers: { new: 0, returning: 0 },
        topProducts: [],
        recentSales: []
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics & Insights</h1>
          <p className="text-slate-500 mt-1">Track your store's performance</p>
        </div>
        <div className="flex gap-2">
          {['week', 'month', 'quarter', 'year'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                period === p
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg">
              <IndianRupee className="w-6 h-6 text-white" />
            </div>
            {(analytics?.revenue?.change || 0) >= 0 ? (
              <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                <ArrowUp className="w-4 h-4" />
                {Math.abs(analytics?.revenue?.change || 0).toFixed(1)}%
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm font-medium text-red-600">
                <ArrowDown className="w-4 h-4" />
                {Math.abs(analytics?.revenue?.change || 0).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">Total Revenue</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">₹{(analytics?.revenue?.current || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">vs ₹{(analytics?.revenue?.previous || 0).toLocaleString()} last period</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            {(analytics?.orders?.change || 0) >= 0 ? (
              <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                <ArrowUp className="w-4 h-4" />
                {Math.abs(analytics?.orders?.change || 0).toFixed(1)}%
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm font-medium text-red-600">
                <ArrowDown className="w-4 h-4" />
                {Math.abs(analytics?.orders?.change || 0).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">Total Orders</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{analytics?.orders?.current || 0}</p>
          <p className="text-xs text-slate-400 mt-2">vs {analytics?.orders?.previous || 0} last period</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl shadow-lg">
              <Eye className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Product Views</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{(analytics?.products?.views || 0).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-2">{analytics?.products?.active || 0} active products</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Customers</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{(analytics?.customers?.new || 0) + (analytics?.customers?.returning || 0)}</p>
          <p className="text-xs text-slate-400 mt-2">{analytics?.customers?.new || 0} new, {analytics?.customers?.returning || 0} returning</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Top Performing Products
          </h3>
          {(analytics?.topProducts || []).length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No product data yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(analytics?.topProducts || []).slice(0, 5).map((product: any, index: number) => (
                <div key={product.id} className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex items-center justify-center text-sm font-bold text-orange-600">
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{product.name}</p>
                    <p className="text-sm text-slate-500">{product.orders} orders</p>
                  </div>
                  <p className="font-bold text-slate-900">₹{(product.revenue || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sales */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Recent Sales
          </h3>
          {(analytics?.recentSales || []).length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No recent sales</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(analytics?.recentSales || []).slice(0, 5).map((sale: any) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="font-medium text-slate-900">Order #{(sale.id || '').slice(-6)}</p>
                    <p className="text-sm text-slate-500">{new Date(sale.created_at).toLocaleDateString()}</p>
                  </div>
                  <p className="font-bold text-emerald-600">+₹{(sale.amount || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Performance Overview */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <h3 className="font-semibold text-lg mb-4">📊 Performance Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Avg. Order Value</p>
            <p className="text-2xl font-bold mt-1">
              ₹{analytics?.orders?.current ? Math.round((analytics?.revenue?.current || 0) / analytics.orders.current) : 0}
            </p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Conversion Rate</p>
            <p className="text-2xl font-bold mt-1">{analytics?.conversionRate || 0}%</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Repeat Purchase</p>
            <p className="text-2xl font-bold mt-1">{analytics?.repeatPurchaseRate || 0}%</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Seller Rating</p>
            <p className="text-2xl font-bold mt-1">⭐ {analytics?.sellerRating || 4.5}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
