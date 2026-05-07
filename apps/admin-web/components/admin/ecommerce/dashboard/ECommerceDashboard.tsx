'use client';

import { useState, useEffect } from 'react';
import {
  Store, Package, ShoppingCart, IndianRupee, TrendingUp, AlertCircle,
  Eye, ArrowUp, ArrowDown, Users, Truck, FileText, Tag, CreditCard,
  CheckCircle, Clock, XCircle, RefreshCcw, BarChart3, Settings
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ECommerceDashboardProps {
  onNavigateToSellers?: () => void;
  onNavigateToProducts?: () => void;
  onNavigateToOrders?: () => void;
  onNavigateToSettlements?: () => void;
  onNavigateToPromotions?: () => void;
  onNavigateToCategories?: () => void;
}

export function ECommerceDashboard({
  onNavigateToSellers,
  onNavigateToProducts,
  onNavigateToOrders,
  onNavigateToSettlements,
  onNavigateToPromotions,
  onNavigateToCategories
}: ECommerceDashboardProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [topSellers, setTopSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load analytics
      const analyticsResponse = await apiClient.get<any>('/admin/ecommerce/analytics/platform').catch(() => ({ data: {} }));
      setAnalytics(analyticsResponse?.data || {});
      
      // Load recent orders
      const ordersData = await apiClient.get<any>('/admin/orders?limit=5').catch(() => ({ orders: [] }));
      setRecentOrders((ordersData as any)?.orders || []);
      
      // Load pending approvals
      const approvalsData = await apiClient.get<any>('/admin/products?status=pending_approval&limit=5').catch(() => ({ products: [] }));
      setPendingApprovals((approvalsData as any)?.products || []);
      
      // Load top sellers - use e-commerce specific endpoint
      const sellersData = await apiClient.get<any>('/admin/ecommerce/top-sellers?limit=5').catch(() => ({ sellers: [] }));
      setTopSellers((sellersData as any)?.sellers || []);
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stats cards
  const stats = [
    {
      title: 'Total GMV',
      value: `₹${(analytics?.totalGMV || analytics?.totalRevenue || 0).toLocaleString()}`,
      change: '+18.5%',
      trend: 'up',
      icon: IndianRupee,
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      title: 'Platform Revenue',
      value: `₹${(analytics?.totalCommission || 0).toLocaleString()}`,
      change: '+12.3%',
      trend: 'up',
      icon: TrendingUp,
      gradient: 'from-blue-500 to-indigo-500',
    },
    {
      title: 'Active Sellers',
      value: analytics?.activeSellers || 0,
      change: `${analytics?.totalSellers || 0} total`,
      trend: 'neutral',
      icon: Store,
      gradient: 'from-purple-500 to-violet-500',
    },
    {
      title: 'Total Orders',
      value: analytics?.totalOrders || 0,
      change: '+24.7%',
      trend: 'up',
      icon: ShoppingCart,
      gradient: 'from-orange-500 to-amber-500',
    },
  ];

  // Quick metrics
  const quickMetrics = [
    { label: 'Active Products', value: analytics?.activeProducts || 0, icon: Package, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Pending Approvals', value: analytics?.pendingApprovals || 0, icon: Clock, color: 'text-amber-600 bg-amber-50' },
    { label: 'Processing Orders', value: analytics?.processingOrders || 0, icon: RefreshCcw, color: 'text-blue-600 bg-blue-50' },
    { label: 'Pending Settlements', value: analytics?.pendingSettlements || 0, icon: CreditCard, color: 'text-purple-600 bg-purple-50' },
  ];


  const getOrderStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'pending': 'bg-amber-100 text-amber-700',
      'confirmed': 'bg-blue-100 text-blue-700',
      'processing': 'bg-indigo-100 text-indigo-700',
      'shipped': 'bg-purple-100 text-purple-700',
      'delivered': 'bg-emerald-100 text-emerald-700',
      'cancelled': 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-orange-50/30 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">E-Commerce Dashboard</h1>
          <p className="text-slate-500 mt-1">Multi-vendor marketplace analytics and management</p>
        </div>
        <button 
          onClick={loadDashboardData}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-white transition-colors"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              {stat.trend === 'up' && (
                <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                  <ArrowUp className="w-4 h-4" />
                  {stat.change}
                </span>
              )}
              {stat.trend === 'down' && (
                <span className="flex items-center gap-1 text-sm font-medium text-red-600">
                  <ArrowDown className="w-4 h-4" />
                  {stat.change}
                </span>
              )}
              {stat.trend === 'neutral' && (
                <span className="text-sm text-slate-500">{stat.change}</span>
              )}
            </div>
            <p className="text-sm text-slate-500 font-medium">{stat.title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickMetrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${metric.color}`}>
              <metric.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
              <p className="text-xs text-slate-500">{metric.label}</p>
            </div>
          </div>
        ))}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Recent Orders</h3>
              <p className="text-sm text-slate-500">Latest marketplace orders</p>
            </div>
            <button 
              onClick={onNavigateToOrders}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              View All →
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No recent orders</p>
              </div>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">#{(order.order_number || order.id || '').slice(-8)}</p>
                      <p className="text-sm text-slate-500">{order.vendor_name || 'Unknown Seller'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">₹{(order.total_amount || 0).toLocaleString()}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getOrderStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Pending Approvals</h3>
              <p className="text-sm text-slate-500">Products awaiting review</p>
            </div>
            <button 
              onClick={onNavigateToProducts}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              Review All →
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingApprovals.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
                <p>All products reviewed!</p>
              </div>
            ) : (
              pendingApprovals.map((product) => (
                <div key={product.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl">
                      {product.emoji || '📦'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{product.name}</p>
                      <p className="text-sm text-slate-500">{product.vendor_name || 'Unknown Seller'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors">
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors">
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Sellers */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Top Performing Sellers</h3>
            <p className="text-sm text-slate-500">Based on revenue and order volume</p>
          </div>
          <button 
            onClick={onNavigateToSellers}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            View All Sellers →
          </button>
        </div>
        {topSellers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Store className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No seller data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left p-4 font-semibold text-slate-600 text-sm">Rank</th>
                  <th className="text-left p-4 font-semibold text-slate-600 text-sm">Seller</th>
                  <th className="text-right p-4 font-semibold text-slate-600 text-sm">Revenue</th>
                  <th className="text-center p-4 font-semibold text-slate-600 text-sm">Orders</th>
                  <th className="text-center p-4 font-semibold text-slate-600 text-sm">Products</th>
                  <th className="text-center p-4 font-semibold text-slate-600 text-sm">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topSellers.map((seller, index) => (
                  <tr key={seller.id || index} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                        index === 0 ? 'bg-amber-100 text-amber-700' :
                        index === 1 ? 'bg-slate-200 text-slate-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full flex items-center justify-center">
                          <Store className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {seller.name || seller.business_name || seller.businessName || 'Unknown Seller'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {seller.phone || seller.owner_name || seller.email || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-900">
                      ₹{(seller.total_revenue || 0).toLocaleString()}
                    </td>
                    <td className="p-4 text-center text-slate-600">
                      {seller.total_bookings || seller.order_count || 0}
                    </td>
                    <td className="p-4 text-center text-slate-600">
                      {seller.product_count || 'N/A'}
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        ⭐ {seller.avg_rating || seller.rating || '4.5'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commission & GST Summary */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <h3 className="font-semibold text-lg mb-4">Financial Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total GMV</p>
            <p className="text-2xl font-bold mt-1">₹{(analytics?.totalGMV || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Commission Earned</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">₹{(analytics?.totalCommission || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">GST Collected</p>
            <p className="text-2xl font-bold mt-1">₹{(analytics?.totalGST || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Seller Payouts</p>
            <p className="text-2xl font-bold mt-1">₹{(analytics?.totalPayouts || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Pending Settlements</p>
            <p className="text-2xl font-bold mt-1 text-amber-400">₹{(analytics?.pendingSettlementAmount || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
