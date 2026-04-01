'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Order {
  id: string;
  order_number: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  payment_status: string;
  delivery_address: string;
  awb_number?: string;
  courier_name?: string;
  estimated_delivery?: string;
  created_at: string;
  delivered_at?: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  price: number;
}

interface MyOrdersProps {
  customerPhone: string;
}

export function MyOrders({ customerPhone }: MyOrdersProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [customerPhone, filter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `&status=${filter}` : '';
      const response = await apiClient.get<any>(`/customer/orders?phone=${encodeURIComponent(customerPhone)}${params}`);
      if (response.orders) {
        setOrders(response.orders);
      }
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTrackOrder = async (awbNumber: string) => {
    try {
      const res = await apiClient.get<any>(`/logistics/track/${awbNumber}`);
      if (res.tracking_url) {
        window.open(res.tracking_url, '_blank');
      } else {
        alert(`Status: ${res.status}\nLocation: ${res.current_location || 'In transit'}`);
      }
    } catch (err) {
      console.error('Error tracking order:', err);
      alert('Unable to track order');
    }
  };

  const handleRequestRefund = async (orderId: string) => {
    if (!refundReason.trim()) {
      alert('Please provide a reason for the refund');
      return;
    }
    try {
      await apiClient.post('/refunds/create', {
        orderId: orderId,
        reason: refundReason,
        type: 'order',
      });
      alert('Refund request submitted successfully');
      setShowRefundModal(false);
      setRefundReason('');
      setSelectedOrder(null);
    } catch (err: any) {
      console.error('Error requesting refund:', err);
      alert(err.message || 'Failed to submit refund request');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'shipped': case 'in_transit': return 'bg-blue-100 text-blue-700';
      case 'processing': case 'confirmed': return 'bg-yellow-100 text-yellow-700';
      case 'cancelled': case 'returned': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return '✅';
      case 'shipped': case 'in_transit': return '🚚';
      case 'processing': return '⏳';
      case 'confirmed': return '✓';
      case 'cancelled': return '❌';
      case 'returned': return '↩️';
      default: return '📦';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white shadow-md sticky top-0 z-40 rounded-b-2xl">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-9 h-9 flex-shrink-0 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">My Orders</h1>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex gap-3 overflow-x-auto pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'processing', label: 'Processing' },
            { id: 'shipped', label: 'Shipped' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-4 py-0 rounded-full text-sm font-medium whitespace-nowrap transition ${
                filter === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <main className="max-w-4xl mx-auto px-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-0">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-0 bg-white rounded-2xl">
            <span className="text-6xl">📦</span>
            <h2 className="mt-4 text-xl font-semibold text-gray-900">No orders found</h2>
            <p className="text-gray-500 mt-0">Start shopping to see your orders here</p>
            <a href="/" className="mt-0 inline-block px-0 py-0 bg-orange-500 text-white rounded-full">
              Browse Products
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Order Header */}
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Order #{order.order_number}</p>
                    <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-0 py-0 rounded-full flex items-center gap-3 ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)} {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Order Items */}
                <div className="p-4 space-y-3">
                  {order.items.slice(0, 2).map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                        {item.product_image ? (
                          <img src={item.product_image} alt={item.product_name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <span className="text-2xl">📦</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.product_name}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity} × ₹{item.price}</p>
                      </div>
                    </div>
                  ))}
                  {order.items.length > 2 && (
                    <p className="text-sm text-gray-500">+{order.items.length - 2} more items</p>
                  )}
                </div>

                {/* Order Footer */}
                <div className="p-4 bg-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-lg font-bold text-gray-900">₹{order.total_amount.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-3">
                    {order.awb_number && order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <button
                        onClick={() => handleTrackOrder(order.awb_number!)}
                        className="px-4 py-0 bg-blue-100 text-blue-600 rounded-full text-sm font-medium"
                      >
                        🔍 Track
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-4 py-0 bg-gray-100 text-gray-600 rounded-full text-sm font-medium"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Order Details</h2>
              <button onClick={() => setSelectedOrder(null)} className="p-0 hover:bg-gray-100 rounded-full">✕</button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Order #{selectedOrder.order_number}</p>
                  <p className="text-xs text-gray-400">{new Date(selectedOrder.created_at).toLocaleString()}</p>
                </div>
                <span className={`text-xs px-0 py-0 rounded-full ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status.replace(/_/g, ' ')}
                </span>
              </div>

              {selectedOrder.awb_number && (
                <div className="bg-blue-50 rounded-xl p-0">
                  <p className="text-sm text-blue-800 font-medium">Tracking Info</p>
                  <p className="text-sm text-blue-600">AWB: {selectedOrder.awb_number}</p>
                  <p className="text-sm text-blue-600">Courier: {selectedOrder.courier_name}</p>
                  {selectedOrder.estimated_delivery && (
                    <p className="text-sm text-blue-600">ETA: {new Date(selectedOrder.estimated_delivery).toLocaleDateString()}</p>
                  )}
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-0">Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-0 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-medium">₹{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-0">Delivery Address</h3>
                <p className="text-sm text-gray-600 bg-gray-50 p-0 rounded-lg">{selectedOrder.delivery_address}</p>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <p className="text-lg font-bold">Total</p>
                <p className="text-xl font-bold text-orange-600">₹{selectedOrder.total_amount.toLocaleString()}</p>
              </div>

              <div className="flex gap-3 pt-0">
                {selectedOrder.awb_number && selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                  <button
                    onClick={() => handleTrackOrder(selectedOrder.awb_number!)}
                    className="flex-1 py-0 bg-blue-500 text-white rounded-xl font-medium"
                  >
                    🔍 Track Order
                  </button>
                )}
                {(selectedOrder.status === 'delivered' || selectedOrder.payment_status === 'paid') && (
                  <button
                    onClick={() => setShowRefundModal(true)}
                    className="flex-1 py-0 bg-red-100 text-red-600 rounded-xl font-medium"
                  >
                    Request Refund
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Refund Request Modal */}
      {showRefundModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-0 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">Request Refund</h2>
            <p className="text-sm text-gray-600 mb-4">
              Order #{selectedOrder.order_number} - ₹{selectedOrder.total_amount.toLocaleString()}
            </p>
            <textarea
              value={refundReason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRefundReason(e.target.value)}
              placeholder="Please tell us why you want a refund..."
              rows={4}
              className="w-full px-4 py-0 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setRefundReason('');
                }}
                className="flex-1 py-0 border rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRequestRefund(selectedOrder.id)}
                className="flex-1 py-0 bg-red-500 text-white rounded-xl font-medium"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

