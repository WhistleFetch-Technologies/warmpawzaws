'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  downloadMealOrderInvoice,
  getMealOrderInvoiceDownloadMessage,
  isMealOrderInvoiceAvailable,
} from '@/lib/meal-order-invoice-download';
import { sanitizeDisplayImageUrl } from '@/lib/resolve-display-image-url';
import { resolveCustomerPublicAssetUrl } from '@/lib/public-asset-url';
import {
  rememberSubscriptionsBackFromCurrentUrl,
  rememberSubscriptionsBackSpaScreen,
  rememberMealOneTimePayBackFromPath,
  rememberMealOneTimePayBackToSpaScreen,
  goBackOrReplace,
  rememberHelpBackFromCurrentUrl,
} from '@/lib/go-back-or-replace';
import {
  navigateToMealOrderTracking,
  resolveMealOrderRowId,
} from '@/lib/meal-order-tracking-nav';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import { MealPlansComingSoon } from '@/components/customer/nutrition/MealPlansComingSoon';
import { isMealPaymentHoldExpired } from '@/lib/payment-hold-ui';
import { parseMealRefundReview, type MealRefundReviewMetadata } from '@/lib/meal-refund-review';
import { getResolvedCustomerId, persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { useMealSubscriptionsList } from '@/hooks/useMealSubscriptions';
import { Button } from '@/components/ui/button';
import { ActivePlanBanner } from '@/components/customer/meal-plans/ActivePlanBanner';
import { MealOrderCard } from '@/components/customer/meal-plans/MealOrderCard';
import { MealOrderFilterTabs } from '@/components/customer/meal-plans/MealOrderFilterTabs';
import { MealPlanOrdersHeader } from '@/components/customer/meal-plans/MealPlanOrdersHeader';
import { MealPlanOrdersListSkeleton } from '@/components/customer/meal-plans/MealPlanOrdersListSkeleton';
import { TrustFooter } from '@/components/customer/meal-plans/TrustFooter';
import {
  matchesMealOrderFilter,
  type MealOrderFilterId,
} from '@/components/customer/meal-plans/meal-plan-order-display';

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
  /** Present when API includes breed; optional display-only field. */
  pet_breed?: string;
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
  const rowId = String(o.id ?? o.order_id ?? o.orderId ?? '').trim();
  return {
    ...o,
    id: rowId || String(o.id ?? ''),
    subscription_id: o.subscription_id != null ? String(o.subscription_id) : null,
    meal_plan_name:
      (o.meal_plan_name as string) ||
      (o.meal_name as string) ||
      (o.meal_plan_id as string) ||
      'Meal Plan',
    meal_plan_image_url: resolveMealOrderImageUrl(o),
    pet_name: (o.pet_name as string) || undefined,
    pet_breed: (o.pet_breed as string) || (o.petBreed as string) || undefined,
    quantity: o.quantity != null ? Number(o.quantity) : undefined,
    payment_status:
      o.payment_status != null
        ? String(o.payment_status)
        : o.paymentStatus != null
          ? String(o.paymentStatus)
          : undefined,
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
  const filterRef = useRef<HTMLDivElement>(null);

  const [orders, setOrders] = useState<MealPlanOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<MealOrderFilterId>('all');

  const activeSubsQuery = useMealSubscriptionsList(customerId, 'active');
  const activeSubscription = activeSubsQuery.data?.[0] as Record<string, unknown> | undefined;
  const hasActiveSubscription = Boolean(activeSubscription);
  const subscriptionsReady = !customerId || !activeSubsQuery.isLoading;

  useEffect(() => {
    loadOrders();
  }, [fixedCustomerPhone, searchParams]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const resolved = await resolveCustomerIdForMealOrders(fixedCustomerPhone, searchParams);
      setCustomerId(resolved.customerId);
      if (!resolved.customerId) {
        setOrders([]);
        return;
      }

      const mealPlanOrders = await fetchMealPlanOrdersForCustomer(
        resolved.customerId,
        resolved.customerPhone,
      );
      setOrders(mealPlanOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesMealOrderFilter(order, activeFilter)),
    [orders, activeFilter],
  );

  const showFullEmpty =
    !loading && subscriptionsReady && orders.length === 0 && !hasActiveSubscription;

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
      if (typeof window !== 'undefined') {
        const path = window.location.pathname + window.location.search;
        if (path.startsWith('/orders/meal-plans')) {
          rememberMealOneTimePayBackFromPath(path);
        } else {
          rememberMealOneTimePayBackToSpaScreen('meal-plan-orders');
        }
      }
      router.push(
        `/meal-plans/checkout-pay?mealPlanName=${encodeURIComponent(order.meal_plan_name || 'Meal plan')}`,
      );
    } catch (err) {
      console.error('[MealPlanOrders] pay now failed:', err);
      toast.error('Could not open payment. Try again.');
    }
  };

  const handleTrackClick = (order: MealPlanOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    const orderId = resolveMealOrderRowId(order);
    if (!orderId) {
      toast.error('Order ID missing — refresh and try again.');
      return;
    }
    if (onTrackOrder) {
      onTrackOrder(orderId);
      return;
    }
    const customerPhone =
      fixedCustomerPhone?.trim() ||
      searchParams.get('phone')?.trim() ||
      undefined;
    navigateToMealOrderTracking(router, orderId, {
      phone: customerPhone,
      from: 'meal-plans',
    });
  };

  const handleDownloadInvoice = async (order: MealPlanOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    const orderId = resolveMealOrderRowId(order);
    if (!orderId) {
      toast.error('Order ID missing — refresh and try again.');
      return;
    }
    if (!isMealOrderInvoiceAvailable(order)) {
      toast.error('Invoice is available after payment is confirmed');
      return;
    }
    try {
      const { saveResult } = await downloadMealOrderInvoice(orderId);
      if (saveResult === 'failed') {
        toast.error(getMealOrderInvoiceDownloadMessage(saveResult));
      } else {
        toast.success(getMealOrderInvoiceDownloadMessage(saveResult));
      }
    } catch (err: unknown) {
      console.error('[MealPlanOrders] invoice download failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to download invoice');
    }
  };

  const handleBackClick = () => {
    if (onBack) {
      onBack();
      return;
    }
    goBackOrReplace(router, '/bookings');
  };

  const openActivePlanDetails = () => {
    if (!activeSubscription?.id) return;
    if (onBack) {
      rememberSubscriptionsBackSpaScreen('meal-plan-orders');
    } else {
      rememberSubscriptionsBackFromCurrentUrl();
    }
    router.push(`/subscriptions/detail?id=${encodeURIComponent(String(activeSubscription.id))}`);
  };

  const browseMeals = () => {
    router.push('/services/nutrition');
  };

  const scrollToFilters = () => {
    filterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const filterEmptyLabel =
    activeFilter === 'all'
      ? 'No meal orders yet'
      : activeFilter === 'delivered'
        ? 'No delivered orders'
        : activeFilter === 'upcoming'
          ? 'No upcoming orders'
          : 'No cancelled orders';

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-customer flex-col overflow-x-hidden bg-[var(--color-primary-50,#FFF5EE)] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <MealPlanOrdersHeader
        onBack={handleBackClick}
        onHelp={() => {
          rememberHelpBackFromCurrentUrl();
          router.push('/help');
        }}
        onFilter={scrollToFilters}
      />

      <main className="flex-1 space-y-4 px-4 pt-4">
        {!loading && hasActiveSubscription && activeSubscription ? (
          <ActivePlanBanner subscription={activeSubscription} onViewDetails={openActivePlanDetails} />
        ) : null}

        {loading ? (
          <MealPlanOrdersListSkeleton />
        ) : showFullEmpty ? (
          <div className="rounded-3xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-slate-200/60">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100">
              <UtensilsCrossed className="h-8 w-8 text-orange-500" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">No meal orders yet</h2>
            <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-slate-500">
              Start ordering fresh healthy meals for your pet.
            </p>
            <Button type="button" className="mt-6 min-h-11 w-full max-w-xs rounded-2xl" onClick={browseMeals}>
              Browse Meals
            </Button>
          </div>
        ) : (
          <>
            {orders.length > 0 ? (
              <MealOrderFilterTabs
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                filterRef={filterRef}
              />
            ) : null}

            {orders.length > 0 && filteredOrders.length === 0 ? (
              <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-slate-200/60">
                <p className="font-semibold text-slate-800">{filterEmptyLabel}</p>
                <p className="mt-1 text-sm text-slate-500">Try another filter to see your orders.</p>
              </div>
            ) : null}

            {filteredOrders.length > 0 ? (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <MealOrderCard
                    key={order.id}
                    order={order}
                    onTrack={(e) => handleTrackClick(order, e)}
                    onPayNow={(e) => void handlePayNow(order, e)}
                    onDownloadInvoice={(e) => void handleDownloadInvoice(order, e)}
                    onReorder={(e) => {
                      e.stopPropagation();
                      browseMeals();
                    }}
                    onPaymentHoldExpired={() => void loadOrders()}
                  />
                ))}
              </div>
            ) : null}

            <TrustFooter />
          </>
        )}
      </main>
    </div>
  );
}
