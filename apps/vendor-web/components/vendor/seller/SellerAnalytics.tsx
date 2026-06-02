'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp,
  IndianRupee,
  ShoppingCart,
  Package,
  Users,
  Calendar,
  ArrowUp,
  ArrowDown,
  PackageCheck,
  RefreshCcw,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SellerAnalyticsProps {
  sellerId: string;
}

export type AnalyticsPeriod = 'week' | 'month' | 'quarter' | 'year';

interface MetricWithChange {
  current: number;
  previous: number;
  change: number | null;
}

interface SellerAnalyticsTopProduct {
  id: string;
  name: string;
  orders: number;
  revenue: number;
}

interface SellerAnalyticsRecentSale {
  id: string;
  created_at: string;
  amount: number;
}

export interface SellerAnalyticsData {
  revenue: MetricWithChange;
  orders: MetricWithChange;
  products: { active: number };
  customers: { unique: number };
  topProducts: SellerAnalyticsTopProduct[];
  recentSales: SellerAnalyticsRecentSale[];
  sellerRating: number | null;
}

const PERIODS: AnalyticsPeriod[] = ['week', 'month', 'quarter', 'year'];

function safeNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickSalesStats(body: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const stats = (body as { salesStats?: unknown }).salesStats;
  if (stats && typeof stats === 'object') return stats as Record<string, unknown>;
  const data = (body as { data?: { salesStats?: unknown } }).data;
  if (data?.salesStats && typeof data.salesStats === 'object') return data.salesStats as Record<string, unknown>;
  return null;
}

function pickPreviousSalesStats(body: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const stats = (body as { previousSalesStats?: unknown }).previousSalesStats;
  if (stats && typeof stats === 'object') return stats as Record<string, unknown>;
  const data = (body as { data?: { previousSalesStats?: unknown } }).data;
  if (data?.previousSalesStats && typeof data.previousSalesStats === 'object') {
    return data.previousSalesStats as Record<string, unknown>;
  }
  return null;
}

function pickTopProducts(body: Record<string, unknown> | null | undefined): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') return [];
  const tp = (body as { topProducts?: unknown }).topProducts;
  if (Array.isArray(tp)) return tp as Record<string, unknown>[];
  const data = (body as { data?: { topProducts?: unknown } }).data;
  if (Array.isArray(data?.topProducts)) return data.topProducts as Record<string, unknown>[];
  return [];
}

/** % change vs prior window of equal length (from compare=1 on /analytics/sales). */
function percentChange(current: number, previous: number): number | null {
  if (previous <= 0 && current <= 0) return 0;
  if (previous <= 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

function orderDateFilterForPeriod(period: AnalyticsPeriod): string {
  if (period === 'week') return 'week';
  if (period === 'month') return 'month';
  return 'all';
}

function emptyAnalyticsData(): SellerAnalyticsData {
  return {
    revenue: { current: 0, previous: 0, change: null },
    orders: { current: 0, previous: 0, change: null },
    products: { active: 0 },
    customers: { unique: 0 },
    topProducts: [],
    recentSales: [],
    sellerRating: null,
  };
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change == null) return null;
  const positive = change >= 0;
  return (
    <span
      className={`flex items-center gap-1 text-sm font-medium ${
        positive ? 'text-emerald-600' : 'text-red-600'
      }`}
    >
      {positive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

export function SellerAnalytics({ sellerId }: SellerAnalyticsProps) {
  const [analytics, setAnalytics] = useState<SellerAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');

  const loadAnalytics = useCallback(async () => {
    if (!sellerId) {
      setAnalytics(emptyAnalyticsData());
      setLoading(false);
      setError('Seller ID is missing');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const base = `/vendor/${sellerId}`;
      const orderDateFilter = orderDateFilterForPeriod(period);

      const [salesRes, productsRes, activeProductsRes, profileRes, ordersRes] = await Promise.allSettled([
        apiClient.get<Record<string, unknown>>(
          `${base}/analytics/sales?period=${period}&compare=1`
        ),
        apiClient.get<Record<string, unknown>>(
          `${base}/analytics/products?period=${period}&limit=5`
        ),
        apiClient.get<{ total?: unknown }>(`${base}/products?status=active&limit=1`),
        apiClient.get<{ vendor?: Record<string, unknown> }>(`${base}/profile`),
        apiClient.get<{ orders?: Record<string, unknown>[] }>(
          `${base}/orders?limit=5&dateFilter=${orderDateFilter}`
        ),
      ]);

      const data = emptyAnalyticsData();
      let loadFailed = false;

      if (salesRes.status === 'fulfilled') {
        const current = pickSalesStats(salesRes.value);
        const previous = pickPreviousSalesStats(salesRes.value);
        if (current) {
          const rev = safeNum(current.total_revenue, 0);
          const prevRev = safeNum(previous?.total_revenue, 0);
          const ord = safeNum(current.total_orders, 0);
          const prevOrd = safeNum(previous?.total_orders, 0);
          data.revenue = {
            current: rev,
            previous: prevRev,
            change: percentChange(rev, prevRev),
          };
          data.orders = {
            current: ord,
            previous: prevOrd,
            change: percentChange(ord, prevOrd),
          };
          data.customers.unique = safeNum(current.unique_customers, 0);
        }
      } else {
        loadFailed = true;
        console.error('[SellerAnalytics] sales analytics failed:', salesRes.reason);
      }

      if (productsRes.status === 'fulfilled') {
        data.topProducts = pickTopProducts(productsRes.value).map((p) => ({
          id: String(p.id ?? ''),
          name: String(p.name ?? 'Product'),
          orders: safeNum(p.units_sold ?? p.total_quantity, 0),
          revenue: safeNum(p.revenue, 0),
        }));
      } else {
        loadFailed = true;
        console.error('[SellerAnalytics] product analytics failed:', productsRes.reason);
      }

      if (activeProductsRes.status === 'fulfilled') {
        data.products.active = safeNum(activeProductsRes.value?.total, 0);
      }

      if (profileRes.status === 'fulfilled') {
        const v = profileRes.value?.vendor;
        const ar =
          v?.avg_rating ??
          v?.average_rating ??
          v?.averageRating ??
          (v as { avgRating?: unknown })?.avgRating;
        const rating = safeNum(ar, NaN);
        if (Number.isFinite(rating) && rating > 0) data.sellerRating = rating;
      }

      if (ordersRes.status === 'fulfilled') {
        const orders = ordersRes.value?.orders ?? [];
        data.recentSales = orders.slice(0, 5).map((o) => ({
          id: String(o.id ?? ''),
          created_at: String(o.created_at ?? o.createdAt ?? new Date().toISOString()),
          amount: safeNum(o.total_amount ?? o.totalAmount, 0),
        }));
      } else {
        console.error('[SellerAnalytics] recent orders failed:', ordersRes.reason);
      }

      setAnalytics(data);
      if (loadFailed) {
        setError('Some analytics data could not be loaded. Try again.');
      }
    } catch (err) {
      console.error('[SellerAnalytics] Error loading analytics:', err);
      setAnalytics(null);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [sellerId, period]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

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

  if (error && !analytics) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-700 font-medium">{error}</p>
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            <RefreshCcw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const a = analytics ?? emptyAnalyticsData();
  const avgOrderValue =
    a.orders.current > 0 ? Math.round(a.revenue.current / a.orders.current) : 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics & Insights</h1>
          <p className="text-slate-500 mt-1">Track your store&apos;s performance</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
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

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => void loadAnalytics()}
            className="shrink-0 font-medium text-orange-600 hover:text-orange-700"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shadow-lg">
              <IndianRupee className="w-6 h-6 text-white" />
            </div>
            <ChangeBadge change={a.revenue.change} />
          </div>
          <p className="text-sm text-slate-500">Total Revenue</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            ₹{a.revenue.current.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            vs ₹{a.revenue.previous.toLocaleString()} prior period
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
            <ChangeBadge change={a.orders.change} />
          </div>
          <p className="text-sm text-slate-500">Total Orders</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{a.orders.current}</p>
          <p className="text-xs text-slate-400 mt-2">vs {a.orders.previous} prior period</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl shadow-lg">
              <PackageCheck className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Active Products</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{a.products.active}</p>
          <p className="text-xs text-slate-400 mt-2">Listed in your catalog</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Customers</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{a.customers.unique}</p>
          <p className="text-xs text-slate-400 mt-2">Unique buyers in this period</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Top Performing Products
          </h3>
          {a.topProducts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No product data yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {a.topProducts.map((product, index) => (
                <div key={product.id || index} className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex items-center justify-center text-sm font-bold text-orange-600">
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{product.name}</p>
                    <p className="text-sm text-slate-500">{product.orders} units sold</p>
                  </div>
                  <p className="font-bold text-slate-900 shrink-0">
                    ₹{product.revenue.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Recent Sales
          </h3>
          {a.recentSales.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No recent sales</p>
            </div>
          ) : (
            <div className="space-y-4">
              {a.recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      Order #{(sale.id || '').slice(-6)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(sale.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="font-bold text-emerald-600">
                    +₹{sale.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <h3 className="font-semibold text-lg mb-4">Performance Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Avg. Order Value</p>
            <p className="text-2xl font-bold mt-1">₹{avgOrderValue.toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Conversion Rate</p>
            <p className="text-2xl font-bold mt-1">—</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Repeat Purchase</p>
            <p className="text-2xl font-bold mt-1">—</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Seller Rating</p>
            <p className="text-2xl font-bold mt-1">
              {a.sellerRating != null ? `⭐ ${a.sellerRating.toFixed(1)}` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
