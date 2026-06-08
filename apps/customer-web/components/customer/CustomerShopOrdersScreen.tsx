'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ordersApi } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { goBackOrHome, rememberShopBackFromCurrentUrl, rememberShopBackToSpaScreen, WARMPAWZ_EXPAND_SHOP_ORDER_ID_KEY } from '@/lib/go-back-or-replace';
import type { ShopReturnSpaScreen } from '@/lib/go-back-or-replace';
import {
  Package, Truck, Clock, Check, X as XIcon,
  Phone, Calendar, ChevronDown, ChevronUp, Star,
  RefreshCcw, AlertCircle, Download, ShoppingBag,
} from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';
import { MyOrdersHeaderBackground } from '@/components/customer/MyOrdersHeaderBackground';
import {
  MY_ORDERS_CARD_CLASS,
  MyOrdersEmptyState,
  MyOrdersFilterMenu,
  MyOrdersListShell,
  MyOrdersLoadingState,
  MyOrdersSearchRow,
  MyOrdersStatsRow,
  ORDER_ACTION_BTN_CLASS,
  getOrderFilterLabel,
  type OrderFilterValue,
} from '@/components/customer/my-orders-ui';
import { myBookingsCardClass } from '@/components/customer/booking/my-bookings-ui';

/** Backend may return 404 for “no orders” or missing route — show empty state, not an error. */
function isOrdersListTreatAsEmpty(err: unknown): boolean {
  const e = err as { status?: number; statusCode?: number; message?: string };
  if (e?.status === 404 || e?.statusCode === 404) return true;
  const msg = String(e?.message ?? '');
  return /\b404\b/.test(msg) || msg.includes('HTTP 404') || msg.includes('Not Found');
}

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

const statusConfig: Record<string, { badge: string; icon: typeof Clock; label: string }> = {
  pending: { badge: 'bg-orange-100 text-orange-800', icon: Clock, label: 'Order Placed' },
  confirmed: { badge: 'bg-blue-100 text-blue-800', icon: Check, label: 'Confirmed' },
  processing: { badge: 'bg-blue-100 text-blue-800', icon: Package, label: 'Processing' },
  shipped: { badge: 'bg-violet-100 text-violet-800', icon: Truck, label: 'Shipped' },
  out_for_delivery: { badge: 'bg-violet-100 text-violet-800', icon: Truck, label: 'Out for Delivery' },
  delivered: { badge: 'bg-emerald-100 text-emerald-800', icon: Check, label: 'Delivered' },
  cancelled: { badge: 'bg-red-100 text-red-800', icon: XIcon, label: 'Cancelled' },
  returned: { badge: 'bg-purple-100 text-purple-800', icon: RefreshCcw, label: 'Returned' },
};

function getOrderStatusDisplay(order: Order): { badge: string; icon: typeof Clock; label: string } {
  const base = statusConfig[order.status] || statusConfig.pending;
  if (order.status === 'pending' && order.payment_status === 'paid') {
    return {
      ...base,
      badge: 'bg-orange-100 text-orange-800',
      label: 'Paid — awaiting seller',
    };
  }
  return base;
}

function normalizeItems(items: unknown): OrderItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((it: any, idx: number) => ({
    id: String(it.id ?? `item-${idx}`),
    product_id: String(it.product_id ?? it.productId ?? ''),
    product_name: it.product_name || it.service_name || it.name || 'Item',
    product_emoji: it.product_emoji,
    quantity: Number(it.quantity) || 1,
    price: Number(it.unit_price ?? it.price ?? it.unitPrice ?? 0),
    vendor_id: String(it.vendor_id ?? ''),
    vendor_name: it.vendor_name || 'Store',
  }));
}

function parseShippingAddress(raw: any): Order['shipping_address'] {
  const lineFromDelivery =
    typeof raw.delivery_address === 'string' ? raw.delivery_address.trim() : '';
  if (lineFromDelivery.startsWith('{')) {
    try {
      const p = JSON.parse(raw.delivery_address);
      if (p && typeof p === 'object') {
        return {
          name: p.name || 'You',
          phone: p.phone || raw.shipping_phone || '',
          line1: p.line1 || p.address || p.street || '—',
          city: p.city || raw.shipping_city || '',
          state: p.state || raw.shipping_state || '',
          pincode: p.pincode || raw.shipping_pincode || '',
        };
      }
    } catch {
      /* fall through */
    }
  }
  return {
    name: raw.customer_name || 'You',
    phone: raw.shipping_phone || raw.customer_phone || '',
    line1: lineFromDelivery || String(raw.shipping_address || '—'),
    city: raw.shipping_city || '',
    state: raw.shipping_state || '',
    pincode: raw.shipping_pincode || '',
  };
}

function normalizeOrder(raw: any): Order {
  const rawStatus = String(raw.status || raw.order_status || 'pending').toLowerCase();
  const allowed: Order['status'][] = [
    'pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery',
    'delivered', 'cancelled', 'returned',
  ];
  const status = (allowed.includes(rawStatus as Order['status']) ? rawStatus : 'pending') as Order['status'];

  const discount = Number(raw.discount_amount ?? raw.discount ?? 0) || 0;
  const shippingFee = Number(raw.shipping_amount ?? raw.shipping_fee ?? 0) || 0;
  const total = Number(raw.final_amount ?? raw.total_amount ?? raw.total ?? 0) || 0;
  const subtotal = Number(raw.subtotal ?? raw.total_amount ?? Math.max(0, total - shippingFee + discount)) || 0;

  return {
    id: String(raw.id),
    order_number: raw.order_number || String(raw.id).slice(0, 8),
    status,
    items: normalizeItems(raw.items),
    shipping_address: parseShippingAddress(raw),
    subtotal,
    shipping_fee: shippingFee,
    discount,
    total,
    payment_method: raw.payment_method || '—',
    payment_status: String(raw.payment_status || 'pending').toLowerCase(),
    tracking_number: raw.tracking_number,
    estimated_delivery: raw.estimated_delivery,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
  };
}

export interface CustomerShopOrdersScreenProps {
  onBack?: () => void;
  onCloseToHome?: () => void;
  /** When My Orders lives on `/` (profile), remember this SPA screen so `/shop` back restores it. */
  spaShopReturnScreen?: ShopReturnSpaScreen;
  /** Expand a specific order (e.g. from `/orders?expand=` or post-checkout track). */
  initialExpandedOrderId?: string | null;
}

export function CustomerShopOrdersScreen({ onBack, onCloseToHome, spaShopReturnScreen, initialExpandedOrderId }: CustomerShopOrdersScreenProps) {
  const router = useRouter();
  const listHeaderRef = useRef<HTMLButtonElement>(null);
  const listShellRef = useRef<HTMLDivElement>(null);
  const pendingExpandOrderId = useRef<string | null>(null);

  const goToShop = () => {
    if (spaShopReturnScreen) {
      rememberShopBackToSpaScreen(spaShopReturnScreen);
    } else {
      rememberShopBackFromCurrentUrl();
    }
    router.push('/shop');
  };
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<OrderFilterValue>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    goBackOrHome(router);
  };

  const handleCloseToHome = () => {
    if (onCloseToHome) {
      onCloseToHome();
      return;
    }
    handleBack();
  };

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const customerId = getResolvedCustomerId();
      if (!customerId) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const result = await ordersApi.list({
        customerId,
        ...(filterStatus ? { status: filterStatus } : {}),
      });
      const rawList = (result as any)?.orders;
      const list = Array.isArray(rawList) ? rawList.map(normalizeOrder) : [];
      setOrders(list);
    } catch (err: any) {
      console.error('Error loading orders:', err);
      if (isOrdersListTreatAsEmpty(err)) {
        setOrders([]);
        setError(null);
      } else {
        setError(err.message || 'Failed to load orders');
        setOrders([]);
      }
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    let pending = initialExpandedOrderId?.trim() || null;
    if (!pending && typeof window !== 'undefined') {
      pending = sessionStorage.getItem(WARMPAWZ_EXPAND_SHOP_ORDER_ID_KEY);
      if (pending) sessionStorage.removeItem(WARMPAWZ_EXPAND_SHOP_ORDER_ID_KEY);
    }
    pendingExpandOrderId.current = pending;
    if (pending) setExpandedOrder(pending);
  }, [initialExpandedOrderId]);

  useEffect(() => {
    const pending = pendingExpandOrderId.current;
    if (!pending || loading) return;
    if (orders.some((o) => o.id === pending)) {
      setExpandedOrder(pending);
      pendingExpandOrderId.current = null;
    }
  }, [orders, loading]);

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    try {
      await ordersApi.cancel(orderId, { reason: 'Customer request' });
      await loadOrders();
    } catch (err: any) {
      console.error('Error cancelling order:', err);
      alert('Failed to cancel order: ' + (err.message || 'Unknown error'));
    }
  };

  const requestReturn = async (orderId: string) => {
    if (!confirm('Are you sure you want to return this order?')) return;

    try {
      await apiClient.put(`/orders/${orderId}/status`, { status: 'returned' });
      await loadOrders();
    } catch (err: any) {
      console.error('Error requesting return:', err);
      alert('Failed to request return: ' + (err.message || 'Unknown error'));
    }
  };

  const downloadInvoice = async (orderId: string) => {
    try {
      await apiClient.post<any>(`/orders/${orderId}/invoice/generate`, {});
      const result = await apiClient.get<any>(`/orders/${orderId}/invoice`);

      if (result?.invoice?.download_url) {
        window.open(result.invoice.download_url, '_blank');
      } else if (result?.invoice?.pdf_data) {
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

  const filteredOrders = orders.filter(
    (order) =>
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items?.some((item) => item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const dashboardStats = useMemo(() => {
    const active = orders.filter((o) =>
      ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery'].includes(o.status)
    ).length;
    const done = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled' || o.status === 'returned').length;
    return {
      total: String(orders.length),
      active: String(active),
      completed: String(done),
    };
  }, [orders]);

  const filterMenu = (
    <MyOrdersFilterMenu
      open={filterOpen}
      onOpenChange={setFilterOpen}
      value={filterStatus}
      onChange={setFilterStatus}
      anchorRef={listHeaderRef}
    />
  );

  const resetFilters = () => {
    setSearchTerm('');
    setFilterStatus('');
  };

  const renderListBody = () => {
    if (loading) {
      return <MyOrdersLoadingState />;
    }

    if (error) {
      return (
        <div className={cn(myBookingsCardClass, 'px-4 py-10 text-center my-bookings-fade-in')}>
          <AlertCircle className="mx-auto mb-3 h-12 w-12 text-amber-400 sm:h-14 sm:w-14" />
          <p className="text-[15px] font-semibold text-gray-900 sm:text-sm">Unable to load orders</p>
          <p className="mt-1.5 break-words text-xs leading-relaxed text-gray-500">{error}</p>
          <button
            type="button"
            onClick={() => loadOrders()}
            className="mx-auto mt-5 block min-h-11 w-full max-w-xs rounded-2xl bg-[#FF8C42] px-6 text-sm font-semibold text-white transition-all hover:bg-orange-600 active:scale-[0.98] touch-manipulation"
          >
            Try again
          </button>
        </div>
      );
    }

    if (filteredOrders.length === 0) {
      return (
        <MyOrdersEmptyState
          variant={orders.length === 0 ? 'no-orders' : 'no-matches'}
          onStartShopping={goToShop}
          onResetFilters={resetFilters}
        />
      );
    }

    return (
      <div className="space-y-4 pb-1">
        {filteredOrders.map((order, index) => {
          const isExpanded = expandedOrder === order.id;
          const config = getOrderStatusDisplay(order);
          const StatusIcon = config.icon;

          return (
            <div
              key={order.id}
              style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
              className={cn(MY_ORDERS_CARD_CLASS, 'my-bookings-card-enter')}
            >
              <div className="border-b border-stone-100/90 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-gray-900">#{order.order_number}</h3>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          config.badge
                        )}
                      >
                        {config.label}
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-[#FF8C42]" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                      <span>{order.items?.length || 0} items</span>
                      <span className="font-bold text-gray-900">₹{order.total}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-50 transition-colors hover:bg-stone-100 active:scale-95"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse order details' : 'Expand order details'}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-stone-50/70 px-4 py-3 sm:px-5">
                <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
                  {order.items?.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="flex max-w-[210px] shrink-0 items-center gap-2.5 rounded-2xl border border-stone-100/90 bg-white p-2.5 shadow-sm"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-stone-100 to-stone-50 text-lg">
                        {item.product_emoji || '📦'}
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-xs font-semibold text-gray-900">{item.product_name}</p>
                        <p className="mt-0.5 text-[10px] text-gray-500">Qty: {item.quantity}</p>
                      </div>
                    </div>
                  ))}
                  {(order.items?.length || 0) > 4 && (
                    <div className="flex shrink-0 items-center rounded-2xl bg-stone-100/90 px-3 text-xs font-medium text-gray-500">
                      +{(order.items?.length || 0) - 4} more
                    </div>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-300 ease-out',
                  isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                )}
              >
                <div className="overflow-hidden">
                  <div className="space-y-5 border-t border-stone-100/90 p-4 sm:p-5">
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                        <StatusIcon className="h-4 w-4 text-[#FF8C42]" />
                        Order status
                      </h4>
                      <div className="flex w-full min-w-0 px-1">
                        {(
                          [
                            { key: 'pending' as const, label: 'Placed' },
                            { key: 'confirmed' as const, label: 'Confirmed' },
                            { key: 'processing' as const, label: 'Processing' },
                            { key: 'shipped' as const, label: 'Shipped' },
                            { key: 'delivered' as const, label: 'Delivered' },
                          ] as const
                        ).map((step, stepIndex) => {
                          const statusOrder = [
                            'pending',
                            'confirmed',
                            'processing',
                            'shipped',
                            'out_for_delivery',
                            'delivered',
                          ] as const;
                          const currentIndex = statusOrder.indexOf(order.status);
                          const isComplete =
                            stepIndex <= currentIndex && !['cancelled', 'returned'].includes(order.status);
                          const isCurrent =
                            order.status === step.key ||
                            (order.status === 'out_for_delivery' && step.key === 'delivered');
                          const active = !['cancelled', 'returned'].includes(order.status);
                          const lineLeftGreen = active && stepIndex > 0 && currentIndex >= stepIndex;
                          const lineRightGreen = active && stepIndex < 4 && currentIndex > stepIndex;

                          return (
                            <div key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
                              <div className="flex w-full items-center">
                                {stepIndex > 0 && (
                                  <div
                                    className={cn(
                                      'h-0.5 min-w-[2px] flex-1 rounded-full',
                                      lineLeftGreen ? 'bg-emerald-500' : 'bg-stone-200'
                                    )}
                                  />
                                )}
                                <div
                                  className={cn(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
                                    isComplete
                                      ? 'bg-emerald-500 text-white shadow-sm'
                                      : isCurrent
                                        ? 'bg-[#FF8C42] text-white shadow-[0_4px_12px_rgba(255,140,66,0.35)]'
                                        : 'bg-stone-200 text-stone-400'
                                  )}
                                >
                                  {isComplete ? <Check className="h-3.5 w-3.5" /> : stepIndex + 1}
                                </div>
                                {stepIndex < 4 && (
                                  <div
                                    className={cn(
                                      'h-0.5 min-w-[2px] flex-1 rounded-full',
                                      lineRightGreen ? 'bg-emerald-500' : 'bg-stone-200'
                                    )}
                                  />
                                )}
                              </div>
                              <span className="mt-2 w-full px-0.5 text-center text-[10px] font-medium leading-tight text-gray-500">
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {order.tracking_number && (
                      <div className="rounded-2xl bg-blue-50/90 p-4 text-sm">
                        <p className="text-xs font-semibold text-blue-600">Tracking</p>
                        <p className="mt-1 break-all font-bold text-blue-900">{order.tracking_number}</p>
                        {order.estimated_delivery && (
                          <p className="mt-1 text-xs text-blue-700">Expected by {order.estimated_delivery}</p>
                        )}
                      </div>
                    )}

                    <div>
                      <h4 className="mb-2.5 text-sm font-bold text-gray-900">Items</h4>
                      <div className="space-y-2.5">
                        {order.items?.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 rounded-2xl bg-stone-50/90 p-3 text-sm"
                          >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-stone-100 bg-white text-xl">
                              {item.product_emoji || '📦'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900">{item.product_name}</p>
                              <p className="text-[11px] font-medium text-[#FF8C42]">{item.vendor_name}</p>
                              <p className="text-[11px] text-gray-500">
                                Qty: {item.quantity} × ₹{item.price}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-bold text-gray-900">
                              ₹{item.quantity * item.price}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2.5 text-sm font-bold text-gray-900">Delivery address</h4>
                      <div className="rounded-2xl bg-stone-50/90 p-4 text-xs leading-relaxed text-gray-600">
                        <p className="font-semibold text-gray-900">{order.shipping_address?.name}</p>
                        <p className="mt-1">{order.shipping_address?.line1}</p>
                        <p>
                          {order.shipping_address?.city}, {order.shipping_address?.state} —{' '}
                          {order.shipping_address?.pincode}
                        </p>
                        <p className="mt-2 flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-[#FF8C42]" />
                          {order.shipping_address?.phone}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2.5 text-sm font-bold text-gray-900">Payment</h4>
                      <div className="space-y-2 rounded-2xl bg-stone-50/90 p-4 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal</span>
                          <span className="font-medium text-gray-900">₹{order.subtotal}</span>
                        </div>
                        {order.discount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-emerald-600">Discount</span>
                            <span className="font-medium text-emerald-600">-₹{order.discount}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-gray-600">Shipping</span>
                          <span
                            className={cn(
                              'font-medium',
                              order.shipping_fee === 0 ? 'text-emerald-600' : 'text-gray-900'
                            )}
                          >
                            {order.shipping_fee === 0 ? 'FREE' : `₹${order.shipping_fee}`}
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-stone-200 pt-2 font-bold">
                          <span className="text-gray-900">Total</span>
                          <span className="text-[#FF8C42]">₹{order.total}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-gray-500">Method:</span>
                          <span>{order.payment_method}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              order.payment_status === 'paid'
                                ? 'bg-emerald-100 text-emerald-700'
                                : order.payment_status === 'pending'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-stone-100 text-stone-700'
                            )}
                          >
                            {order.payment_status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {['pending', 'confirmed', 'processing'].includes(order.status) && (
                        <button
                          type="button"
                          onClick={() => cancelOrder(order.id)}
                          className={cn(
                            ORDER_ACTION_BTN_CLASS,
                            'border-2 border-red-200 bg-white text-red-600 hover:bg-red-50'
                          )}
                        >
                          Cancel order
                        </button>
                      )}
                      {order.status === 'delivered' && (
                        <>
                          <button
                            type="button"
                            onClick={() => requestReturn(order.id)}
                            className={cn(
                              ORDER_ACTION_BTN_CLASS,
                              'border-2 border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
                            )}
                          >
                            <RefreshCcw className="h-4 w-4" />
                            Return order
                          </button>
                          <button
                            type="button"
                            className={cn(
                              ORDER_ACTION_BTN_CLASS,
                              'bg-gradient-to-r from-[#FF8C42] to-[#FF7A35] text-white shadow-[0_4px_16px_rgba(255,140,66,0.3)]'
                            )}
                          >
                            <Star className="h-4 w-4" />
                            Rate &amp; review
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => downloadInvoice(order.id)}
                        className={cn(
                          ORDER_ACTION_BTN_CLASS,
                          'border-2 border-stone-200 bg-white text-gray-700 hover:bg-stone-50'
                        )}
                      >
                        <Download className="h-4 w-4" />
                        Invoice
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-customer bg-[#FAF6F0] pb-[max(7rem,env(safe-area-inset-bottom,0px))]">
      <ServiceDashboardHeader
        serviceName="My Orders"
        serviceSubtitle="Track and manage your pet product orders"
        serviceIcon={ShoppingBag}
        iconColor="text-white"
        stats={[]}
        onBack={handleBack}
        showBackButton
        onCloseToHome={onCloseToHome ? handleCloseToHome : undefined}
        bottomEdge="sheet"
        sheetToneClass="bg-[#FAF6F0]"
        headerBackground={<MyOrdersHeaderBackground />}
      />

      <main className="space-y-5 px-4 pb-4 pt-2 sm:px-5">
        <MyOrdersStatsRow
          total={dashboardStats.total}
          active={dashboardStats.active}
          completed={dashboardStats.completed}
          loading={loading}
        />

        <MyOrdersSearchRow
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterActive={filterStatus !== ''}
          onFilterClick={() => {
            setFilterOpen(true);
            listShellRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }}
        />

        <div ref={listShellRef}>
          <MyOrdersListShell
            filterLabel={getOrderFilterLabel(filterStatus)}
            filterOpen={filterOpen}
            onFilterHeaderClick={() => setFilterOpen((open) => !open)}
            filterMenu={filterMenu}
            headerRef={listHeaderRef}
          >
            {renderListBody()}
          </MyOrdersListShell>
        </div>
      </main>
    </div>
  );
}
