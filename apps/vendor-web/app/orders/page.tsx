'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClientWithMock as apiClient } from '@/lib/api-client-with-mock';
import { OrderDetailsModal } from '@/components/vendor/orders/OrderDetailsModal';
import { OrderStatusUpdateModal } from '@/components/vendor/orders/OrderStatusUpdateModal';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { formatInrAmount, resolveVendorOrderMoney } from '@/lib/vendor-order-money';

// ============================================================================
// TYPES
// ============================================================================

interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  order_status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'refunded';
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  payment_method: string;
  payment_status: string;
  shipping_address: any;
  tracking_number?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at: string;
  items?: OrderItem[];
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  product_image?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function VendorOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI States
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    // Set mock vendorId if not exists (for local testing)
    if (typeof window !== 'undefined' && !localStorage.getItem('vendorId')) {
      localStorage.setItem('vendorId', 'mock-vendor-id');
    }
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) {
      router.push('/onboarding');
      return;
    }
    loadOrders();
  }, [router, filterStatus, filterDate]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterDate !== 'all') params.append('dateFilter', filterDate);
      if (searchTerm) params.append('search', searchTerm);

      const [ordersRes, statsRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/orders?${params.toString()}`).catch(() => ({ orders: [] })),
        apiClient.get<any>(`/vendor/${vendorId}/orders/stats`).catch(() => ({ stats: {} })),
      ]);

      setOrders(ordersRes.orders || ordersRes || []);
      
      if (statsRes.stats || statsRes) {
        const statsData = statsRes.stats || statsRes;
        setStats({
          total: statsData.total || 0,
          pending: statsData.pending || 0,
          confirmed: statsData.confirmed || 0,
          processing: statsData.processing || 0,
          shipped: statsData.shipped || 0,
          delivered: statsData.delivered || 0,
          cancelled: statsData.cancelled || 0,
          totalRevenue: statsData.total_revenue || 0,
        });
      }
    } catch (err: any) {
      console.error('Error loading orders:', err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (order: Order) => {
    try {
      // Load full order details with items
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      const orderDetails = await apiClient.get<any>(`/orders/${order.id}`);
      setSelectedOrder({
        ...order,
        ...orderDetails.order,
        items: orderDetails.order?.items || [],
      });
      setShowDetailsModal(true);
    } catch (err: any) {
      console.error('Error loading order details:', err);
      alert(err.message || 'Failed to load order details');
    }
  };

  const handleUpdateStatus = (order: Order) => {
    setSelectedOrder(order);
    setShowStatusModal(true);
  };

  const handleCancelOrder = async (order: Order) => {
    const reason = prompt('Please provide cancellation reason:');
    if (!reason) return;

    if (!confirm(`Are you sure you want to cancel order ${order.order_number}?`)) {
      return;
    }

    try {
      await apiClient.post(`/orders/${order.id}/cancel`, { reason });
      alert('Order cancelled successfully');
      loadOrders();
    } catch (err: any) {
      console.error('Error cancelling order:', err);
      alert(err.message || 'Failed to cancel order');
    }
  };

  const handleCreateShipment = async (order: Order) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      const response = await apiClient.post('/logistics/shiprocket/create-order', {
        orderId: order.id,
        orderNumber: order.order_number,
        customerId: order.customer_id,
        shippingAddress: order.shipping_address,
        paymentMethod: order.payment_method,
        subTotal: order.subtotal,
      });

      if (response.shipment?.awb_code) {
        alert(`Shipment created! AWB: ${response.shipment.awb_code}`);
        loadOrders();
      }
    } catch (err: any) {
      console.error('Error creating shipment:', err);
      alert(err.message || 'Failed to create shipment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'processing': return 'bg-purple-100 text-purple-700';
      case 'shipped': return 'bg-indigo-100 text-indigo-700';
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'returned': return 'bg-orange-100 text-orange-700';
      case 'refunded': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getNextStatus = (currentStatus: string): string[] => {
    const transitions: Record<string, string[]> = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['delivered', 'returned'],
      'delivered': ['returned'],
      'cancelled': [],
      'returned': ['refunded'],
      'refunded': [],
    };
    return transitions[currentStatus] || [];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="Order Management"
          subtitle="Manage your e-commerce orders"
          onBack={() => router.push('/')}
        />

        <div className="w-full px-4 py-6 sm:px-6">

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4">
            <p className="text-xs text-yellow-600">Pending</p>
            <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-blue-600">Confirmed</p>
            <p className="text-2xl font-bold text-blue-700">{stats.confirmed}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4">
            <p className="text-xs text-purple-600">Processing</p>
            <p className="text-2xl font-bold text-purple-700">{stats.processing}</p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-4">
            <p className="text-xs text-indigo-600">Shipped</p>
            <p className="text-2xl font-bold text-indigo-700">{stats.shipped}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-xs text-green-600">Delivered</p>
            <p className="text-2xl font-bold text-green-700">{stats.delivered}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-xs text-red-600">Cancelled</p>
            <p className="text-2xl font-bold text-red-700">{stats.cancelled}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4">
            <p className="text-xs text-orange-600">Goods revenue</p>
            <p className="text-lg font-bold text-orange-700">₹{stats.totalRevenue.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && loadOrders()}
                placeholder="Order number, customer..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={loadOrders}
                className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-500 text-lg mb-4">No orders found</p>
            <p className="text-gray-400 text-sm">Orders will appear here once customers place them</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Order #{order.order_number}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.order_status)}`}>
                        {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
                      <div>
                        <p className="text-gray-500">Customer</p>
                        <p className="font-medium text-gray-900">{order.customer_name || 'N/A'}</p>
                        <p className="text-gray-400 text-xs">{order.customer_phone || ''}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Your goods</p>
                        <p className="font-semibold text-orange-600 tabular-nums">
                          {formatInrAmount(resolveVendorOrderMoney(order).vendorGoodsAmount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Payment</p>
                        <p className="font-medium text-gray-900 capitalize">{order.payment_method || 'N/A'}</p>
                        <p className={`text-xs ${order.payment_status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                          {order.payment_status || 'pending'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Date</p>
                        <p className="font-medium text-gray-900">
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {new Date(order.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    {order.tracking_number && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700">
                          📦 Tracking: <span className="font-medium">{order.tracking_number}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="ml-6 flex flex-col gap-2">
                    <button
                      onClick={() => handleViewDetails(order)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                    >
                      View Details
                    </button>
                    
                    {getNextStatus(order.order_status).length > 0 && (
                      <button
                        onClick={() => handleUpdateStatus(order)}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition"
                      >
                        Update Status
                      </button>
                    )}

                    {order.order_status === 'processing' && !order.tracking_number && (
                      <button
                        onClick={() => handleCreateShipment(order)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition"
                      >
                        Create Shipment
                      </button>
                    )}

                    {['pending', 'confirmed'].includes(order.order_status) && (
                      <button
                        onClick={() => handleCancelOrder(order)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

      {/* Modals */}
      <OrderDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onStatusUpdate={() => {
          setShowDetailsModal(false);
          loadOrders();
        }}
      />

      <OrderStatusUpdateModal
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onSuccess={() => {
          setShowStatusModal(false);
          setSelectedOrder(null);
          loadOrders();
        }}
      />
      </div>
    </div>
  );
}

