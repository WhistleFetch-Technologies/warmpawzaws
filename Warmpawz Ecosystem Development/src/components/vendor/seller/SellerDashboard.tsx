import { useState, useEffect } from 'react';
import { 
  Package, ShoppingCart, TrendingUp, AlertCircle, 
  DollarSign, Eye, Percent, ArrowUp, ArrowDown, Clock
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

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
      const analyticsRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/analytics/seller/${sellerId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }
      
      // Load recent orders
      const ordersRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/orders?sellerId=${sellerId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setRecentOrders(ordersData.orders.slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Revenue',
      value: `₹${analytics?.totalRevenue?.toLocaleString() || 0}`,
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign,
      color: 'bg-green-50 text-green-600'
    },
    {
      title: 'Net Earnings',
      value: `₹${analytics?.netEarnings?.toLocaleString() || 0}`,
      change: `${analytics?.commissionRate}% commission`,
      trend: 'neutral',
      icon: TrendingUp,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      title: 'Total Orders',
      value: analytics?.totalOrders || 0,
      change: `${analytics?.pendingOrders || 0} pending`,
      trend: 'neutral',
      icon: ShoppingCart,
      color: 'bg-purple-50 text-purple-600'
    },
    {
      title: 'Active Products',
      value: analytics?.activeProducts || 0,
      change: `${analytics?.lowStockProducts || 0} low stock`,
      trend: analytics?.lowStockProducts > 0 ? 'down' : 'neutral',
      icon: Package,
      color: 'bg-orange-50 text-orange-600'
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-black">Welcome back, {sellerName}!</h1>
        <p className="text-gray-500 mt-1">Here's what's happening with your store today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              {stat.trend === 'up' && <ArrowUp className="w-4 h-4 text-green-600" />}
              {stat.trend === 'down' && <ArrowDown className="w-4 h-4 text-red-600" />}
            </div>
            <div className="mt-4">
              <p className="text-gray-500 text-sm">{stat.title}</p>
              <p className="text-black text-2xl mt-1">{stat.value}</p>
              <p className={`text-xs mt-1 ${
                stat.trend === 'up' ? 'text-green-600' :
                stat.trend === 'down' ? 'text-red-600' :
                'text-gray-500'
              }`}>
                {stat.change}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Commission Info */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FFA562] rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5" />
              <h3 className="font-semibold">Commission Rate</h3>
            </div>
            <p className="text-white/90 text-sm mt-1">Your current commission rate on all sales</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">{analytics?.commissionRate}%</p>
            <p className="text-white/90 text-sm mt-1">Platform Fee</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="flex justify-between text-sm">
            <span>Total Commission Paid</span>
            <span className="font-semibold">₹{analytics?.totalCommission?.toLocaleString() || 0}</span>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-black">Recent Orders</h2>
            <button className="text-sm text-[#FF8C42] hover:underline">View All</button>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No orders yet</p>
            </div>
          ) : (
            recentOrders.map((order) => (
              <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <div>
                        <p className="font-medium text-black">Order #{order.id.slice(-8)}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-black">₹{order.totalAmount?.toLocaleString()}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                      order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
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
      {analytics?.lowStockProducts > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Low Stock Alert</p>
              <p className="text-sm text-red-700 mt-1">
                You have {analytics.lowStockProducts} product(s) running low on stock. 
                <button className="ml-1 underline hover:no-underline">Update inventory</button>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
