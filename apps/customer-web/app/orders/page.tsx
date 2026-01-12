'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClientWithMock as apiClient } from '@/lib/api-client-with-mock';
import Link from 'next/link';

// ============================================================================
// TYPES
// ============================================================================

interface Order {
  id: string;
  order_number: string;
  vendor_id: string;
  vendor_name?: string;
  total_amount: number;
  discount_amount?: number;
  final_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  delivery_address: any;
  delivery_status?: string;
  tracking_number?: string;
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

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    // Set mock customerId if not exists (for local testing)
    if (typeof window !== 'undefined' && !localStorage.getItem('customerId')) {
      localStorage.setItem('customerId', 'mock-customer-id');
    }
    const customerId = localStorage.getItem('customerId');
    if (!customerId) {
      router.push('/login');
      return;
    }
    loadOrders();
  }, [router, filterStatus]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const customerId = localStorage.getItem('customerId');
      if (!customerId) return;

      const params = new URLSearchParams();
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      const response = await apiClient.get<any>(`/orders/customer/${customerId}?${params.toString()}`);
      
      setOrders(response.orders || []);
      setStats(response.stats || null);
    } catch (err: any) {
      console.error('Error loading orders:', err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    const reason = prompt('Please provide cancellation reason:');
    if (!reason) return;

    if (!confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      await apiClient.post(`/orders/${orderId}/cancel`, { reason });
      alert('Order cancelled successfully');
      loadOrders();
    } catch (err: any) {
      console.error('Error cancelling order:', err);
      alert(err.message || 'Failed to cancel order');
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
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Match home page pattern: orange gradient */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white text-2xl font-bold">My Orders</h1>
              <p className="text-white/90 text-sm mt-1">View and track your orders</p>
            </div>
            <Link
              href="/shop"
              className="px-4 py-2 text-white/90 hover:text-white transition"
            >
              ← Back to Shop
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content - Match home page pattern: white with rounded top */}
      <div className="bg-white rounded-t-[32px] -mt-6 pt-6 pb-24">
        <div className="px-6">

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total || 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-gray-500">Delivered</p>
              <p className="text-2xl font-bold text-green-600">{stats.delivered || 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-xs text-gray-500">Total Spent</p>
              <p className="text-2xl font-bold text-orange-600">₹{parseFloat(stats.total_spent || 0).toLocaleString('en-IN')}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="all">All Orders</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={loadOrders}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-500 text-lg mb-4">No orders found</p>
            <Link
              href="/shop"
              className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition inline-block"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Order #{order.order_number}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      {order.tracking_number && (
                        <span className="text-xs text-blue-600">
                          📦 {order.tracking_number}
                        </span>
                      )}
                    </div>

                    {/* Order Items */}
                    {order.items && order.items.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                              {item.product_image ? (
                                <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover rounded-lg" />
                              ) : (
                                <span className="text-xl">🛍️</span>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{item.product_name}</p>
                              <p className="text-sm text-gray-500">Qty: {item.quantity} × ₹{item.price.toLocaleString('en-IN')}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">₹{item.total.toLocaleString('en-IN')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-gray-500">Vendor: {order.vendor_name || 'N/A'}</p>
                        <p className="text-gray-500">
                          Ordered on: {new Date(order.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500">Total Amount</p>
                        <p className="text-xl font-bold text-orange-600">₹{order.final_amount.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-gray-500 capitalize">{order.payment_method} • {order.payment_status}</p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-6 flex flex-col gap-2">
                    <Link
                      href={`/orders/${order.id}`}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition text-center"
                    >
                      View Details
                    </Link>
                    {order.tracking_number && (
                      <Link
                        href={`/orders/${order.id}/tracking`}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition text-center"
                      >
                        Track Order
                      </Link>
                    )}
                    {['pending', 'confirmed'].includes(order.status) && (
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                      >
                        Cancel
                      </button>
                    )}
                    {order.status === 'delivered' && (
                      <Link
                        href={`/orders/${order.id}/invoice`}
                        className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition text-center"
                      >
                        Download Invoice
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
