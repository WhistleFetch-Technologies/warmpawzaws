'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  IndianRupee,
  Percent,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  RefreshCcw,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import {
  formatCommissionRateDisplay,
  formatCommissionRateSource,
  parseVendorCommissionAnalytics,
} from '@/lib/vendor-commission-analytics';
import { formatInrAmount, resolveVendorOrderMoney } from '@/lib/vendor-order-money';

interface SellerDashboardProps {
  sellerId: string;
  sellerName: string;
  /** Switches Seller Hub to the Orders tab (no full page reload). */
  onViewAllOrders?: () => void;
  /** Switches Seller Hub to the Inventory tab (no full page reload). */
  onNavigateToInventory?: () => void;
}

/** Normalized dashboard metrics for the seller UI */
export interface SellerDashboardMetrics {
  totalRevenue: number;
  monthRevenue: number;
  netEarnings: number;
  commissionRate: number | null;
  commissionConfigured: boolean;
  commissionRateSource: string | null;
  totalOrders: number;
  pendingOrders: number;
  activeProducts: number;
  lowStockProducts: number;
  totalCommission: number;
  monthlyCommission: number;
  pendingPayout: number;
  todaySales: number;
  todayOrders: number;
  avgRating: number | null;
  /** Last 7 days vs prior 7 days within current-month daily series; null if unknown */
  revenueTrendPercent: number | null;
}

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

function revenueTrendFromDaily(
  revenueByDay: Array<{ date?: string; revenue?: unknown }> | undefined
): number | null {
  if (!revenueByDay?.length) return null;
  const sorted = [...revenueByDay]
    .map((d) => ({
      date: String(d.date ?? ''),
      rev: safeNum(d.revenue, 0),
    }))
    .filter((d) => d.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 8) return null;
  const last7 = sorted.slice(-7).reduce((s, d) => s + d.rev, 0);
  const prev7 = sorted.slice(-14, -7).reduce((s, d) => s + d.rev, 0);
  if (last7 <= 0 && prev7 <= 0) return null;
  if (prev7 <= 0) return last7 > 0 ? 100 : null;
  return ((last7 - prev7) / prev7) * 100;
}

function emptyMetrics(): SellerDashboardMetrics {
  return {
    totalRevenue: 0,
    monthRevenue: 0,
    netEarnings: 0,
    commissionRate: null,
    commissionConfigured: false,
    commissionRateSource: null,
    totalOrders: 0,
    pendingOrders: 0,
    activeProducts: 0,
    lowStockProducts: 0,
    totalCommission: 0,
    monthlyCommission: 0,
    pendingPayout: 0,
    todaySales: 0,
    todayOrders: 0,
    avgRating: null,
    revenueTrendPercent: null,
  };
}

export function SellerDashboard({ sellerId, sellerName, onViewAllOrders, onNavigateToInventory }: SellerDashboardProps) {
  const [metrics, setMetrics] = useState<SellerDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [sellerId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const base = `/vendor/${sellerId}`;

      const [
        salesMonthRes,
        salesTodayRes,
        statsAllRes,
        statsMonthRes,
        commissionRes,
        productsRes,
        lowStockRes,
        profileRes,
        ordersRes,
      ] = await Promise.allSettled([
        apiClient.get<Record<string, unknown>>(`${base}/analytics/sales?period=month`),
        apiClient.get<Record<string, unknown>>(`${base}/analytics/sales?period=today`),
        apiClient.get<{ stats?: Record<string, unknown> }>(`${base}/orders/stats?dateFilter=all`),
        apiClient.get<{ stats?: Record<string, unknown> }>(`${base}/orders/stats?dateFilter=month`),
        apiClient.get<Record<string, unknown>>(`${base}/commission-analytics`),
        apiClient.get<{ total?: unknown }>(`${base}/products?status=active&limit=1`),
        apiClient.get<{ count?: unknown }>(`${base}/products/low-stock?threshold=10`),
        apiClient.get<{ vendor?: Record<string, unknown> }>(`${base}/profile`),
        apiClient.get<{ orders?: any[] }>(`${base}/orders?limit=5`),
      ]);

      const m = emptyMetrics();

      if (statsAllRes.status === 'fulfilled' && statsAllRes.value?.stats) {
        const s = statsAllRes.value.stats;
        m.totalOrders = safeNum(s.total, 0);
        m.pendingOrders = safeNum(s.pending, 0);
        m.totalRevenue = safeNum(s.total_revenue, 0);
        m.netEarnings = safeNum(s.net_earnings, 0);
        m.totalCommission = safeNum(s.total_commission, 0);
      }

      if (statsMonthRes.status === 'fulfilled' && statsMonthRes.value?.stats) {
        const s = statsMonthRes.value.stats;
        m.monthRevenue = safeNum(s.total_revenue, 0);
        m.monthlyCommission = safeNum(s.total_commission, 0);
        m.pendingPayout = safeNum(s.net_earnings, 0);
      }

      let revenueByDay: Array<{ date?: string; revenue?: unknown }> | undefined;
      if (salesMonthRes.status === 'fulfilled') {
        const body = salesMonthRes.value;
        const sm = pickSalesStats(body);
        if (sm) {
          const mr = safeNum(sm.total_revenue, 0);
          if (m.monthRevenue <= 0 && mr > 0) m.monthRevenue = mr;
          const mc = safeNum(sm.total_commission, 0);
          if (m.monthlyCommission <= 0 && mc > 0) m.monthlyCommission = mc;
        }
        const rbd = (body as { revenueByDay?: typeof revenueByDay }).revenueByDay;
        if (Array.isArray(rbd)) revenueByDay = rbd;
        m.revenueTrendPercent = revenueTrendFromDaily(revenueByDay);
      }

      if (salesTodayRes.status === 'fulfilled') {
        const sm = pickSalesStats(salesTodayRes.value);
        if (sm) {
          m.todaySales = safeNum(sm.total_revenue, 0);
          m.todayOrders = safeNum(sm.total_orders, 0);
        }
      }

      if (productsRes.status === 'fulfilled') {
        m.activeProducts = safeNum(productsRes.value?.total, 0);
      }

      if (lowStockRes.status === 'fulfilled') {
        m.lowStockProducts = safeNum(lowStockRes.value?.count, 0);
      }

      if (profileRes.status === 'fulfilled') {
        const v = profileRes.value?.vendor;
        const ar =
          v?.avg_rating ??
          v?.average_rating ??
          v?.averageRating ??
          (v as { avgRating?: unknown })?.avgRating;
        const rating = safeNum(ar, NaN);
        if (Number.isFinite(rating) && rating > 0) m.avgRating = rating;
      }

      if (commissionRes.status === 'fulfilled' && commissionRes.value) {
        const commissionAnalytics = parseVendorCommissionAnalytics(commissionRes.value);
        if (commissionAnalytics) {
          m.commissionConfigured = commissionAnalytics.commissionConfigured;
          m.commissionRate = commissionAnalytics.commissionRate;
          m.commissionRateSource = commissionAnalytics.commissionRateSource;
          if (commissionAnalytics.pendingPayout > 0) {
            m.pendingPayout = commissionAnalytics.pendingPayout;
          }
          if (m.netEarnings <= 0 && commissionAnalytics.netEarnings > 0) {
            m.netEarnings = commissionAnalytics.netEarnings;
          }
          if (m.totalCommission <= 0 && commissionAnalytics.totalCommission > 0) {
            m.totalCommission = commissionAnalytics.totalCommission;
          }
        }
      }

      setMetrics(m);

      if (ordersRes.status === 'fulfilled') {
        setRecentOrders(ordersRes.value?.orders || []);
      } else {
        setRecentOrders([]);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setMetrics(emptyMetrics());
      setRecentOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const statCards = useMemo(() => {
    const a = metrics ?? emptyMetrics();
    const trend = a.revenueTrendPercent;
    const hasTrend = trend !== null && Number.isFinite(trend);
    const revenueSub = hasTrend
      ? `${trend >= 0 ? '+' : ''}${trend!.toFixed(1)}% vs prior week (this month)`
      : `This month: ₹${a.monthRevenue.toLocaleString()}`;
    const revenueTrendType: 'up' | 'down' | 'neutral' =
      !hasTrend ? 'neutral' : trend! >= 0 ? 'up' : 'down';

    return [
      {
        title: 'Total Revenue',
        value: `₹${a.totalRevenue.toLocaleString()}`,
        change: revenueSub,
        trend: revenueTrendType,
        icon: IndianRupee,
        gradient: 'from-emerald-500 to-teal-500',
        bgLight: 'bg-emerald-50',
      },
      {
        title: 'Net Earnings',
        value: `₹${a.netEarnings.toLocaleString()}`,
        change: 'Your payout after commission',
        trend: 'neutral' as const,
        icon: TrendingUp,
        gradient: 'from-blue-500 to-indigo-500',
        bgLight: 'bg-blue-50',
      },
      {
        title: 'Total Orders',
        value: a.totalOrders,
        change: `${a.pendingOrders} pending`,
        trend: 'neutral' as const,
        icon: ShoppingCart,
        gradient: 'from-violet-500 to-purple-500',
        bgLight: 'bg-violet-50',
      },
      {
        title: 'Active Products',
        value: a.activeProducts,
        change: `${a.lowStockProducts} low stock`,
        trend: a.lowStockProducts > 0 ? ('down' as const) : ('neutral' as const),
        icon: Package,
        gradient: 'from-orange-500 to-amber-500',
        bgLight: 'bg-orange-50',
      },
    ];
  }, [metrics]);

  if (loading || !metrics) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center sm:min-h-[400px]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500 sm:h-16 sm:w-16"></div>
          <p className="mt-3 text-sm text-slate-500 sm:mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const analytics = metrics;

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'processing':
        return <RefreshCcw className="w-4 h-4 text-blue-600" />;
      case 'shipped':
        return <Truck className="w-4 h-4 text-indigo-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <div className="space-y-3 p-1 sm:space-y-6 sm:p-6 lg:p-8">
      <div className="rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 p-3 text-white shadow-lg shadow-orange-500/20 sm:rounded-3xl sm:p-6 lg:p-8">
        <h1 className="truncate text-sm font-bold sm:text-3xl">
          <span className="sm:hidden">Hi, {sellerName}</span>
          <span className="hidden sm:inline">Welcome back, {sellerName}! 👋</span>
        </h1>
        <p className="mt-1 hidden text-orange-100 sm:block sm:text-lg">Here's what's happening with your store today.</p>

        <div className="mt-2.5 grid grid-cols-2 gap-1.5 md:grid-cols-4 sm:mt-6 sm:gap-4">
          <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm sm:rounded-2xl sm:p-4">
            <p className="text-[10px] text-orange-100 sm:text-sm">Today's Sales</p>
            <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-2xl">₹{analytics.todaySales.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm sm:rounded-2xl sm:p-4">
            <p className="text-[10px] text-orange-100 sm:text-sm">Orders Today</p>
            <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-2xl">{analytics.todayOrders}</p>
          </div>
          <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm sm:rounded-2xl sm:p-4">
            <p className="text-[10px] text-orange-100 sm:text-sm">Pending</p>
            <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-2xl">{analytics.pendingOrders}</p>
          </div>
          <div className="rounded-lg bg-white/20 p-2 backdrop-blur-sm sm:rounded-2xl sm:p-4">
            <p className="text-[10px] text-orange-100 sm:text-sm">Rating</p>
            <p className="mt-0.5 text-sm font-bold sm:mt-1 sm:text-2xl">
              {analytics.avgRating != null && analytics.avgRating > 0
                ? `⭐ ${analytics.avgRating.toFixed(1)}`
                : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 sm:gap-6">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-6 sm:shadow-lg sm:shadow-slate-100/50 hover:shadow-xl transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className={`rounded-lg bg-gradient-to-br p-1.5 shadow-md sm:rounded-xl sm:p-3 ${stat.gradient}`}>
                <stat.icon className="h-3.5 w-3.5 text-white sm:h-6 sm:w-6" />
              </div>
              {stat.trend === 'up' && <ArrowUp className="h-3.5 w-3.5 text-emerald-600 sm:h-5 sm:w-5" />}
              {stat.trend === 'down' && <ArrowDown className="h-3.5 w-3.5 text-red-600 sm:h-5 sm:w-5" />}
            </div>
            <div className="mt-2 sm:mt-4">
              <p className="text-[11px] font-medium text-slate-500 sm:text-sm">{stat.title}</p>
              <p className="mt-0.5 truncate text-base font-bold text-slate-900 sm:mt-1 sm:text-3xl">{stat.value}</p>
              <p
                className={`mt-1 line-clamp-2 text-[10px] font-medium sm:mt-2 sm:text-sm ${
                  stat.trend === 'up'
                    ? 'text-emerald-600'
                    : stat.trend === 'down'
                      ? 'text-red-600'
                      : 'text-slate-500'
                }`}
              >
                {stat.change}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 p-3 text-white shadow-xl sm:rounded-2xl sm:p-6 lg:p-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-white/10 p-2 sm:rounded-xl sm:p-3">
              <Percent className="h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold sm:text-xl">Commission Rate</h3>
              <p className="mt-0.5 hidden text-sm text-slate-400 sm:block">
                {analytics.commissionConfigured
                  ? 'Your shop commission rate on catalog sales'
                  : 'Shop commission is not configured yet'}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold text-orange-400 sm:text-5xl">
              {formatCommissionRateDisplay(analytics.commissionRate, analytics.commissionConfigured)}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 sm:text-sm">
              {analytics.commissionConfigured
                ? formatCommissionRateSource(analytics.commissionRateSource) ?? 'Platform fee'
                : 'Contact support to set up'}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 sm:mt-6 sm:gap-4 sm:pt-6">
          <div>
            <p className="text-[10px] text-slate-400 sm:text-sm">
              <span className="sm:hidden">Commission</span>
              <span className="hidden sm:inline">Total Commission Paid</span>
            </p>
            <p className="mt-0.5 text-xs font-semibold sm:mt-1 sm:text-xl">₹{Math.round(analytics.totalCommission).toLocaleString()}</p>
            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">From your catalog goods sold</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 sm:text-sm">This month</p>
            <p className="mt-0.5 text-xs font-semibold sm:mt-1 sm:text-xl">₹{Math.round(analytics.monthlyCommission).toLocaleString()}</p>
            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">Platform fee this month</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 sm:text-sm">Next payout</p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-400 sm:mt-1 sm:text-xl">
              ₹{Math.round(analytics.pendingPayout).toLocaleString()}
            </p>
            <p className="mt-0.5 hidden text-xs text-slate-500 sm:block">Pending seller share</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm sm:rounded-2xl sm:shadow-lg sm:shadow-slate-100/50">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:p-6">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 sm:text-xl">Recent Orders</h2>
            <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">Latest orders from your store</p>
          </div>
          {onViewAllOrders ? (
            <button
              type="button"
              onClick={onViewAllOrders}
              className="shrink-0 text-xs font-semibold text-orange-600 hover:text-orange-700 hover:underline sm:text-sm"
            >
              View all →
            </button>
          ) : null}
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center sm:p-12">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 sm:mb-4 sm:h-16 sm:w-16">
              <ShoppingCart className="h-6 w-6 text-slate-400 sm:h-8 sm:w-8" />
            </div>
            <p className="text-sm font-medium text-slate-600 sm:text-base">No orders yet</p>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">Orders will appear here when customers purchase</p>
          </div>
        ) : (
          <div className="space-y-2 bg-slate-50/80 p-2 sm:space-y-0 sm:bg-transparent sm:p-0 sm:divide-y sm:divide-slate-100">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-slate-200 bg-white p-3 sm:rounded-none sm:border-0 sm:p-5 sm:hover:bg-slate-50"
              >
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 sm:h-12 sm:w-12 sm:rounded-xl">
                    {getOrderStatusIcon(order.status)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900 sm:text-base">
                      Order #{(order.id || '').slice(-8)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 sm:mt-1 sm:gap-2 sm:text-sm">
                      <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      {new Date(order.createdAt || order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-bold tabular-nums text-slate-900 sm:text-lg">
                      {formatInrAmount(resolveVendorOrderMoney(order).vendorGoodsAmount)}
                    </p>
                    <span
                      className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize sm:mt-1 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs ${
                        order.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-700'
                          : order.status === 'processing'
                            ? 'bg-blue-100 text-blue-700'
                            : order.status === 'shipped'
                              ? 'bg-indigo-100 text-indigo-700'
                              : order.status === 'pending'
                                ? 'bg-amber-100 text-amber-700'
                                : order.status === 'cancelled'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="hidden sm:inline">{getOrderStatusIcon(order.status)}</span>
                      {order.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {analytics.lowStockProducts > 0 && (
        <div className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-3 sm:rounded-2xl sm:p-6">
          <div className="flex items-start gap-2.5 sm:gap-4">
            <div className="rounded-lg bg-red-100 p-2 sm:rounded-xl sm:p-3">
              <AlertCircle className="h-4 w-4 text-red-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-900 sm:text-lg">Low stock</p>
              <p className="mt-0.5 text-xs text-red-700 sm:mt-1 sm:text-base">
                <span className="font-bold">{analytics.lowStockProducts} product(s)</span> running low.
                <span className="hidden sm:inline"> Update your inventory to avoid stockouts.</span>
              </p>
              <button
                type="button"
                onClick={onNavigateToInventory}
                className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 sm:mt-3 sm:px-4 sm:py-2 sm:text-sm"
              >
                Update inventory →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
