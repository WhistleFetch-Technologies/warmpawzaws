'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ordersApi } from '@/lib/api-client';
import {
  downloadOrderInvoice,
  getOrderInvoiceDownloadMessage,
} from '@/lib/order-invoice-download';
import { toast } from 'sonner';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import {
  handleOrdersPageBack,
  rememberShopBackFromCurrentUrl,
  rememberShopBackToSpaScreen,
} from '@/lib/go-back-or-replace';
import type { ShopReturnSpaScreen } from '@/lib/go-back-or-replace';
import {
  Package, Truck, Clock, Check, X as XIcon,
  Phone, Calendar, ChevronDown, ChevronUp, Star,
  RefreshCcw, AlertCircle, Search, Download, ShoppingBag,
} from 'lucide-react';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import {
  OrderTrackingCard,
  resolveOrderTracking,
  shouldShowOrderTracking,
} from '@/components/shop/OrderTrackingCard';
import {
  ShopProductReviewModal,
  type ShopReviewItem,
} from '@/components/shop/ShopProductReviewModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Backend may return 404 for ?no orders? or missing route ? show empty state, not an error. */
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
  product_image?: string;
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
  tracking?: {
    carrierName?: string;
    trackingNumber?: string;
    trackingUrl?: string | null;
  };
  estimated_delivery?: string;
  delivered_at?: string;
  return_window_days?: number;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { badge: string; icon: typeof Clock; label: string }> = {
  pending: { badge: 'bg-amber-100 text-amber-800', icon: Clock, label: 'Order Placed' },
  confirmed: { badge: 'bg-blue-100 text-blue-800', icon: Check, label: 'Confirmed' },
  processing: { badge: 'bg-indigo-100 text-indigo-800', icon: Package, label: 'Processing' },
  shipped: { badge: 'bg-purple-100 text-purple-800', icon: Truck, label: 'Shipped' },
  out_for_delivery: { badge: 'bg-cyan-100 text-cyan-800', icon: Truck, label: 'Out for Delivery' },
  delivered: { badge: 'bg-emerald-100 text-emerald-800', icon: Check, label: 'Delivered' },
  cancelled: { badge: 'bg-red-100 text-red-800', icon: XIcon, label: 'Cancelled' },
  returned: { badge: 'bg-orange-100 text-orange-800', icon: RefreshCcw, label: 'Returned' },
};

function getOrderStatusDisplay(order: Order): { badge: string; icon: typeof Clock; label: string } {
  return statusConfig[order.status] || statusConfig.pending;
}

function normalizeItems(items: unknown): OrderItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((it: any, idx: number) => {
    const imageRaw = it.product_image ?? it.productImage ?? it.image ?? it.image_url;
    const productImage =
      typeof imageRaw === 'string' && imageRaw.trim() ? imageRaw.trim() : undefined;
    return {
      id: String(it.id ?? `item-${idx}`),
      product_id: String(it.product_id ?? it.productId ?? ''),
      product_name: it.product_name || it.service_name || it.name || 'Item',
      product_image: productImage,
      product_emoji: it.product_emoji || it.emoji,
      quantity: Number(it.quantity) || 1,
      price: Number(it.unit_price ?? it.price ?? it.unitPrice ?? 0),
      vendor_id: String(it.vendor_id ?? ''),
      vendor_name: it.vendor_name || 'Store',
    };
  });
}

function OrderItemThumbnail({
  item,
  className = 'w-10 h-10',
}: {
  item: OrderItem;
  className?: string;
}) {
  if (item.product_image) {
    return (
      <img
        src={item.product_image}
        alt=""
        className={`${className} shrink-0 rounded-lg object-cover bg-slate-100`}
      />
    );
  }
  return (
    <div
      className={`${className} shrink-0 flex items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 text-lg`}
    >
      {item.product_emoji || <Package className="w-5 h-5 text-slate-400" aria-hidden />}
    </div>
  );
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
  const tracking = resolveOrderTracking(raw);

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
    payment_method: raw.payment_method || 'online',
    payment_status: String(raw.payment_status || 'pending').toLowerCase(),
    tracking_number: raw.tracking_number,
    tracking,
    estimated_delivery: raw.estimated_delivery,
    delivered_at: raw.delivered_at || undefined,
    return_window_days: raw.return_window_days != null ? Number(raw.return_window_days) : undefined,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
  };
}

/** Returns true if the return window is still open for a delivered order. */
function isReturnWindowOpen(order: Order): boolean {
  if (order.status !== 'delivered') return false;
  if (!order.delivered_at) return false;
  const windowDays = order.return_window_days ?? 7;
  const daysSinceDelivery = Math.floor(
    (Date.now() - new Date(order.delivered_at).getTime()) / 86_400_000
  );
  return daysSinceDelivery <= windowDays;
}

export interface CustomerShopOrdersScreenProps {
  onBack?: () => void;
  onCloseToHome?: () => void;
  /** When My Orders lives on `/` (profile), remember this SPA screen so `/shop` back restores it. */
  spaShopReturnScreen?: ShopReturnSpaScreen;
}

export function CustomerShopOrdersScreen({ onBack, onCloseToHome, spaShopReturnScreen }: CustomerShopOrdersScreenProps) {
  const router = useRouter();

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
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [reviewTarget, setReviewTarget] = useState<{ orderId: string; items: ShopReviewItem[] } | null>(null);
  const [reviewedProductIds, setReviewedProductIds] = useState<Set<string>>(new Set());

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    handleOrdersPageBack(router);
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
      await ordersApi.returnOrder(orderId, { reason: 'Customer request' });
      await loadOrders();
    } catch (err: any) {
      console.error('Error requesting return:', err);
      alert('Failed to request return: ' + (err.message || 'Unknown error'));
    }
  };

  const downloadInvoice = async (orderId: string) => {
    try {
      const { saveResult } = await downloadOrderInvoice(orderId);
      if (saveResult === 'failed') {
        toast.error(getOrderInvoiceDownloadMessage(saveResult));
      } else {
        toast.success(getOrderInvoiceDownloadMessage(saveResult));
      }
    } catch (err: any) {
      console.error('Error downloading invoice:', err);
      toast.error(err.message || 'Failed to download invoice');
    }
  };

  const openProductReview = async (order: Order) => {
    const customerId = getResolvedCustomerId();
    if (!customerId) {
      toast.error('Please sign in to leave a review');
      return;
    }

    const orderItems: ShopReviewItem[] = order.items
      .filter((item) => item.product_id)
      .map((item) => ({
        orderItemId: item.id,
        productId: item.product_id,
        productName: item.product_name,
        productEmoji: item.product_emoji,
      }));

    if (orderItems.length === 0) {
      toast.error('No products to review on this order');
      return;
    }

    let reviewableItems = orderItems.filter((item) => !reviewedProductIds.has(item.productId));

    try {
      const res = await apiClient.get<{ pendingReviews?: Array<{ orderId?: string; productId?: string }> }>(
        `/customer/${customerId}/product-reviews/pending`,
      );
      const pending = Array.isArray(res?.pendingReviews) ? res.pendingReviews : [];
      const pendingForOrder = pending.filter((p) => String(p.orderId) === order.id);
      if (pending.length > 0) {
        if (pendingForOrder.length === 0) {
          reviewableItems = [];
        } else {
          const pendingIds = new Set(pendingForOrder.map((p) => String(p.productId)));
          reviewableItems = orderItems.filter((item) => pendingIds.has(item.productId));
        }
      }
    } catch {
      /* fall back to local/session state */
    }

    if (reviewableItems.length === 0) {
      toast.info('You have already reviewed all products in this order');
      return;
    }

    setReviewTarget({ orderId: order.id, items: reviewableItems });
  };

  const handleReviewSubmitted = (productIds: string[]) => {
    setReviewedProductIds((prev) => {
      const next = new Set(prev);
      for (const id of productIds) next.add(id);
      return next;
    });
  };

  const filteredOrders = orders.filter(
    (order) =>
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.items?.some((item) => item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const orderCountLabel =
    orders.length === 0
      ? 'No orders yet'
      : `${orders.length} order${orders.length === 1 ? '' : 's'}`;

  const dashboardStats = useMemo(() => {
    const active = orders.filter((o) =>
      ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery'].includes(o.status)
    ).length;
    const done = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled' || o.status === 'returned').length;
    return [
      { value: loading ? '—' : String(orders.length), label: 'Total' },
      { value: loading ? '—' : String(active), label: 'Active' },
      { value: loading ? '—' : String(done), label: 'Done' },
    ];
  }, [orders, loading]);

  return (
    <div className="min-h-[100dvh] bg-neutral-200/90 sm:bg-neutral-200 flex justify-center">
      <div className="min-h-[100dvh] w-full max-w-customer bg-gradient-to-b from-orange-50 via-amber-50/90 to-orange-50/80 pb-[max(7rem,env(safe-area-inset-bottom,0px))] sm:shadow-[0_0_48px_rgba(0,0,0,0.06)] sm:border-x border-black/[0.04]">
        <ServiceDashboardHeader
          serviceName="My Orders"
          serviceSubtitle={loading ? 'Loading…' : orderCountLabel}
          serviceIcon={ShoppingBag}
          iconColor="text-white"
          stats={dashboardStats}
          onBack={handleBack}
          showBackButton
          onCloseToHome={onCloseToHome ? handleCloseToHome : undefined}
        />

        <main className="w-full px-3 sm:px-4 pt-3 sm:pt-4 space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-2.5 sm:gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Order # or product"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-11 pl-10 pr-3 py-2.5 text-[15px] sm:text-sm border border-orange-100/90 rounded-2xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300/80 touch-manipulation"
            />
          </div>
          <Select
            value={filterStatus === '' ? 'all' : filterStatus}
            onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}
          >
            <SelectTrigger
              className="w-full min-h-11 h-auto py-2.5 px-3.5 text-[15px] sm:text-sm font-medium text-slate-800 border border-orange-100/90 rounded-2xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-300/80 focus-visible:ring-orange-300/80 data-[size=default]:h-auto [&_svg]:text-orange-400/90 touch-manipulation"
              aria-label="Filter orders by status"
            >
              <SelectValue placeholder="All Orders" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={8}
              className="rounded-2xl border border-orange-100/90 bg-white p-1.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.18),0_4px_16px_-4px_rgba(255,107,53,0.12)] z-[200] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            >
              <SelectItem
                value="all"
                className="rounded-xl py-3 pl-3 pr-9 text-[15px] sm:text-sm cursor-pointer hover:bg-orange-50/80 focus:bg-orange-50 data-[highlighted]:bg-orange-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-orange-50/80"
              >
                <span className="flex items-center gap-2.5">
                  <ShoppingBag className="size-4 shrink-0 text-orange-500" strokeWidth={2} />
                  All Orders
                </span>
              </SelectItem>
              <SelectItem
                value="pending"
                className="rounded-xl py-3 pl-3 pr-9 text-[15px] sm:text-sm cursor-pointer hover:bg-orange-50/80 focus:bg-orange-50 data-[highlighted]:bg-orange-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-orange-50/80"
              >
                <span className="flex items-center gap-2.5">
                  <Clock className="size-4 shrink-0 text-amber-500" strokeWidth={2} />
                  Pending
                </span>
              </SelectItem>
              <SelectItem
                value="processing"
                className="rounded-xl py-3 pl-3 pr-9 text-[15px] sm:text-sm cursor-pointer hover:bg-orange-50/80 focus:bg-orange-50 data-[highlighted]:bg-orange-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-orange-50/80"
              >
                <span className="flex items-center gap-2.5">
                  <Package className="size-4 shrink-0 text-indigo-500" strokeWidth={2} />
                  Processing
                </span>
              </SelectItem>
              <SelectItem
                value="shipped"
                className="rounded-xl py-3 pl-3 pr-9 text-[15px] sm:text-sm cursor-pointer hover:bg-orange-50/80 focus:bg-orange-50 data-[highlighted]:bg-orange-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-orange-50/80"
              >
                <span className="flex items-center gap-2.5">
                  <Truck className="size-4 shrink-0 text-violet-500" strokeWidth={2} />
                  Shipped
                </span>
              </SelectItem>
              <SelectItem
                value="delivered"
                className="rounded-xl py-3 pl-3 pr-9 text-[15px] sm:text-sm cursor-pointer hover:bg-orange-50/80 focus:bg-orange-50 data-[highlighted]:bg-orange-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-orange-50/80"
              >
                <span className="flex items-center gap-2.5">
                  <Check className="size-4 shrink-0 text-emerald-600" strokeWidth={2} />
                  Delivered
                </span>
              </SelectItem>
              <SelectItem
                value="cancelled"
                className="rounded-xl py-3 pl-3 pr-9 text-[15px] sm:text-sm cursor-pointer hover:bg-orange-50/80 focus:bg-orange-50 data-[highlighted]:bg-orange-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-orange-50/80"
              >
                <span className="flex items-center gap-2.5">
                  <XIcon className="size-4 shrink-0 text-red-500" strokeWidth={2} />
                  Cancelled
                </span>
              </SelectItem>
              <SelectItem
                value="returned"
                className="rounded-xl py-3 pl-3 pr-9 text-[15px] sm:text-sm cursor-pointer hover:bg-orange-50/80 focus:bg-orange-50 data-[highlighted]:bg-orange-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-orange-50/80"
              >
                <span className="flex items-center gap-2.5">
                  <RefreshCcw className="size-4 shrink-0 text-orange-600" strokeWidth={2} />
                  Returned
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500" />
            <p className="mt-4 text-sm text-slate-500">Loading orders...</p>
          </div>
        ) : error ? (
          <div className="text-center py-10 sm:py-12 px-4 bg-white rounded-2xl border border-orange-100 shadow-sm">
            <AlertCircle className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 text-amber-400" />
            <p className="text-slate-800 font-semibold text-[15px] sm:text-sm">Unable to load orders</p>
            <p className="text-xs text-slate-500 mt-1.5 break-words leading-relaxed">{error}</p>
            <button
              type="button"
              onClick={() => loadOrders()}
              className="mt-5 min-h-11 px-6 text-sm font-semibold bg-orange-500 text-white rounded-2xl hover:bg-orange-600 active:scale-[0.98] transition-all touch-manipulation w-full max-w-xs mx-auto block"
            >
              Try again
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-10 sm:py-12 px-4 sm:px-5 bg-white rounded-2xl border border-orange-100 shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-orange-500" strokeWidth={1.75} />
            </div>
            <h2 className="text-[17px] sm:text-lg font-bold text-slate-900 mb-1.5">
              {orders.length === 0 ? 'No orders yet' : 'No matches'}
            </h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed max-w-[280px] mx-auto">
              {orders.length === 0
                ? 'Shop for your pet and your orders will show up here.'
                : 'Try a different search or reset your filters.'}
            </p>
            {orders.length === 0 ? (
              <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={goToShop}
                  className="min-h-12 w-full inline-flex items-center justify-center gap-2 text-[15px] font-semibold bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl shadow-md active:scale-[0.98] transition-transform touch-manipulation"
                >
                  <ShoppingBag className="w-5 h-5 shrink-0" />
                  Shop now
                </button>
                <button
                  type="button"
                  onClick={goToShop}
                  className="min-h-11 w-full text-[15px] font-medium text-orange-600 rounded-2xl border border-orange-200 bg-orange-50/50 hover:bg-orange-50 active:scale-[0.99] transition-all touch-manipulation"
                >
                  Browse products
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('');
                }}
                className="min-h-12 px-6 text-[15px] font-semibold text-orange-700 rounded-2xl border-2 border-orange-200 bg-white hover:bg-orange-50/80 active:scale-[0.98] transition-all touch-manipulation w-full max-w-xs mx-auto"
              >
                Show all orders
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {filteredOrders.map((order) => {
              const isExpanded = expandedOrder === order.id;
              const config = getOrderStatusDisplay(order);
              const StatusIcon = config.icon;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-orange-100/80 overflow-hidden shadow-sm"
                >
                  <div className="p-4 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900 text-sm">
                            Order ID - {order.order_number}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.badge}`}>
                            {config.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                          <span>{order.items?.length || 0} items</span>
                          <span className="font-semibold text-slate-900">
                            {formatPriceWithSymbol(order.total)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        className="p-2 hover:bg-slate-50 rounded-xl shrink-0"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      {order.items?.slice(0, 4).map((item) => (
                        <div
                          key={item.id}
                          className="flex-shrink-0 flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 max-w-[200px]"
                        >
                          <OrderItemThumbnail item={item} />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-xs line-clamp-2">{item.product_name}</p>
                            <p className="text-[10px] text-slate-500">Qty: {item.quantity}</p>
                          </div>
                        </div>
                      ))}
                      {(order.items?.length || 0) > 4 && (
                        <div className="flex-shrink-0 flex items-center px-3 bg-slate-100 rounded-xl text-xs text-slate-500">
                          +{(order.items?.length || 0) - 4} more
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-slate-100 space-y-4">
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm mb-2 flex items-center gap-2">
                          <StatusIcon className="w-4 h-4 text-orange-500" />
                          Order status
                        </h4>
                        <div className="flex w-full min-w-0">
                          {(
                            [
                              { key: 'pending' as const, label: 'Placed' },
                              { key: 'confirmed' as const, label: 'Confirmed' },
                              { key: 'processing' as const, label: 'Processing' },
                              { key: 'shipped' as const, label: 'Shipped' },
                              { key: 'delivered' as const, label: 'Delivered' },
                            ] as const
                          ).map((step, index) => {
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
                              index <= currentIndex && !['cancelled', 'returned'].includes(order.status);
                            const isCurrent =
                              order.status === step.key ||
                              (order.status === 'out_for_delivery' && step.key === 'delivered');
                            const active = !['cancelled', 'returned'].includes(order.status);
                            const lineLeftGreen = active && index > 0 && currentIndex >= index;
                            const lineRightGreen = active && index < 4 && currentIndex > index;

                            return (
                              <div key={step.key} className="flex flex-1 min-w-0 flex-col items-center">
                                <div className="flex w-full items-center">
                                  {index > 0 && (
                                    <div
                                      className={`h-0.5 flex-1 min-w-[2px] rounded ${lineLeftGreen ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                    />
                                  )}
                                  <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${
                                      isComplete
                                        ? 'bg-emerald-500 text-white'
                                        : isCurrent
                                          ? 'bg-orange-500 text-white'
                                          : 'bg-slate-200 text-slate-400'
                                    }`}
                                  >
                                    {isComplete ? <Check className="w-3.5 h-3.5" /> : index + 1}
                                  </div>
                                  {index < 4 && (
                                    <div
                                      className={`h-0.5 flex-1 min-w-[2px] rounded ${lineRightGreen ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                    />
                                  )}
                                </div>
                                <span className="mt-1.5 text-[10px] text-slate-500 text-center leading-tight px-0.5 w-full">
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {shouldShowOrderTracking(order.status, order.tracking_number) && (() => {
                        const trackingInfo = resolveOrderTracking(order);
                        return trackingInfo ? (
                          <OrderTrackingCard tracking={trackingInfo} />
                        ) : null;
                      })()}

                      {order.tracking_number && !shouldShowOrderTracking(order.status, order.tracking_number) && (
                        <div className="p-3 bg-blue-50 rounded-xl text-sm">
                          <p className="text-blue-600 font-medium text-xs">Tracking</p>
                          <p className="font-semibold text-blue-900 break-all">{order.tracking_number}</p>
                          {order.estimated_delivery && (
                            <p className="text-xs text-blue-700 mt-1">Expected by {order.estimated_delivery}</p>
                          )}
                        </div>
                      )}

                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm mb-2">Items</h4>
                        <div className="space-y-2">
                          {order.items?.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl text-sm">
                              <OrderItemThumbnail item={item} className="w-12 h-12" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 text-xs">{item.product_name}</p>
                                <p className="text-[10px] text-orange-600">{item.vendor_name}</p>
                                <p className="text-[10px] text-slate-500">
                                  Qty: {item.quantity} × {formatPriceWithSymbol(item.price)}
                                </p>
                              </div>
                              <p className="font-bold text-slate-900 text-xs shrink-0">
                                {formatPriceWithSymbol(item.quantity * item.price)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm mb-2">Delivery address</h4>
                        <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
                          <p className="font-medium text-slate-900">{order.shipping_address?.name}</p>
                          <p>{order.shipping_address?.line1}</p>
                          <p>
                            {order.shipping_address?.city}, {order.shipping_address?.state} -{' '}
                            {order.shipping_address?.pincode}
                          </p>
                          <p className="mt-1 flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {order.shipping_address?.phone}
                          </p>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm mb-2">Payment</h4>
                        <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Subtotal</span>
                            <span className="text-slate-900">{formatPriceWithSymbol(order.subtotal)}</span>
                          </div>
                          {order.discount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-emerald-600">Discount</span>
                              <span className="text-emerald-600">-{formatPriceWithSymbol(order.discount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-600">Shipping</span>
                            <span className={order.shipping_fee === 0 ? 'text-emerald-600' : 'text-slate-900'}>
                              {order.shipping_fee === 0 ? 'FREE' : formatPriceWithSymbol(order.shipping_fee)}
                            </span>
                          </div>
                          <div className="flex justify-between font-bold pt-2 border-t border-slate-200">
                            <span className="text-slate-900">Total</span>
                            <span className="text-orange-600">{formatPriceWithSymbol(order.total)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-slate-500">Method:</span>
                            <span>{order.payment_method}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                order.payment_status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : order.payment_status === 'pending'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {order.payment_status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {['pending', 'confirmed', 'processing'].includes(order.status) && (
                          <button
                            type="button"
                            onClick={() => cancelOrder(order.id)}
                            className="w-full py-2.5 text-sm border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50"
                          >
                            Cancel order
                          </button>
                        )}
                        {order.status === 'delivered' && (
                          <div className="flex flex-col gap-2">
                            {isReturnWindowOpen(order) ? (
                              <button
                                type="button"
                                onClick={() => requestReturn(order.id)}
                                className="w-full py-2.5 text-sm border border-orange-200 text-orange-600 rounded-xl font-medium hover:bg-orange-50 flex items-center justify-center gap-2"
                              >
                                <RefreshCcw className="w-4 h-4" />
                                Return order
                              </button>
                            ) : (
                              <p className="w-full py-2.5 text-sm text-center text-slate-400 border border-slate-100 rounded-xl">
                                Return window closed
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => void openProductReview(order)}
                              className="w-full py-2.5 text-sm bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                            >
                              <Star className="w-4 h-4" />
                              Rate &amp; review
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => downloadInvoice(order.id)}
                          className="w-full py-2.5 text-sm border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 flex items-center justify-center gap-2"
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

      <ShopProductReviewModal
        isOpen={reviewTarget != null}
        orderId={reviewTarget?.orderId ?? ''}
        items={reviewTarget?.items ?? []}
        onClose={() => setReviewTarget(null)}
        onSubmitted={(productId) => handleReviewSubmitted([productId])}
      />
    </div>
  );
}
