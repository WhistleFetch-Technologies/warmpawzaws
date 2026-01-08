'use client';
import { useState, useEffect } from 'react';
import {
  Store,
  Package,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Eye,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export function ECommerceDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/ecommerce/analytics/platform');
      setAnalytics((data as any).data || data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Revenue',
      value: `₹${analytics?.totalRevenue?.toLocaleString() || 0}`,
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign,
      color: 'bg-green-50 text-green-600',
    },
    {
      title: 'Total Commission',
      value: `₹${analytics?.totalCommission?.toLocaleString() || 0}`,
      change: '+8.2%',
      trend: 'up',
      icon: TrendingUp,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Active Sellers',
      value: analytics?.activeSellers || 0,
      change: `${analytics?.totalSellers || 0} total`,
      trend: 'neutral',
      icon: Store,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      title: 'Total Orders',
      value: analytics?.totalOrders || 0,
      change: '+15.3%',
      trend: 'up',
      icon: ShoppingCart,
      color: 'bg-orange-50 text-orange-600',
    },
  ];

  const quickActions = [
    {
      label: 'Pending Approvals',
      count: analytics?.pendingApprovals || 0,
      color: 'text-yellow-600',
    },
    {
      label: 'Active Products',
      count: analytics?.activeProducts || 0,
      color: 'text-green-600',
    },
    {
      label: 'Total Products',
      count: analytics?.totalProducts || 0,
      color: 'text-blue-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-black text-2xl">E-Commerce Overview</h2>
        <p className="text-gray-500 mt-1">
          Monitor your marketplace performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              {stat.trend === 'up' && (
                <ArrowUp className="w-4 h-4 text-green-600" />
              )}
              {stat.trend === 'down' && (
                <ArrowDown className="w-4 h-4 text-red-600" />
              )}
            </div>
            <div className="mt-4">
              <p className="text-gray-500 text-sm">{stat.title}</p>
              <p className="text-black text-2xl mt-1">{stat.value}</p>
              <p
                className={`text-xs mt-1 ${
                  stat.trend === 'up'
                    ? 'text-green-600'
                    : stat.trend === 'down'
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {stat.change}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        {quickActions.map((action, index) => (
          <div
            key={index}
            className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">{action.label}</p>
                <p className={`text-3xl font-bold mt-2 ${action.color}`}>
                  {action.count}
                </p>
              </div>
              <Eye className="w-6 h-6 text-gray-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {analytics?.pendingApprovals > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">Action Required</p>
              <p className="text-sm text-yellow-700 mt-1">
                You have {analytics.pendingApprovals} product(s) waiting for
                approval.
                <button className="ml-1 underline hover:no-underline">
                  Review now
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-black font-semibold">Marketplace Health</h3>
        </div>
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Sellers */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-black">Sellers</h4>
                <Store className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Active</span>
                  <span className="font-semibold text-green-600">
                    {analytics?.activeSellers || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="font-semibold text-black">
                    {analytics?.totalSellers || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Products */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-black">Products</h4>
                <Package className="w-5 h-5 text-gray-400" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Active</span>
                  <span className="font-semibold text-green-600">
                    {analytics?.activeProducts || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="font-semibold text-black">
                    {analytics?.totalProducts || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

