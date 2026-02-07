'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  Package, Truck, Clock, Check, X as XIcon, ArrowLeft,
  MapPin, Phone, Calendar, ChevronDown, ChevronUp, Star,
  RefreshCcw, AlertCircle, Search, Filter, Download
} from 'lucide-react';

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_emoji?: string;
  quantity: number;
  price: number;
  vendor_id: string;
  vendor_name: string;
}

interface Order {
  id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'returned';
  items: OrderItem[];
  shipping_address: {
    name: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  tracking_number?: string;
  estimated_delivery?: string;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: 'amber', icon: Clock, label: 'Order Placed' },
  confirmed: { color: 'blue', icon: Check, label: 'Confirmed' },
  processing: { color: 'indigo', icon: Package, label: 'Processing' },
  shipped: { color: 'purple', icon: Truck, label: 'Shipped' },
  out_for_delivery: { color: 'cyan', icon: Truck, label: 'Out for Delivery' },
  delivered: { color: 'emerald', icon: Check, label: 'Delivered' },
  cancelled: { color: 'red', icon: XIcon, label: 'Cancelled' },
  returned: { color: 'orange', icon: RefreshCcw, label: 'Returned' },
};

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadOrders();
  }, [filterStatus]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const customerId = localStorage.getItem('warmpawz_customer_id');
      if (!customerId) {
        setOrders([]);
        setLoading(false);
        return;
      }
      
      const params = new URLSearchParams();
      params.append('customerId', customerId);
      if (filterStatus) params.append('status', filterStatus);
      
      const result = await apiClient.get<any>(`/ecommerce/orders?${params.toString()}`);
      setOrders((result as any)?.orders || []);
    } catch (err: any) {
      console.error('Error loading orders:', err);
      setError(err.message || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    try {
      await apiClient.post<any>(`/ecommerce/orders/${orderId}/cancel`, {});
      await loadOrders();
    } catch (err: any) {
      console.error('Error cancelling order:', err);
      alert('Failed to cancel order: ' + (err.message || 'Unknown error'));
    }
  };

  const requestReturn = async (orderId: string) => {
    if (!confirm('Are you sure you want to return this order?')) return;
    
    try {
      await apiClient.post<any>(`/ecommerce/orders/${orderId}/return`, {});
      await loadOrders();
    } catch (err: any) {
      console.error('Error requesting return:', err);
      alert('Failed to request return: ' + (err.message || 'Unknown error'));
    }
  };

  const downloadInvoice = async (orderId: string) => {
    try {
      // First, generate the invoice if not already generated
      await apiClient.post<any>(`/orders/${orderId}/invoice/generate`, {});
      
      // Then get the invoice download URL
      const result = await apiClient.get<any>(`/orders/${orderId}/invoice`);
      
      if (result?.invoice?.download_url) {
        // Open the download URL in a new tab
        window.open(result.invoice.download_url, '_blank');
      } else if (result?.invoice?.pdf_data) {
        // If PDF data is returned directly, create a blob and download
        const byteCharacters = atob(result.invoice.pdf_data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoice-${orderId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Invoice is being generated. Please try again in a moment.');
      }
    } catch (err: any) {
      console.error('Error downloading invoice:', err);
      alert('Failed to download invoice: ' + (err.message || 'Unknown error'));
    }
  };

  const filteredOrders = orders.filter(order => 
    order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.items?.some(item => item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    return config.color;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50/30">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/shop')}
            className="p-2 hover:bg-slate-100 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Orders</h1>
            <p className="text-sm text-slate-500">{orders.length} orders</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search orders by number or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          >
            <option value="">All Orders</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="returned">Returned</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
              <p className="mt-4 text-slate-500">Loading orders...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-300" />
            <p className="text-slate-600 font-medium">Unable to load orders</p>
            <p className="text-sm text-slate-400 mt-1">{error}</p>
            <button
              onClick={loadOrders}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
            <Package className="w-20 h-20 mx-auto mb-6 text-slate-200" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No orders found</h2>
            <p className="text-slate-500 mb-6">
              {orders.length === 0 
                ? "You haven't placed any orders yet" 
                : "No orders match your search"
              }
            </p>
            <button
              onClick={() => router.push('/shop')}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map(order => {
              const isExpanded = expandedOrder === order.id;
              const config = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                  {/* Order Header */}
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-slate-900">Order #{order.order_number}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${config.color}-100 text-${config.color}-700`}>
                            {config.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                          <span>{order.items?.length || 0} items</span>
                          <span className="font-semibold text-slate-900">₹{order.total}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="p-5 bg-slate-50">
                    <div className="flex gap-4 overflow-x-auto pb-2">
                      {order.items?.slice(0, 4).map(item => (
                        <div key={item.id} className="flex-shrink-0 flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                          <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg flex items-center justify-center text-xl">
                            {item.product_emoji || '📦'}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 text-sm line-clamp-1">{item.product_name}</p>
                            <p className="text-xs text-slate-500">Qty: {item.quantity}</p>
                          </div>
                        </div>
                      ))}
                      {(order.items?.length || 0) > 4 && (
                        <div className="flex-shrink-0 flex items-center justify-center px-4 bg-slate-100 rounded-xl text-sm text-slate-500">
                          +{(order.items?.length || 0) - 4} more
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="p-5 border-t border-slate-100">
                      {/* Status Timeline */}
                      <div className="mb-6">
                        <h4 className="font-semibold text-slate-900 mb-4">Order Status</h4>
                        <div className="flex items-center gap-2">
                          {['pending', 'confirmed', 'processing', 'shipped', 'delivered'].map((status, index) => {
                            const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
                            const currentIndex = statusOrder.indexOf(order.status);
                            const isComplete = index <= currentIndex && !['cancelled', 'returned'].includes(order.status);
                            const isCurrent = statusOrder[index] === order.status;
                            
                            return (
                              <React.Fragment key={status}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  isComplete ? 'bg-emerald-500 text-white' : 
                                  isCurrent ? 'bg-orange-500 text-white' : 
                                  'bg-slate-200 text-slate-400'
                                }`}>
                                  {isComplete ? <Check className="w-4 h-4" /> : index + 1}
                                </div>
                                {index < 4 && (
                                  <div className={`flex-1 h-1 rounded ${
                                    isComplete ? 'bg-emerald-500' : 'bg-slate-200'
                                  }`} />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-slate-500">
                          <span>Placed</span>
                          <span>Confirmed</span>
                          <span>Processing</span>
                          <span>Shipped</span>
                          <span>Delivered</span>
                        </div>
                      </div>

                      {/* Tracking */}
                      {order.tracking_number && (
                        <div className="mb-6 p-4 bg-blue-50 rounded-xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-blue-600 font-medium">Tracking Number</p>
                              <p className="font-semibold text-blue-900">{order.tracking_number}</p>
                            </div>
                            {order.estimated_delivery && (
                              <div className="text-right">
                                <p className="text-sm text-blue-600">Expected by</p>
                                <p className="font-semibold text-blue-900">{order.estimated_delivery}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Order Items */}
                      <div className="mb-6">
                        <h4 className="font-semibold text-slate-900 mb-3">Items</h4>
                        <div className="space-y-3">
                          {order.items?.map(item => (
                            <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center text-2xl border">
                                {item.product_emoji || '📦'}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">{item.product_name}</p>
                                <p className="text-sm text-orange-600">{item.vendor_name}</p>
                                <p className="text-sm text-slate-500">Qty: {item.quantity} × ₹{item.price}</p>
                              </div>
                              <p className="font-bold text-slate-900">₹{item.quantity * item.price}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Delivery Address */}
                      <div className="mb-6">
                        <h4 className="font-semibold text-slate-900 mb-3">Delivery Address</h4>
                        <div className="p-4 bg-slate-50 rounded-xl">
                          <p className="font-medium text-slate-900">{order.shipping_address?.name}</p>
                          <p className="text-slate-600">{order.shipping_address?.line1}</p>
                          <p className="text-slate-600">
                            {order.shipping_address?.city}, {order.shipping_address?.state} - {order.shipping_address?.pincode}
                          </p>
                          <p className="text-slate-600 mt-1">
                            <Phone className="w-4 h-4 inline mr-1" />
                            {order.shipping_address?.phone}
                          </p>
                        </div>
                      </div>

                      {/* Payment Summary */}
                      <div className="mb-6">
                        <h4 className="font-semibold text-slate-900 mb-3">Payment Summary</h4>
                        <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Subtotal</span>
                            <span className="text-slate-900">₹{order.subtotal}</span>
                          </div>
                          {order.discount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-emerald-600">Discount</span>
                              <span className="text-emerald-600">-₹{order.discount}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-600">Shipping</span>
                            <span className={order.shipping_fee === 0 ? 'text-emerald-600' : 'text-slate-900'}>
                              {order.shipping_fee === 0 ? 'FREE' : `₹${order.shipping_fee}`}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold pt-2 border-t border-slate-200">
                            <span className="text-slate-900">Total</span>
                            <span className="text-orange-600">₹{order.total}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-sm">
                            <span className="text-slate-500">Payment:</span>
                            <span className="text-slate-900">{order.payment_method}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                              order.payment_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {order.payment_status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        {['pending', 'confirmed', 'processing'].includes(order.status) && (
                          <button
                            onClick={() => cancelOrder(order.id)}
                            className="flex-1 py-3 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors"
                          >
                            Cancel Order
                          </button>
                        )}
                        {order.status === 'delivered' && (
                          <>
                            <button
                              onClick={() => requestReturn(order.id)}
                              className="flex-1 py-3 border border-orange-200 text-orange-600 rounded-xl font-medium hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                            >
                              <RefreshCcw className="w-4 h-4" />
                              Return Order
                            </button>
                            <button className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
                              <Star className="w-4 h-4" />
                              Rate & Review
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => downloadInvoice(order.id)}
                          className="px-4 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Invoice
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
