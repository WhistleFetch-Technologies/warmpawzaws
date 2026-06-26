'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  Package,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  Truck,
  Home,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  Phone,
  User,
  AlertCircle,
  UtensilsCrossed,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeDisplayImageUrl } from '@/lib/resolve-display-image-url';
import { resolveCustomerPublicAssetUrl } from '@/lib/public-asset-url';
import {
  rememberSubscriptionsBackFromCurrentUrl,
  rememberSubscriptionsBackSpaScreen,
  goBackOrReplace,
} from '@/lib/go-back-or-replace';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import { MealPlansComingSoon } from '@/components/customer/nutrition/MealPlansComingSoon';
import {
  isMealOrderAwaitingPayment,
  isMealOrderPaymentHoldVisible,
  isMealPaymentHoldExpired,
  PaymentHoldBanner,
  resolvePaymentHoldExpiresAt,
} from '@/lib/payment-hold-ui';
import { parseMealRefundReview, type MealRefundReviewMetadata } from '@/lib/meal-refund-review';
import { MealRefundReviewListBanner } from '@/components/customer/meal-plans/MealRefundReviewListBanner';
import { getResolvedCustomerId, persistCustomerDatabaseId } from '@/lib/customer-id-storage';

export interface MealPlanOrder {
  id: string;
  order_number: string;
  /** Present when this row mirrors a canonical weekly/monthly subscription session. */
  subscription_id?: string | null;
  meal_plan_id: string;
  meal_plan_name: string;
  meal_plan_image_url?: string;
  pet_id: string;
  pet_name: string;
  quantity: number;
  total_amount: number;
  status: string;
  payment_status?: string;
  paymentHoldExpiresAt?: string | null;
  payment_hold_expires_at?: string | null;
  delivery_date: string;
  delivery_time: string;
  delivery_address: string;
  created_at: string;
  updated_at: string;
  delivery_otp?: string;
  otp_verified?: boolean;
  delivery_partner_name?: string;
  delivery_partner_phone?: string;
  refundReview?: MealRefundReviewMetadata | null;
}

function resolveMealOrderImageUrl(o: Record<string, unknown>): string | undefined {
  let firstPhoto: string | undefined;
  const photosRaw = o.photos;
  let photos: unknown[] = [];
  if (Array.isArray(photosRaw)) {
    photos = photosRaw;
  } else if (typeof photosRaw === 'string' && photosRaw.trim()) {
    try {
      const parsed = JSON.parse(photosRaw) as unknown;
      if (Array.isArray(parsed)) photos = parsed;
    } catch {
      /* ignore */
    }
  }
  if (photos[0]) {
    if (typeof photos[0] === 'string') firstPhoto = photos[0];
    else if (typeof photos[0] === 'object' && photos[0] !== null) {
      const p0 = photos[0] as { url?: string; src?: string };
      firstPhoto = p0.url || p0.src;
    }
  }
  const raw =
    o.meal_plan_image_url ??
    o.meal_plan_image ??
    o.mealImageUrl ??
    firstPhoto;
  const sanitized = sanitizeDisplayImageUrl(raw);
  return (
    resolveCustomerPublicAssetUrl(
      typeof raw === 'string' ? raw : sanitized ?? null,
    ) ?? sanitized
  );
}

function isMealOrderUnpaid(order: MealPlanOrder): boolean {
  return isMealOrderAwaitingPayment({
    status: order.status,
    paymentStatus: order.payment_status,
    paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
    createdAt: order.created_at,
  });
}

function displayMealOrderStatus(order: MealPlanOrder): string {
  if (isMealPaymentHoldExpired({
    status: order.status,
    paymentStatus: order.payment_status,
    paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
    createdAt: order.created_at,
  })) {
    return 'cancelled';
  }
  if (isMealOrderUnpaid(order)) return 'payment pending';
  return order.status.replace('_', ' ');
}

function resolveCustomerPhoneForOrders(
  fixedCustomerPhone: string | undefined,
  searchParams: ReturnType<typeof useSearchParams>,
): string {
  return (
    fixedCustomerPhone?.trim() ||
    searchParams?.get('phone')?.trim() ||
    localStorage.getItem('customerPhone')?.trim() ||
    localStorage.getItem('customer_phone')?.trim() ||
    localStorage.getItem('phone')?.trim() ||
    ''
  );
}

async function resolveCustomerIdByPhone(
  customerPhone: string,
): Promise<string | null> {
  const customer: unknown = await apiClient.get(
    `/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`,
  );
  const c = customer as { customer?: { id?: string }; id?: string };
  const customerId = c?.customer?.id || c?.id;
  if (customerId && typeof customerId === 'string') {
    persistCustomerDatabaseId(customerId);
    return customerId;
  }
  return null;
}

function normalizeCustomerPhoneForApi(phone: string): string {
  const last10 = phone.replace(/\D/g, '').slice(-10);
  return last10.length >= 10 ? last10 : phone.trim();
}

async function resolveCustomerIdForMealOrders(
  fixedCustomerPhone: string | undefined,
  searchParams: ReturnType<typeof useSearchParams>,
): Promise<{ customerId: string | null; customerPhone: string }> {
  const customerPhone = resolveCustomerPhoneForOrders(fixedCustomerPhone, searchParams);
  if (customerPhone) {
    const byPhone = await resolveCustomerIdByPhone(normalizeCustomerPhoneForApi(customerPhone));
    if (byPhone) return { customerId: byPhone, customerPhone };
  }
  const cached = getResolvedCustomerId();
  return { customerId: cached, customerPhone };
}

function extractMealPlanOrdersFromResponse(response: unknown): unknown[] {
  const r = response as {
    orders?: unknown[];
    data?: { orders?: unknown[] };
  };
  if (Array.isArray(r?.orders)) return r.orders;
  if (Array.isArray(r?.data?.orders)) return r.data.orders;
  return [];
}

function mapRawMealPlanOrderRow(o: Record<string, unknown>): MealPlanOrder {
  return {
    ...o,
    subscription_id: o.subscription_id != null ? String(o.subscription_id) : null,
    meal_plan_name:
      (o.meal_plan_name as string) ||
      (o.meal_name as string) ||
      (o.meal_plan_id as string) ||
      'Meal Plan',
    meal_plan_image_url: resolveMealOrderImageUrl(o),
    pet_name: (o.pet_name as string) || undefined,
    quantity: o.quantity != null ? Number(o.quantity) : undefined,
    payment_status: o.payment_status != null ? String(o.payment_status) : undefined,
    paymentHoldExpiresAt:
      (o.paymentHoldExpiresAt as string | null | undefined) ??
      (o.payment_hold_expires_at as string | null | undefined) ??
      null,
    refundReview: parseMealRefundReview(o.refundReview),
    delivery_date: o.delivery_date || o.scheduled_delivery_date || o.created_at,
    delivery_time:
      (o.delivery_time as string) || formatDeliveryTime(o.scheduled_delivery_slot) || '',
    delivery_address:
      typeof o.delivery_address === 'string'
        ? (() => {
            try {
              const p = JSON.parse(o.delivery_address as string) as {
                address?: string;
                addressLine1?: string;
              };
              return p?.address || p?.addressLine1 || (o.delivery_address as string);
            } catch {
              return o.delivery_address as string;
            }
          })()
        : ((o.delivery_address as { address?: string; addressLine1?: string })?.address ||
            (o.delivery_address as { addressLine1?: string })?.addressLine1 ||
            ''),
  } as MealPlanOrder;
}

async function fetchMealPlanOrdersForCustomer(
  customerId: string,
  customerPhone?: string,
): Promise<MealPlanOrder[]> {
  const q = new URLSearchParams();
  q.set('customerId', customerId);
  const phone = customerPhone?.trim();
  if (phone) q.set('phone', normalizeCustomerPhoneForApi(phone));

  let rows = extractMealPlanOrdersFromResponse(
    await apiClient.get(`/customer/meal-plan-orders?${q.toString()}`),
  );

  // Fallback: primary list route can return [] when optional refund metadata tables are missing on RDS.
  if (rows.length === 0) {
    const alt = await apiClient.get(`/meal/orders/customer/${encodeURIComponent(customerId)}`);
    rows = extractMealPlanOrdersFromResponse(alt);
  }

  return rows.map((o) => mapRawMealPlanOrderRow(o as Record<string, unknown>));
}

function formatDeliveryTime(slot: unknown): string {
  if (!slot) return '';
  if (typeof slot === 'string') return slot;
  if (typeof slot === 'object' && slot !== null) {
    const o = slot as { start?: string; end?: string };
    if (o.start) return o.start;
    if (o.end) return o.end;
  }
  return '';
}

export interface MealPlanOrdersPanelProps {
  /**
   * When set (e.g. CustomerHomeWrapper shell), load orders for this phone only.
   * When omitted, resolves phone from `?phone=` then localStorage (standalone /orders/meal-plans).
   */
  fixedCustomerPhone?: string;
  onBack?: () => void;
  /** If provided (shell), open tracking in-app instead of `/track/:id`. */
  onTrackOrder?: (orderId: string) => void;
}

export function MealPlanOrdersPanel(props: MealPlanOrdersPanelProps) {
  if (!isCustomerMealPlansEnabled()) {
    return (
      <MealPlansComingSoon
        onBack={props.onBack}
        title="Meal plan orders"
        subtitle="Track deliveries when we launch"
      />
    );
  }
  return <MealPlanOrdersPanelLive {...props} />;
}

function MealPlanOrdersPanelLive({
  fixedCustomerPhone,
  onBack,
  onTrackOrder,
}: MealPlanOrdersPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<MealPlanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOTP, setShowOTP] = useState<Record<string, boolean>>({});
  const [copiedOTP, setCopiedOTP] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, [fixedCustomerPhone, searchParams]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const { customerId, customerPhone } = await resolveCustomerIdForMealOrders(
        fixedCustomerPhone,
        searchParams,
      );
      if (!customerId) {
        setOrders([]);
        return;
      }

      const mealPlanOrders = await fetchMealPlanOrdersForCustomer(customerId, customerPhone);
      setOrders(mealPlanOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyOTP = (orderId: string, otp: string) => {
    navigator.clipboard.writeText(otp);
    setCopiedOTP(orderId);
    toast.success('OTP copied to clipboard');
    setTimeout(() => setCopiedOTP(null), 2000);
  };

  const toggleOTPVisibility = (orderId: string) => {
    setShowOTP((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const isOutForDelivery = (status: string) => {
    return ['out_for_delivery', 'dispatched', 'in_transit', 'arriving', 'on_way'].includes(
      status.toLowerCase(),
    );
  };

  const getStatusColor = (status: string, order?: MealPlanOrder) => {
    if (order && isMealPaymentHoldExpired({
      status: order.status,
      paymentStatus: order.payment_status,
      paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
      createdAt: order.created_at,
    })) {
      return 'bg-red-100 text-red-800';
    }
    if (order && isMealOrderUnpaid(order)) return 'bg-amber-100 text-amber-900';
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-purple-100 text-purple-800';
      case 'out_for_delivery':
        return 'bg-orange-100 text-orange-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'confirmed':
        return <CheckCircle className="w-4 h-4" />;
      case 'preparing':
        return <Package className="w-4 h-4" />;
      case 'out_for_delivery':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <Home className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const handlePayNow = async (order: MealPlanOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      isMealPaymentHoldExpired({
        status: order.status,
        paymentStatus: order.payment_status,
        paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
        createdAt: order.created_at,
      })
    ) {
      toast.error('Payment window expired. This order was cancelled.');
      void loadOrders();
      return;
    }
    try {
      const customerPhone = resolveCustomerPhoneForOrders(fixedCustomerPhone, searchParams);
      const res = (await apiClient.get(`/meal/orders/${order.id}`)) as {
        order?: Record<string, unknown>;
      };
      const o = res?.order;
      if (!o) {
        toast.error('Could not load order');
        return;
      }
      const ps = String(o.payment_status || '').toLowerCase();
      if (ps === 'paid' || ps === 'completed') {
        toast.info('This order is already paid');
        void loadOrders();
        return;
      }
      const snapRaw = o.purchase_snapshot;
      const snap =
        typeof snapRaw === 'string'
          ? (JSON.parse(snapRaw) as Record<string, unknown>)
          : ((snapRaw as Record<string, unknown>) || {});
      const pricing = (snap.checkoutPricing as Record<string, unknown>) || {};
      const gst = (pricing.gst as Record<string, unknown>) || {};
      const deliveryAddress =
        typeof o.delivery_address === 'string'
          ? (JSON.parse(o.delivery_address) as Record<string, unknown>)
          : ((o.delivery_address as Record<string, unknown>) || {});
      const deliverySlot =
        typeof o.scheduled_delivery_slot === 'string'
          ? (JSON.parse(o.scheduled_delivery_slot) as { start: string; end: string })
          : ((o.scheduled_delivery_slot as { start?: string; end?: string }) || { start: '', end: '' });
      const draft = {
        existingOrderId: order.id,
        mealPlanId: String(o.meal_plan_id || order.meal_plan_id),
        customerId: o.customer_id ? String(o.customer_id) : undefined,
        customerPhone,
        vendorId: String(o.vendor_id || ''),
        quantity: Number(o.quantity || order.quantity || 1),
        petId: o.pet_id ? String(o.pet_id) : order.pet_id,
        deliveryAddress,
        scheduledDeliveryDate: String(o.scheduled_delivery_date || order.delivery_date || '').slice(0, 10),
        scheduledDeliverySlot: {
          start: deliverySlot.start || '',
          end: deliverySlot.end || '',
        },
        logisticsType: String(o.logistics_type || 'warmpawz'),
        foodSubtotalInr: Number(pricing.subtotal ?? o.subtotal ?? 0),
        foodGstPct: Number((gst as { foodGstPct?: number }).foodGstPct ?? 0),
        deliveryGstPct: Number((gst as { deliveryGstPct?: number }).deliveryGstPct ?? 0),
        deliveryFeeInr: Number(pricing.deliveryFee ?? o.delivery_fee ?? 0),
        platformFeeInr: Number(pricing.platformFee ?? 0),
        convenienceFeeInr: Number(pricing.convenienceFee ?? 0),
      };
      sessionStorage.setItem('meal_one_time_pay_draft_v1', JSON.stringify(draft));
      router.push(
        `/meal-plans/checkout-pay?mealPlanName=${encodeURIComponent(order.meal_plan_name || 'Meal plan')}`,
      );
    } catch (err) {
      console.error('[MealPlanOrders] pay now failed:', err);
      toast.error('Could not open payment. Try again.');
    }
  };

  const handleTrackClick = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTrackOrder) {
      onTrackOrder(orderId);
      return;
    }
    const q = new URLSearchParams();
    q.set('from', 'meal-plans');
    // Omit ?phone= — mismatched formatting caused 403 Unauthorized on GET /customer/tracking/:id
    router.push(`/track/${orderId}?${q.toString()}`);
  };

  const handleBackClick = () => {
    // Shell passes onBack → My Bookings. Standalone: pop history (avoid push loop with /bookings).
    if (onBack) {
      onBack();
      return;
    }
    goBackOrReplace(router, '/bookings');
  };

  const openSubscriptions = () => {
    if (onBack) {
      rememberSubscriptionsBackSpaScreen('meal-plan-orders');
    } else {
      rememberSubscriptionsBackFromCurrentUrl();
    }
    router.push('/subscriptions');
  };

  const hubNav = (
    <div
      className="mt-5 rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50/80 to-amber-50/60 p-3 sm:p-4"
      role="navigation"
      aria-label="Subscriptions"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-orange-800/80">
        More nutrition
      </p>
      <button
        type="button"
        onClick={openSubscriptions}
        className="group flex w-full items-center justify-between gap-2 rounded-lg border border-white/80 bg-white/90 px-3 py-3 text-left shadow-sm transition hover:border-orange-200 hover:shadow-md"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <UtensilsCrossed className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900">Subscriptions</span>
            <span className="block truncate text-xs text-gray-500">Meal plans &amp; recurring deliveries</span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:text-orange-500" aria-hidden />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <button
            onClick={handleBackClick}
            className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Package className="text-orange-500" size={32} />
            Meal Plan Orders
          </h1>
          <p className="text-gray-600 mt-2">Track your meal plan deliveries</p>
          {hubNav}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
          </div>
        ) : null}

        {!loading && orders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Yet</h3>
            <p className="text-gray-600 mb-6">You haven&apos;t placed any meal plan orders yet.</p>
            <button
              onClick={() => router.push('/services/nutrition')}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600"
            >
              Order Meal Plan
            </button>
          </div>
        ) : null}

        {!loading && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {order.meal_plan_name || 'Meal Plan'}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(order.status, order)}`}
                      >
                        {getStatusIcon(order.status)}
                        {displayMealOrderStatus(order).toUpperCase()}
                      </span>
                    </div>

                    {order.meal_plan_image_url ? (
                      <div className="mb-3 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                        <img
                          src={order.meal_plan_image_url}
                          alt={order.meal_plan_name || 'Meal plan'}
                          className="h-40 w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        <span>Order #{order.order_number || order.id.slice(-8)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Pet:</span>
                        <span>{order.pet_name || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Delivery:{' '}
                          {order.delivery_date
                            ? new Date(order.delivery_date).toLocaleDateString()
                            : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{order.delivery_time || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 col-span-2">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{order.delivery_address || 'Address not available'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-orange-600">₹{order.total_amount}</p>
                    <p className="text-sm text-gray-500 mt-1">Qty: {order.quantity ?? '—'}</p>
                  </div>
                </div>

                {order.status?.toLowerCase() === 'cancelled' &&
                order.refundReview?.status === 'pending_review' ? (
                  <MealRefundReviewListBanner refundReview={order.refundReview} />
                ) : null}

                {isMealOrderPaymentHoldVisible({
                  status: order.status,
                  paymentStatus: order.payment_status,
                  paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
                  createdAt: order.created_at,
                }) ? (
                  <PaymentHoldBanner
                    expiresAt={resolvePaymentHoldExpiresAt({
                      paymentHoldExpiresAt: order.paymentHoldExpiresAt ?? order.payment_hold_expires_at,
                      createdAt: order.created_at,
                    })}
                    onPayNow={(e) => void handlePayNow(order, e)}
                    onExpired={() => void loadOrders()}
                    holdMessage="Complete payment within 5 minutes to confirm your order with the kitchen."
                  />
                ) : null}

                {isOutForDelivery(order.status) && order.delivery_otp && !order.otp_verified && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-orange-600" />
                        <span className="font-bold text-orange-800">Your Delivery OTP</span>
                      </div>
                      {order.delivery_partner_name && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <User className="w-4 h-4" />
                            <span>{order.delivery_partner_name}</span>
                          </div>
                          {order.delivery_partner_phone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `tel:${order.delivery_partner_phone}`;
                              }}
                              className="p-2 bg-orange-100 rounded-full hover:bg-orange-200 transition"
                            >
                              <Phone className="w-4 h-4 text-orange-600" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-center gap-2 mb-3">
                      {order.delivery_otp.split('').map((digit, idx) => (
                        <div
                          key={idx}
                          className="w-12 h-14 bg-white rounded-lg shadow-sm border-2 border-orange-300 flex items-center justify-center"
                        >
                          <span className="text-2xl font-bold text-orange-600">
                            {showOTP[order.id] ? digit : '•'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOTPVisibility(order.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-orange-300 rounded-lg text-orange-700 hover:bg-orange-50 transition text-sm font-medium"
                      >
                        {showOTP[order.id] ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            Hide OTP
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            Show OTP
                          </>
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyOTP(order.id, order.delivery_otp!);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-orange-300 rounded-lg text-orange-700 hover:bg-orange-50 transition text-sm font-medium"
                      >
                        {copiedOTP === order.id ? (
                          <>
                            <Check className="w-4 h-4 text-green-600" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy OTP
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-3 flex items-start gap-2 text-sm text-orange-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p>Share this OTP with the delivery partner only after receiving your order.</p>
                    </div>
                  </div>
                )}

                {order.otp_verified && order.status.toLowerCase() === 'delivered' && (
                  <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200 flex items-center justify-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-800">Delivery Confirmed!</p>
                      <p className="text-sm text-green-600">
                        Your meal plan has been delivered successfully.
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-gray-600">
                    Ordered: {new Date(order.created_at).toLocaleString()}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {order.subscription_id ? (
                      <Link
                        href={`/subscriptions/detail?id=${encodeURIComponent(order.subscription_id)}`}
                        className="px-4 py-2 rounded-lg text-sm font-semibold border border-orange-300 text-orange-700 bg-white hover:bg-orange-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Reschedule in subscription
                      </Link>
                    ) : null}
                    {isMealOrderUnpaid(order) ? (
                      <button
                        onClick={(e) => handlePayNow(order, e)}
                        className="px-4 py-2 bg-[#FF8C42] text-white rounded-lg text-sm font-semibold hover:bg-orange-600"
                      >
                        Pay now
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleTrackClick(order.id, e)}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600"
                      >
                        Track Order
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
