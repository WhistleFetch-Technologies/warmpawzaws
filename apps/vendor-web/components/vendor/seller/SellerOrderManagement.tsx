'use client';

import { useState, useEffect } from 'react';
import { 
  ShoppingCart, Clock, Package, Truck, CheckCircle, XCircle, 
  Search, RefreshCcw, MapPin, Phone, User, ChevronRight,
  AlertCircle, ArrowRight, Send
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { buildMarkShippedPayload } from '@/lib/carrier-registry';
import {
  VendorShipmentDetailsForm,
  isShipmentFormValid,
  type VendorShipmentFormValues,
} from '@/components/vendor/orders/VendorShipmentDetailsForm';
import { VendorShipmentTrackingReadOnly } from '@/components/vendor/orders/VendorShipmentTrackingReadOnly';
import { VendorOrderMoneySummary } from '@/components/vendor/orders/VendorOrderMoneySummary';
import {
  formatInrAmount,
  resolveVendorOrderMoney,
  vendorOrderItemCatalogTotal,
} from '@/lib/vendor-order-money';

const EMPTY_SHIPMENT_FORM: VendorShipmentFormValues = {
  carrierId: '',
  carrierName: '',
  trackingNumber: '',
  trackingUrl: '',
};

interface SellerOrderManagementProps {
  sellerId: string;
}

const ORDER_STATUSES = [
  { id: 'all', label: 'All Orders', color: 'bg-slate-100 text-slate-700' },
  { id: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  { id: 'confirmed', label: 'Confirmed', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  { id: 'processing', label: 'Processing', color: 'bg-indigo-100 text-indigo-700', icon: Package },
  { id: 'shipped', label: 'Shipped', color: 'bg-purple-100 text-purple-700', icon: Truck },
  { id: 'delivered', label: 'Delivered', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  { id: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: XCircle },
  { id: 'returned', label: 'Returned', color: 'bg-orange-100 text-orange-700', icon: RefreshCcw }
];

// Valid status transitions for vendors
const STATUS_TRANSITIONS: Record<string, { next: string; label: string; requiresTracking?: boolean }[]> = {
  'pending': [
    { next: 'confirmed', label: 'Confirm Order' },
    { next: 'cancelled', label: 'Cancel Order' }
  ],
  'confirmed': [
    { next: 'processing', label: 'Start Processing' },
    { next: 'cancelled', label: 'Cancel Order' }
  ],
  'processing': [
    { next: 'shipped', label: 'Mark as Shipped', requiresTracking: true },
    { next: 'cancelled', label: 'Cancel Order' }
  ],
  'shipped': [
    { next: 'delivered', label: 'Mark as Delivered' }
  ],
  'delivered': [],
  'cancelled': [],
  'returned': []
};

export function SellerOrderManagement({ sellerId }: SellerOrderManagementProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [shipmentForm, setShipmentForm] = useState<VendorShipmentFormValues>(EMPTY_SHIPMENT_FORM);
  const [shipmentFormShowErrors, setShipmentFormShowErrors] = useState(false);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  useEffect(() => {
    loadOrders();
  }, [sellerId]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ orders?: any[] }>(`/vendor/${sellerId}/orders`);
      setOrders(data?.orders || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const markOrderAsShipped = async (orderId: string, form: VendorShipmentFormValues) => {
    if (!isShipmentFormValid(form)) {
      setShipmentFormShowErrors(true);
      return;
    }

    try {
      setUpdating(true);
      const payload = buildMarkShippedPayload(form);

      const result = await apiClient.post<{
        success: boolean;
        error?: string;
        tracking?: {
          trackingNumber?: string;
          carrierName?: string;
          trackingUrl?: string | null;
        };
      }>(`/vendor/${sellerId}/orders/${orderId}/mark-shipped`, payload);

      if (result?.error || result?.success === false) {
        alert(result?.error || 'Failed to mark order as shipped');
        return;
      }

      const trackingNum = result.tracking?.trackingNumber || payload.trackingNumber;
      const carrierName = result.tracking?.carrierName || payload.carrierName;
      const trackingUrlValue = result.tracking?.trackingUrl || payload.trackingUrl;

      setOrders(orders.map(o =>
        o.id === orderId
          ? {
              ...o,
              status: 'shipped',
              order_status: 'shipped',
              tracking_number: trackingNum,
              delivery_partner: carrierName,
              tracking_url: trackingUrlValue,
            }
          : o
      ));

      if (selectedOrder?.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          status: 'shipped',
          order_status: 'shipped',
          tracking_number: trackingNum,
          delivery_partner: carrierName,
          tracking_url: trackingUrlValue,
        });
      }

      setShowShippingModal(false);
      setShipmentForm(EMPTY_SHIPMENT_FORM);
      setShipmentFormShowErrors(false);
    } catch (error: any) {
      console.error('Error marking order shipped:', error);
      alert(error.message || 'Failed to mark order as shipped');
    } finally {
      setUpdating(false);
    }
  };

  const updateOrderStatus = async (
    orderId: string,
    newStatus: string,
    reason?: string
  ) => {
    try {
      setUpdating(true);
      const payload: Record<string, string> = { status: newStatus };
      if (newStatus === 'cancelled' && reason) {
        payload.cancellation_reason = reason;
      }

      const result = await apiClient.put<{ success: boolean; error?: string }>(
        `/vendor/${sellerId}/orders/${orderId}`,
        payload
      );
      
      if (result?.error) {
        alert(result.error);
        return;
      }
      
      setOrders(orders.map(o =>
        o.id === orderId
          ? {
              ...o,
              status: newStatus,
              order_status: newStatus,
              ...(newStatus === 'cancelled' && reason ? { cancellation_reason: reason } : {}),
            }
          : o
      ));

      if (selectedOrder?.id === orderId) {
        setSelectedOrder({
          ...selectedOrder,
          status: newStatus,
          order_status: newStatus,
          ...(newStatus === 'cancelled' && reason ? { cancellation_reason: reason } : {}),
        });
      }

      if (newStatus === 'cancelled') {
        setShowCancelModal(false);
        setCancellationReason('');
      }

    } catch (error: any) {
      console.error('Error updating order:', error);
      alert(error.message || 'Failed to update order status');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusAction = (orderId: string, newStatus: string, requiresTracking?: boolean) => {
    if (requiresTracking) {
      const order = orders.find((o) => o.id === orderId) || selectedOrder;
      if (order?.tracking_number) {
        alert('Tracking already submitted and cannot be changed');
        return;
      }
      setShipmentForm(EMPTY_SHIPMENT_FORM);
      setShipmentFormShowErrors(false);
      setShowShippingModal(true);
    } else if (newStatus === 'cancelled') {
      setCancellationReason('');
      setShowCancelModal(true);
    } else {
      updateOrderStatus(orderId, newStatus);
    }
  };

  const filteredOrders = orders.filter(order => {
    const orderStatus = order.status || order.order_status;
    const matchesSearch = 
      order.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || orderStatus === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    const statusConfig = ORDER_STATUSES.find(s => s.id === status);
    if (statusConfig?.icon) {
      const Icon = statusConfig.icon;
      return <Icon className="w-4 h-4" />;
    }
    return <Clock className="w-4 h-4" />;
  };

  const getStatusColor = (status: string) => {
    return ORDER_STATUSES.find(s => s.id === status)?.color || 'bg-slate-100 text-slate-700';
  };

  const getStatusCounts = () => {
    const counts: Record<string, number> = {};
    orders.forEach(order => {
      const status = order.status || order.order_status || 'pending';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-slate-500 mt-1">Process and track customer orders</p>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
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
            {status.id !== 'all' && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                selectedStatus === status.id ? 'bg-white/20' : 'bg-slate-100'
              }`}>
                {statusCounts[status.id] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by order ID, number, or customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No orders found</p>
            <p className="text-sm text-slate-400 mt-1">Orders will appear here when customers purchase</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredOrders.map(order => {
              const orderStatus = order.status || order.order_status || 'pending';
              return (
                <div
                  key={order.id}
                  className="p-5 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${getStatusColor(orderStatus)}`}>
                        {getStatusIcon(orderStatus)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {order.order_number || `Order #${(order.id || '').slice(-8)}`}
                        </p>
                        <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                          <User className="w-3.5 h-3.5" />
                          {order.customer_name || 'Customer'}
                          <span className="text-slate-300">•</span>
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        {(() => {
                          const money = resolveVendorOrderMoney(order);
                          return (
                            <>
                              <p className="font-bold text-slate-900 text-lg tabular-nums">
                                {formatInrAmount(money.vendorGoodsAmount)}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {money.isVendorFunded ? 'After your promo' : 'Your catalog'}
                              </p>
                            </>
                          );
                        })()}
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(orderStatus)}`}>
                          {getStatusIcon(orderStatus)}
                          {orderStatus}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                  
                  {/* Tracking info for shipped orders */}
                  {orderStatus === 'shipped' && order.tracking_number && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-purple-600 bg-purple-50 px-3 py-2 rounded-lg">
                      <Truck className="w-4 h-4" />
                      <span>Tracking: {order.tracking_number}</span>
                      {order.delivery_partner && <span>• {order.delivery_partner}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="shrink-0 border-b border-slate-100 bg-white p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedOrder.order_number || `Order #${selectedOrder.id?.slice(-8)}`}
                </h2>
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
              {/* Current Status */}
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-3 rounded-xl ${getStatusColor(selectedOrder.status || selectedOrder.order_status)}`}>
                    {getStatusIcon(selectedOrder.status || selectedOrder.order_status)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Current Status</p>
                    <p className="text-sm text-slate-500 capitalize">{selectedOrder.status || selectedOrder.order_status}</p>
                  </div>
                </div>

                {/* Tracking Info */}
                {selectedOrder.tracking_number && (
                  <VendorShipmentTrackingReadOnly
                    carrierName={selectedOrder.delivery_partner}
                    trackingNumber={selectedOrder.tracking_number}
                    trackingUrl={selectedOrder.tracking_url}
                    className="mb-4"
                  />
                )}

                {(selectedOrder.status === 'cancelled' || selectedOrder.order_status === 'cancelled') &&
                  selectedOrder.cancellation_reason && (
                  <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Cancellation reason</p>
                      <p>{selectedOrder.cancellation_reason}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {(STATUS_TRANSITIONS[selectedOrder.status || selectedOrder.order_status] || []).map((transition) => (
                    <button
                      key={transition.next}
                      onClick={() => handleStatusAction(selectedOrder.id, transition.next, transition.requiresTracking)}
                      disabled={updating}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-50 ${
                        transition.next === 'cancelled' 
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:shadow-lg'
                      }`}
                    >
                      {updating ? (
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      {transition.label}
                    </button>
                  ))}
                  
                  {(STATUS_TRANSITIONS[selectedOrder.status || selectedOrder.order_status] || []).length === 0 && (
                    <p className="text-sm text-slate-500 italic">
                      This order is in a final state and cannot be updated.
                    </p>
                  )}
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900">Customer Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <User className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Name</p>
                      <p className="font-medium text-slate-900">{selectedOrder.customer_name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Phone</p>
                      <p className="font-medium text-slate-900">{selectedOrder.customer_phone || selectedOrder.shipping_phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">Shipping Address</p>
                    <p className="font-medium text-slate-900">
                      {selectedOrder.shipping_address}
                      {selectedOrder.shipping_city && `, ${selectedOrder.shipping_city}`}
                      {selectedOrder.shipping_state && `, ${selectedOrder.shipping_state}`}
                      {selectedOrder.shipping_pincode && ` - ${selectedOrder.shipping_pincode}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900">Order Items</h3>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <div className="space-y-2">
                    {selectedOrder.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.emoji || '📦'}</span>
                          <div>
                            <p className="font-medium text-slate-900">{item.product_name || item.name}</p>
                            <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <p className="font-bold text-slate-900 tabular-nums">
                          {formatInrAmount(vendorOrderItemCatalogTotal(item))}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">Order items not available</p>
                )}
              </div>

              {/* Vendor settlement money — catalog base; platform promo does not cut vendor goods */}
              <VendorOrderMoneySummary order={selectedOrder} />
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                Cancel Order
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Tell the customer why you are cancelling this order. They will see this message.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason for cancellation *
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Item out of stock, unable to ship to this pincode..."
                  rows={4}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
                />
              </div>

              {!cancellationReason.trim() && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span>A cancellation reason is required</span>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancellationReason('');
                }}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() =>
                  updateOrderStatus(selectedOrder.id, 'cancelled', cancellationReason.trim())
                }
                disabled={!cancellationReason.trim() || updating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? (
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Modal */}
      {showShippingModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-purple-600" />
                Shipping Details
              </h3>
              <p className="text-sm text-slate-500 mt-1">Enter tracking information for this order</p>
            </div>
            
            <div className="p-6 space-y-4">
              <VendorShipmentDetailsForm
                values={shipmentForm}
                onChange={setShipmentForm}
                disabled={updating}
                showErrors={shipmentFormShowErrors}
              />
            </div>
            
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  setShowShippingModal(false);
                  setShipmentForm(EMPTY_SHIPMENT_FORM);
                  setShipmentFormShowErrors(false);
                }}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => markOrderAsShipped(selectedOrder.id, shipmentForm)}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updating ? (
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Mark as Shipped
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SellerOrderManagement;
