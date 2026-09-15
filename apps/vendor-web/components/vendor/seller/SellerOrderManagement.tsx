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
      <div className="flex h-full min-h-[200px] items-center justify-center sm:min-h-[400px]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500 sm:h-16 sm:w-16"></div>
          <p className="mt-3 text-sm text-slate-500 sm:mt-4">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-1 sm:space-y-6 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-slate-900 sm:text-2xl">Orders</h1>
          <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">Process and track customer orders</p>
        </div>
        <button
          onClick={loadOrders}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-50 sm:rounded-xl sm:px-4 sm:text-sm"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:gap-2 sm:px-0 sm:pb-2">
        {ORDER_STATUSES.map(status => (
          <button
            key={status.id}
            onClick={() => setSelectedStatus(status.id)}
            className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm ${
              selectedStatus === status.id
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {status.id === 'all' ? (
              <>
                <span className="sm:hidden">All</span>
                <span className="hidden sm:inline">{status.label}</span>
              </>
            ) : (
              status.label
            )}
            {status.id !== 'all' && (
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] sm:ml-2 sm:px-2 sm:text-xs ${
                selectedStatus === status.id ? 'bg-white/20' : 'bg-slate-100'
              }`}>
                {statusCounts[status.id] || 0}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-4 sm:h-5 sm:w-5" />
        <input
          type="text"
          placeholder="Search order or customer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 sm:rounded-xl sm:py-3 sm:pl-12 sm:pr-4"
        />
      </div>

      {/* Orders List */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm sm:rounded-2xl">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center sm:p-12">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 sm:mb-4 sm:h-16 sm:w-16">
              <ShoppingCart className="h-6 w-6 text-slate-400 sm:h-8 sm:w-8" />
            </div>
            <p className="text-sm font-medium text-slate-600 sm:text-base">No orders found</p>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">Orders will appear here when customers purchase</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredOrders.map(order => {
              const orderStatus = order.status || order.order_status || 'pending';
              const money = resolveVendorOrderMoney(order);
              return (
                <div
                  key={order.id}
                  className="cursor-pointer px-3 py-2.5 hover:bg-slate-50 sm:p-5"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className={`shrink-0 rounded-lg p-1.5 sm:rounded-xl sm:p-3 ${getStatusColor(orderStatus)}`}>
                      {getStatusIcon(orderStatus)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900 sm:text-base">
                        {order.order_number || `Order #${(order.id || '').slice(-8)}`}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500 sm:mt-1 sm:flex sm:items-center sm:gap-2 sm:text-sm">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          {order.customer_name || 'Customer'}
                        </span>
                        <span className="hidden text-slate-300 sm:inline">•</span>
                        <span className="ml-1 inline-flex items-center gap-1 sm:ml-0">
                          <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-bold tabular-nums text-slate-900 sm:text-lg">
                        {formatInrAmount(money.vendorGoodsAmount)}
                      </p>
                      <p className="hidden text-[11px] text-slate-500 sm:block">
                        {money.isVendorFunded ? 'After your promo' : 'Your catalog'}
                      </p>
                      <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize sm:mt-1 sm:px-3 sm:py-1 sm:text-xs ${getStatusColor(orderStatus)}`}>
                        {orderStatus}
                      </span>
                    </div>
                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-slate-400 sm:block" />
                  </div>

                  {orderStatus === 'shipped' && order.tracking_number && (
                    <div className="mt-2 flex items-center gap-1.5 truncate rounded-lg bg-purple-50 px-2 py-1.5 text-[11px] text-purple-600 sm:mt-3 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm">
                      <Truck className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                      <span className="truncate">Tracking: {order.tracking_number}</span>
                      {order.delivery_partner && <span className="hidden truncate sm:inline">• {order.delivery_partner}</span>}
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-h-[100dvh] sm:w-[min(42rem,calc(100vw-1rem))] sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white p-4 sm:p-6">
              <div className="min-w-0 pr-2">
                <h2 className="truncate text-base font-bold text-slate-900 sm:text-xl">
                  {selectedOrder.order_number || `Order #${selectedOrder.id?.slice(-8)}`}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 sm:mt-1 sm:text-sm">
                  Placed on {new Date(selectedOrder.created_at).toLocaleDateString()}
                </p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl p-2 hover:bg-slate-100"
              >
                <XCircle className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
              <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
                <div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
                  <div className={`rounded-lg p-2 sm:rounded-xl sm:p-3 ${getStatusColor(selectedOrder.status || selectedOrder.order_status)}`}>
                    {getStatusIcon(selectedOrder.status || selectedOrder.order_status)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 sm:text-base">Current Status</p>
                    <p className="text-xs capitalize text-slate-500 sm:text-sm">{selectedOrder.status || selectedOrder.order_status}</p>
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
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all disabled:opacity-50 sm:rounded-xl sm:px-4 sm:text-sm ${
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
              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 sm:text-base">Customer Details</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 sm:gap-3 sm:p-3">
                    <User className="h-4 w-4 text-slate-400 sm:h-5 sm:w-5" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-500 sm:text-xs">Name</p>
                      <p className="truncate text-sm font-medium text-slate-900">{selectedOrder.customer_name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 sm:gap-3 sm:p-3">
                    <Phone className="h-4 w-4 text-slate-400 sm:h-5 sm:w-5" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-500 sm:text-xs">Phone</p>
                      <p className="truncate text-sm font-medium text-slate-900">{selectedOrder.customer_phone || selectedOrder.shipping_phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 sm:gap-3 sm:p-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-slate-400 sm:h-5 sm:w-5" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 sm:text-xs">Shipping Address</p>
                    <p className="text-sm font-medium text-slate-900">
                      {selectedOrder.shipping_address}
                      {selectedOrder.shipping_city && `, ${selectedOrder.shipping_city}`}
                      {selectedOrder.shipping_state && `, ${selectedOrder.shipping_state}`}
                      {selectedOrder.shipping_pincode && ` - ${selectedOrder.shipping_pincode}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 sm:space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 sm:text-base">Order Items</h3>
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  <div className="space-y-2">
                    {selectedOrder.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 sm:p-3">
                        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                          <span className="text-lg sm:text-2xl">{item.emoji || '📦'}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{item.product_name || item.name}</p>
                            <p className="text-xs text-slate-500 sm:text-sm">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900 sm:text-base">
                          {formatInrAmount(vendorOrderItemCatalogTotal(item))}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-slate-500">Order items not available</p>
                )}
              </div>

              <VendorOrderMoneySummary order={selectedOrder} className="p-3 text-sm sm:p-4" />
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-4 sm:p-6">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
                <XCircle className="h-5 w-5 text-red-600" />
                Cancel Order
              </h3>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                Tell the customer why you are cancelling this order. They will see this message.
              </p>
            </div>

            <div className="space-y-3 p-4 sm:space-y-4 sm:p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Reason for cancellation *
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Item out of stock, unable to ship to this pincode..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 sm:px-4 sm:py-3"
                />
              </div>

              {!cancellationReason.trim() && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span>A cancellation reason is required</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 p-4 sm:gap-3 sm:p-6">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancellationReason('');
                }}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:py-3"
              >
                Back
              </button>
              <button
                onClick={() =>
                  updateOrderStatus(selectedOrder.id, 'cancelled', cancellationReason.trim())
                }
                disabled={!cancellationReason.trim() || updating}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:py-3"
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
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-4 sm:p-6">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
                <Truck className="h-5 w-5 text-purple-600" />
                Shipping Details
              </h3>
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">Enter tracking information for this order</p>
            </div>
            
            <div className="space-y-4 p-4 sm:p-6">
              <VendorShipmentDetailsForm
                values={shipmentForm}
                onChange={setShipmentForm}
                disabled={updating}
                showErrors={shipmentFormShowErrors}
              />
            </div>
            
            <div className="flex gap-2 border-t border-slate-100 p-4 sm:gap-3 sm:p-6">
              <button
                onClick={() => {
                  setShowShippingModal(false);
                  setShipmentForm(EMPTY_SHIPMENT_FORM);
                  setShipmentFormShowErrors(false);
                }}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:py-3"
              >
                Cancel
              </button>
              <button
                onClick={() => markOrderAsShipped(selectedOrder.id, shipmentForm)}
                disabled={updating}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:py-3"
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
