'use client';

import { useState, useEffect } from 'react';
import { 
  Package, ShoppingCart, TrendingUp, AlertCircle, 
  DollarSign, Eye, Percent, ArrowUp, ArrowDown, Clock,
  CheckCircle, XCircle, Truck, RefreshCcw
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SellerDashboardProps {
  sellerId: string;
  sellerName: string;
}

export function SellerDashboard({ sellerId, sellerName }: SellerDashboardProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [sellerId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load analytics
      try {
        const data = await apiClient.get<any>(`/vendor/${sellerId}/analytics/seller`);
        setAnalytics(data);
      } catch (e) {
        // Use mock data if API fails
        setAnalytics({
          totalRevenue: 0,
          netEarnings: 0,
          commissionRate: 15,
          totalOrders: 0,
          pendingOrders: 0,
          activeProducts: 0,
          lowStockProducts: 0,
          totalCommission: 0
        });
      }
      
      // Load recent orders
      try {
        const ordersData = await apiClient.get<{ orders?: any[] }>(`/vendor/${sellerId}/orders?limit=5`);
        setRecentOrders(ordersData?.orders || []);
      } catch (e) {
        setRecentOrders([]);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Revenue',
      value: `₹${(analytics?.totalRevenue || 0).toLocaleString()}`,
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign,
      gradient: 'from-emerald-500 to-teal-500',
      bgLight: 'bg-emerald-50'
    },
    {
      title: 'Net Earnings',
      value: `₹${(analytics?.netEarnings || 0).toLocaleString()}`,
      change: `${analytics?.commissionRate || 15}% commission`,
      trend: 'neutral',
      icon: TrendingUp,
      gradient: 'from-blue-500 to-indigo-500',
      bgLight: 'bg-blue-50'
    },
    {
      title: 'Total Orders',
      value: analytics?.totalOrders || 0,
      change: `${analytics?.pendingOrders || 0} pending`,
      trend: 'neutral',
      icon: ShoppingCart,
      gradient: 'from-violet-500 to-purple-500',
      bgLight: 'bg-violet-50'
    },
    {
      title: 'Active Products',
      value: analytics?.activeProducts || 0,
      change: `${analytics?.lowStockProducts || 0} low stock`,
      trend: (analytics?.lowStockProducts || 0) > 0 ? 'down' : 'neutral',
      icon: Package,
      gradient: 'from-orange-500 to-amber-500',
      bgLight: 'bg-orange-50'
    }
  ];

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'processing': return <RefreshCcw className="w-4 h-4 text-blue-600" />;
      case 'shipped': return <Truck className="w-4 h-4 text-indigo-600" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 rounded-3xl p-8 text-white shadow-xl shadow-orange-500/20">
        <h1 className="text-3xl font-bold">Welcome back, {sellerName}! 👋</h1>
        <p className="text-orange-100 mt-2 text-lg">Here's what's happening with your store today.</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-orange-100 text-sm">Today's Sales</p>
            <p className="text-2xl font-bold mt-1">₹{((analytics?.todaySales || 0)).toLocaleString()}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-orange-100 text-sm">Orders Today</p>
            <p className="text-2xl font-bold mt-1">{analytics?.todayOrders || 0}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-orange-100 text-sm">Pending</p>
            <p className="text-2xl font-bold mt-1">{analytics?.pendingOrders || 0}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-orange-100 text-sm">Rating</p>
            <p className="text-2xl font-bold mt-1">⭐ {analytics?.avgRating || '4.5'}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-lg shadow-slate-100/50 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              {stat.trend === 'up' && <ArrowUp className="w-5 h-5 text-emerald-600" />}
              {stat.trend === 'down' && <ArrowDown className="w-5 h-5 text-red-600" />}
            </div>
            <div className="mt-4">
              <p className="text-slate-500 text-sm font-medium">{stat.title}</p>
              <p className="text-slate-900 text-3xl font-bold mt-1">{stat.value}</p>
              <p className={`text-sm mt-2 font-medium ${
                stat.trend === 'up' ? 'text-emerald-600' :
                stat.trend === 'down' ? 'text-red-600' :
                'text-slate-500'
              }`}>
                {stat.change}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Commission Info */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-xl">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Commission Rate</h3>
                <p className="text-slate-400 text-sm mt-1">Your current commission rate on all sales</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-5xl font-bold text-orange-400">{analytics?.commissionRate || 15}%</p>
            <p className="text-slate-400 text-sm mt-1">Platform Fee</p>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-3 gap-4">
          <div>
            <p className="text-slate-400 text-sm">Total Commission Paid</p>
            <p className="text-xl font-semibold mt-1">₹{(analytics?.totalCommission || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">This Month</p>
            <p className="text-xl font-semibold mt-1">₹{(analytics?.monthlyCommission || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Next Payout</p>
            <p className="text-xl font-semibold mt-1 text-emerald-400">₹{(analytics?.pendingPayout || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-100/50 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Recent Orders</h2>
            <p className="text-sm text-slate-500 mt-1">Latest orders from your store</p>
          </div>
          <button className="text-sm text-orange-600 hover:text-orange-700 font-semibold hover:underline">
            View All Orders →
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {recentOrders.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No orders yet</p>
              <p className="text-sm text-slate-400 mt-1">Orders will appear here when customers purchase</p>
            </div>
          ) : (
            recentOrders.map((order) => (
              <div key={order.id} className="p-5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center">
                      {getOrderStatusIcon(order.status)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Order #{(order.id || '').slice(-8)}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(order.createdAt || order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 text-lg">₹{(order.totalAmount || order.total_amount || 0).toLocaleString()}</p>
                    <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium ${
                      order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                      order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'shipped' ? 'bg-indigo-100 text-indigo-700' :
                      order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {getOrderStatusIcon(order.status)}
                      {order.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Low Stock Alert */}
      {(analytics?.lowStockProducts || 0) > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-xl">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-900 text-lg">Low Stock Alert</p>
              <p className="text-red-700 mt-1">
                You have <span className="font-bold">{analytics.lowStockProducts} product(s)</span> running low on stock. 
                Update your inventory to avoid stockouts.
              </p>
              <button className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors">
                Update Inventory →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
