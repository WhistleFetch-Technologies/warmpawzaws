'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface ShipmentOrder {
  id: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  city: string;
  pincode: string;
  status: string;
  awb_number?: string;
  courier_name?: string;
  tracking_url?: string;
  estimated_delivery?: string;
  total_amount: number;
  items: OrderItem[];
  created_at: string;
  shipped_at?: string;
  delivered_at?: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
}

interface LogisticsStats {
  total: number;
  pending: number;
  shipped: number;
  delivered: number;
  returned: number;
}

export function AdminLogisticsPage() {
  const [orders, setOrders] = useState<ShipmentOrder[]>([]);
  const [stats, setStats] = useState<LogisticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<ShipmentOrder | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const [ordersRes, statsRes] = await Promise.all([
        apiClient.get<any>(`/admin/logistics/orders${params}`),
        apiClient.get<any>('/admin/logistics/stats'),
      ]);
      if (ordersRes.success) setOrders(ordersRes.orders || []);
      if (statsRes.success) setStats(statsRes.stats);
    } catch (err) {
      console.error('Error loading logistics data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShipment = async (orderId: string) => {
    setProcessing(true);
    try {
      const res = await apiClient.post<any>('/logistics/create-order', { order_id: orderId });
      if (res.success) {
        alert(`Shipment created! AWB: ${res.awb_number}`);
        loadData();
        setSelectedOrder(null);
      }
    } catch (err: any) {
      console.error('Error creating shipment:', err);
      alert(err.message || 'Failed to create shipment');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelShipment = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this shipment?')) return;
    setProcessing(true);
    try {
      await apiClient.post('/logistics/cancel-order', { order_id: orderId });
      alert('Shipment cancelled');
      loadData();
      setSelectedOrder(null);
    } catch (err: any) {
      console.error('Error cancelling shipment:', err);
      alert(err.message || 'Failed to cancel shipment');
    } finally {
      setProcessing(false);
    }
  };

  const handleTrackShipment = async (awbNumber: string) => {
    try {
      const res = await apiClient.get<any>(`/logistics/track/${awbNumber}`);
      if (res.tracking_url) {
        window.open(res.tracking_url, '_blank');
      } else {
        alert(`Status: ${res.status}\nLocation: ${res.current_location || 'N/A'}`);
      }
    } catch (err) {
      console.error('Error tracking shipment:', err);
      alert('Failed to track shipment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'shipped': case 'in_transit': return 'bg-blue-100 text-blue-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'returned': case 'cancelled': return 'bg-red-100 text-red-700';
      case 'out_for_delivery': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-0">
      <div className="flex items-center justify-between mb-0">
        <h1 className="text-2xl font-bold text-gray-900">Logistics & Shipping</h1>
        <button
          onClick={loadData}
          className="px-4 py-0 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-0">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Shipped</p>
            <p className="text-2xl font-bold text-blue-600">{stats.shipped}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Delivered</p>
            <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Returned</p>
            <p className="text-2xl font-bold text-red-600">{stats.returned}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex bg-white rounded-lg p-0 shadow-sm mb-0 w-fit">
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'Pending' },
          { id: 'shipped', label: 'Shipped' },
          { id: 'out_for_delivery', label: 'Out for Delivery' },
          { id: 'delivered', label: 'Delivered' },
          { id: 'returned', label: 'Returned' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-0 rounded-lg text-sm font-medium transition ${
              filter === tab.id ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Order ID</th>
                <th className="text-left p-4 font-medium text-gray-600">Customer</th>
                <th className="text-left p-4 font-medium text-gray-600">Delivery</th>
                <th className="text-left p-4 font-medium text-gray-600">AWB</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-right p-4 font-medium text-gray-600">Amount</th>
                <th className="text-left p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <span className="font-mono text-sm text-gray-900">
                      {order.order_id.slice(0, 8)}...
                    </span>
                    <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{order.customer_name}</p>
                    <p className="text-sm text-gray-500">{order.customer_phone}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-gray-600">{order.city}</p>
                    <p className="text-xs text-gray-400">{order.pincode}</p>
                  </td>
                  <td className="p-4">
                    {order.awb_number ? (
                      <div>
                        <span className="font-mono text-sm text-blue-600">{order.awb_number}</span>
                        <p className="text-xs text-gray-400">{order.courier_name}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-0 py-0 rounded-full ${getStatusColor(order.status)}`}>
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-right font-medium text-gray-900">
                    ₹{order.total_amount.toLocaleString()}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-0">
                      {(order.status as any) === 'pending' && (
                        <button
                          onClick={() => handleCreateShipment(order.order_id)}
                          disabled={processing}
                          className="px-0 py-0 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
                        >
                          📦 Ship
                        </button>
                      )}
                      {order.awb_number && (
                        <button
                          onClick={() => handleTrackShipment(order.awb_number!)}
                          className="px-0 py-0 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
                        >
                          🔍 Track
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-0 py-0 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
                      >
                        👁️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {orders.length === 0 && (
            <div className="text-center py-12">
              <span className="text-5xl">📦</span>
              <p className="mt-4 text-gray-500">No orders found</p>
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onCreateShipment={handleCreateShipment}
          onCancelShipment={handleCancelShipment}
          onTrackShipment={handleTrackShipment}
          processing={processing}
        />
      )}
    </div>
  );
}

function OrderDetailModal({
  order,
  onClose,
  onCreateShipment,
  onCancelShipment,
  onTrackShipment,
  processing,
}: {
  order: ShipmentOrder;
  onClose: () => void;
  onCreateShipment: (orderId: string) => void;
  onCancelShipment: (orderId: string) => void;
  onTrackShipment: (awb: string) => void;
  processing: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-0 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Order Details</h2>
          <button onClick={onClose} className="p-0 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-0">
          <div>
            <label className="text-sm text-gray-500">Order ID</label>
            <p className="font-mono">{order.order_id}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Status</label>
            <p className="font-medium">{order.status.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Customer</label>
            <p className="font-medium">{order.customer_name}</p>
            <p className="text-sm text-gray-500">{order.customer_phone}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Amount</label>
            <p className="font-bold text-green-600">₹{order.total_amount.toLocaleString()}</p>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-gray-500">Delivery Address</label>
            <p className="text-sm">{order.delivery_address}</p>
            <p className="text-sm text-gray-500">{order.city} - {order.pincode}</p>
          </div>
        </div>

        {order.awb_number && (
          <div className="bg-blue-50 rounded-lg p-4 mb-0">
            <h3 className="font-semibold mb-0">Shipment Info</h3>
            <p className="text-sm"><span className="text-gray-500">AWB:</span> {order.awb_number}</p>
            <p className="text-sm"><span className="text-gray-500">Courier:</span> {order.courier_name}</p>
            {order.estimated_delivery && (
              <p className="text-sm"><span className="text-gray-500">ETA:</span> {new Date(order.estimated_delivery).toLocaleDateString()}</p>
            )}
          </div>
        )}

        <div className="mb-0">
          <h3 className="font-semibold mb-0">Items ({order.items?.length || 0})</h3>
          <div className="space-y-2">
            {order.items?.map((item) => (
              <div key={item.id} className="flex justify-between items-center p-0 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                </div>
                <p className="font-medium">₹{(item.price * item.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-0 pt-4 border-t">
          {(order.status as any) === 'pending' && (
            <button
              onClick={() => onCreateShipment(order.order_id)}
              disabled={processing}
              className="flex-1 py-0 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {processing ? 'Creating...' : '📦 Create Shipment'}
            </button>
          )}
          {order.awb_number && order.status !== 'delivered' && order.status !== 'cancelled' && (
            <>
              <button
                onClick={() => onTrackShipment(order.awb_number!)}
                className="flex-1 py-0 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
              >
                🔍 Track Shipment
              </button>
              <button
                onClick={() => onCancelShipment(order.order_id)}
                disabled={processing}
                className="px-4 py-0 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="px-4 py-0 border rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

