'use client';

import { useState, useEffect } from 'react';
import {
  ShoppingCart, Search, Filter, Eye, Truck, Package, Clock,
  CheckCircle, XCircle, RefreshCcw, MapPin, Phone, User,
  FileText, Download, Calendar, IndianRupee, Store
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const ORDER_STATUSES = [
  { id: 'all', label: 'All Orders' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'returned', label: 'Returned' },
];

export function OrderManagementAdmin() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    loadOrders();
  }, [selectedStatus, dateRange]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      params.append('period', dateRange);
      params.append('limit', '100');
      
      const data = await apiClient.get<any>(`/admin/orders?${params.toString()}`);
      setOrders((data as any)?.orders || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await apiClient.put(`/admin/orders/${orderId}/status`, { status: newStatus });
      loadOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order status');
    }
  };

  const filteredOrders = orders.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(searchLower) ||
      order.customer_name?.toLowerCase().includes(searchLower) ||
      order.vendor_name?.toLowerCase().includes(searchLower)
    );
  });

  const statusCounts = ORDER_STATUSES.reduce((acc, status) => {
    acc[status.id] = status.id === 'all' 
      ? orders.length 
      : orders.filter(o => o.status === status.id).length;
    return acc;
  }, {} as Record<string, number>);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-amber-100 text-amber-700',
      'confirmed': 'bg-blue-100 text-blue-700',
      'processing': 'bg-indigo-100 text-indigo-700',
      'shipped': 'bg-purple-100 text-purple-700',
      'delivered': 'bg-emerald-100 text-emerald-700',
      'cancelled': 'bg-red-100 text-red-700',
      'returned': 'bg-orange-100 text-orange-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-slate-500 mt-1">Manage marketplace orders across all sellers</p>
        </div>
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-orange-500/25">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {ORDER_STATUSES.map(status => (
          <button
            key={status.id}
            onClick={() => setSelectedStatus(status.id)}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              selectedStatus === status.id
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {status.label}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              selectedStatus === status.id ? 'bg-white/20' : 'bg-slate-100'
            }`}>
              {statusCounts[status.id] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by order ID, customer, or seller..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
            <p className="mt-4 text-slate-500">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600 font-medium">No orders found</p>
            <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Order</th>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Customer</th>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Seller</th>
                <th className="text-right p-4 font-semibold text-slate-600 text-sm">Amount</th>
                <th className="text-center p-4 font-semibold text-slate-600 text-sm">Status</th>
                <th className="text-center p-4 font-semibold text-slate-600 text-sm">Date</th>
                <th className="text-right p-4 font-semibold text-slate-600 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <p className="font-mono font-medium text-slate-900">#{(order.order_number || order.id || '').slice(-8)}</p>
                    <p className="text-xs text-slate-500">{order.items?.length || 0} items</p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-slate-900">{order.customer_name || 'N/A'}</p>
                    <p className="text-sm text-slate-500">{order.customer_phone || ''}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-slate-900">{order.vendor_name || 'N/A'}</p>
                  </td>
                  <td className="p-4 text-right">
                    <p className="font-bold text-slate-900">₹{(order.total_amount || 0).toLocaleString()}</p>
                    {order.discount_amount > 0 && (
                      <p className="text-xs text-emerald-600">-₹{order.discount_amount} off</p>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-4 text-center text-sm text-slate-500">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Order #{(selectedOrder.order_number || selectedOrder.id || '').slice(-8)}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Placed on {new Date(selectedOrder.created_at).toLocaleDateString()}
                </p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-slate-100 rounded-xl"
              >
                <XCircle className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Update */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${getStatusColor(selectedOrder.status)}`}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Current Status</p>
                    <p className="text-sm text-slate-500">{selectedOrder.status}</p>
                  </div>
                </div>
                <select
                  value={selectedOrder.status}
                  onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Customer & Seller Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" /> Customer
                  </h4>
                  <p className="font-medium text-blue-800">{selectedOrder.customer_name || 'N/A'}</p>
                  <p className="text-sm text-blue-600">{selectedOrder.customer_phone || ''}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl">
                  <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <Store className="w-4 h-4" /> Seller
                  </h4>
                  <p className="font-medium text-purple-800">{selectedOrder.vendor_name || 'N/A'}</p>
                  <p className="text-sm text-purple-600">{selectedOrder.vendor_phone || ''}</p>
                </div>
              </div>

              {/* Shipping Address */}
              {selectedOrder.delivery_address && (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Delivery Address
                  </h4>
                  <p className="text-slate-600">{selectedOrder.delivery_address}</p>
                </div>
              )}

              {/* Order Items */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Order Items</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {(selectedOrder.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-4 border-b border-slate-100 last:border-b-0">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl">
                          {item.emoji || '📦'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{item.name || item.product_name}</p>
                          <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="font-bold text-slate-900">₹{((item.price || 0) * (item.quantity || 1)).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Totals */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="text-slate-900">₹{(selectedOrder.subtotal || selectedOrder.total_amount || 0).toLocaleString()}</span>
                </div>
                {selectedOrder.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600">Discount</span>
                    <span className="text-emerald-600">-₹{selectedOrder.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Shipping</span>
                  <span className="text-slate-900">₹{(selectedOrder.shipping_fee || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">GST (18%)</span>
                  <span className="text-slate-900">₹{(selectedOrder.tax_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-orange-200">
                  <span className="text-slate-900">Total</span>
                  <span className="text-orange-600">₹{(selectedOrder.total_amount || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Tracking Info */}
              {selectedOrder.tracking_number && (
                <div className="p-4 bg-indigo-50 rounded-xl">
                  <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Tracking Information
                  </h4>
                  <p className="font-mono text-indigo-700">{selectedOrder.tracking_number}</p>
                  <p className="text-sm text-indigo-600 mt-1">Carrier: {selectedOrder.carrier || 'Shiprocket'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

