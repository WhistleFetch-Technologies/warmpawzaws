'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { formatMealOrderCustomerDelivery } from '@/lib/format-meal-order-schedule';
import {
  confirmVendorEarlyMealPrep,
  vendorMealPrepSchedulingFromOrder,
} from '@/lib/vendor-meal-prep-scheduling';
import { VendorMealPrepScheduleInfo } from '@/components/vendor/nutrition/VendorMealPrepScheduleInfo';
import { toast } from 'sonner';
import { MealProductFormModal } from '@/components/vendor/nutrition/MealProductFormModal';
import { formatPackWeightLabel, resolvePackWeightGramsFromMetadata } from '@/lib/meal-pack-weight';
import { MealKitchenAvailabilityCard } from '@/components/vendor/nutrition/MealKitchenAvailabilityCard';
import { useVendorWebSocket } from '@/hooks/useVendorWebSocket';
import {
  resolveEffectiveMealDeliveryState,
  formatVendorMealDeliveryBadge,
  isTerminalMealDeliveryState,
  type MealDeliveryEffective,
} from '@warmpawz/shared-types';

// 2D Sketch-style SVG Icons
const Icons = {
  utensils: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  ),
  package: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  mapPin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 21s-8-7.5-8-12a8 8 0 1116 0c0 4.5-8 12-8 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  dollarSign: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  leaf: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  fire: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
    </svg>
  ),
};

interface MealProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  metadata?: unknown;
  is_active?: boolean;
  duration_days?: number;
  prep_time_minutes?: number;
  lead_time_hours?: number;
  order_cutoff_time?: string;
}

interface MealOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  /** Meal line total only (listed price × qty), from API `vendor_meal_total`. */
  vendor_meal_total?: number;
  /** Subscription signup total paid by customer (parent row + mirrored sessions carry snapshot). */
  subscription_customer_paid_total_inr?: number;
  created_at: string;
  /** Scheduled drop-off day from meal_orders / booking flow (YYYY-MM-DD or ISO). */
  scheduled_delivery_date?: string;
  scheduled_delivery_slot?: unknown;
  prep_minutes?: number;
  prep_time_minutes?: number;
  expected_ready_at?: string;
  confirmed_at?: string; // Timestamp when payment was confirmed
  prep_started_at?: string; // Timestamp when vendor started preparing (indicates vendor accepted)
  items: any[];
  delivery_address?: any;
  /** Canonical weekly/monthly: parent queue row — Accept/Cancel signup. */
  subscription_vendor_parent_booking?: boolean;
  /** Mirrored per-session row — no Accept/Cancel; follows parent acceptance + scheduled date. */
  subscription_vendor_session_booking?: boolean;
  subscription_session_number?: number | null;
  subscription_booking_session_count?: number | null;
  subscription_booking_plan_kind?: string;
  subscription_booking_delivery_type?: string;
  subscription_monthly_delivery_frequency?: string;
  /** When `pidge`, delivery milestones after kitchen ready come from webhooks (not vendor buttons). */
  logistics_type?: string;
  /** Latest delivery_tracking.status for this meal_order (API enriched). */
  delivery_tracking_status?: string | null;
  /** Resolved display status (order ∪ logistics precedence). */
  effective_delivery_status?: MealDeliveryEffective;
}

interface NutritionistDashboardProps {
  vendorId: string;
  vendorName?: string;
}

function safeRupee(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Meal line total from API (snake_case or camelCase); ignores customer checkout totals. */
function coerceVendorMealListingAmount(raw: Record<string, unknown>): number {
  const candidates = [
    raw.vendor_meal_total,
    raw.vendorMealTotal,
    raw.subtotal,
    raw.meal_line_total,
    raw.mealLineTotal,
  ];
  for (const c of candidates) {
    const n = safeRupee(c);
    if (n > 0) return n;
  }
  return 0;
}

/** Vendor-facing meal listing amount only (meal line; excludes delivery, platform, convenience, GST). */
function vendorMealListingRupee(o: MealOrder): number {
  return coerceVendorMealListingAmount(o as Record<string, unknown>);
}

function subscriptionParentPlanTitle(o: MealOrder): string {
  const raw = o as Record<string, unknown>;
  const kind = String(raw.subscription_booking_plan_kind || '').toLowerCase();
  if (kind === 'weekly') return 'Weekly subscription';
  if (kind === 'monthly') return 'Monthly subscription';
  return 'Meal subscription';
}

function monthlyCadenceShort(freq: string): string {
  const f = freq.toUpperCase();
  if (f === 'DAILY') return 'daily';
  if (f === 'ALTERNATE_DAYS') return 'alternate days';
  if (f === 'TWICE_WEEKLY') return 'twice weekly';
  if (f === 'WEEKLY') return 'weekly';
  return 'monthly';
}

/** Vendor-facing session progress, e.g. weekly meal session · 3/7. */
function subscriptionSessionLabel(o: MealOrder): string {
  const raw = o as Record<string, unknown>;
  const n = Number(raw.subscription_session_number);
  const total = Number(raw.subscription_booking_session_count);
  const idx = Number.isFinite(n) && n > 0 ? Math.floor(n) : '?';
  const tot = Number.isFinite(total) && total > 0 ? Math.floor(total) : '?';
  const kind = String(raw.subscription_booking_plan_kind || '').toLowerCase();
  if (kind === 'weekly') {
    return `Weekly meal session · ${idx}/${tot}`;
  }
  if (kind === 'monthly') {
    const mf = String(raw.subscription_monthly_delivery_frequency || '').trim();
    const cadence = mf ? monthlyCadenceShort(mf) : 'chosen cadence';
    return `Monthly meal session (${cadence}) · ${idx}/${tot}`;
  }
  return `Meal session · ${idx}/${tot}`;
}

function isSubscriptionSessionRow(o: MealOrder): boolean {
  return Boolean(o.subscription_vendor_session_booking);
}

function vendorSubscriptionCancelHidden(o: MealOrder): boolean {
  return Boolean(o.subscription_vendor_parent_booking || o.subscription_vendor_session_booking);
}

function confirmMealOrderCancel(order: MealOrder): boolean {
  if (order.subscription_vendor_parent_booking) {
    return window.confirm(
      'Cancel this subscription booking?',
    );
  }
  return window.confirm('Are you sure you want to cancel this order? This action cannot be undone.');
}

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function scheduledYmdForOrder(o: MealOrder): string | null {
  const raw = (o as Record<string, unknown>).scheduled_delivery_date as string | Date | undefined | null;
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return ymdLocal(raw);
  const s = String(raw);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = new Date(s);
  if (!Number.isNaN(t.getTime())) return ymdLocal(t);
  return null;
}

/** Prefer scheduled delivery day; fall back to order created date (local calendar). */
function formatOrderCalendarDate(o: MealOrder): string {
  const sched = scheduledYmdForOrder(o);
  if (sched) {
    const [y, mo, d] = sched.split('-').map((x) => parseInt(x, 10));
    return new Date(y, mo - 1, d).toLocaleDateString();
  }
  return new Date(o.created_at).toLocaleDateString();
}

type VendorMealOrderBucket = 'past' | 'today' | 'upcoming';

/** Active slice when viewing the Orders tab (stat cards act as filters). */
type OrdersTabBucketFilter = VendorMealOrderBucket;

function vendorMealEffectiveStatus(o: MealOrder): MealDeliveryEffective {
  return (
    o.effective_delivery_status ??
    resolveEffectiveMealDeliveryState(
      String(o.status || ''),
      o.delivery_tracking_status != null ? String(o.delivery_tracking_status) : undefined,
    )
  );
}

/**
 * Bucket orders for vendor stats:
 * - Past: delivered, cancelled, or failed (incl. Pidge-cancelled) — all terminal work.
 * - Today: active orders due today/yesterday or overdue (not yet delivered/cancelled).
 * - Upcoming: future scheduled drop-offs still in progress.
 */
function mealOrderBucket(o: MealOrder): VendorMealOrderBucket {
  const st = vendorMealEffectiveStatus(o);
  if (isTerminalMealDeliveryState(st)) return 'past';

  const today = ymdLocal(new Date());
  const sched = scheduledYmdForOrder(o);
  if (!sched) return 'today';
  if (sched > today) return 'upcoming';
  return 'today';
}

export default function NutritionistDashboard({ vendorId, vendorName }: NutritionistDashboardProps) {
  const router = useRouter();
  const { subscribeToMealSubscriptionDeliveryBroadcast } = useVendorWebSocket(vendorId);
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'analytics'>('products');
  const [products, setProducts] = useState<MealProduct[]>([]);
  const [orders, setOrders] = useState<MealOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MealProduct | null>(null);
  // ✅ Track vendor-accepted orders locally (since we can't distinguish from payment confirmation in DB)
  // Use localStorage to persist across page refreshes
  const getStoredAcceptedOrders = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(`accepted_meal_orders_${vendorId}`);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        console.log(`[NutritionistDashboard] Loaded ${ids.length} accepted order IDs from localStorage:`, ids);
        return new Set(ids);
      }
    } catch (e) {
      console.warn('Error reading accepted orders from localStorage:', e);
    }
    return new Set();
  };
  const [acceptedOrderIds, setAcceptedOrderIds] = useState<Set<string>>(getStoredAcceptedOrders());
  /** Which bucket’s order list is shown under the stats on the Orders tab. */
  const [ordersBucketFilter, setOrdersBucketFilter] = useState<OrdersTabBucketFilter>('upcoming');
  const [ordersFetchError, setOrdersFetchError] = useState<string | null>(null);
  
  // Helper to update both state and localStorage
  const updateAcceptedOrderIds = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setAcceptedOrderIds(prev => {
      const newSet = updater(prev);
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        try {
          const idsArray = Array.from(newSet);
          localStorage.setItem(`accepted_meal_orders_${vendorId}`, JSON.stringify(idsArray));
          console.log(`[NutritionistDashboard] Saved ${idsArray.length} accepted order IDs to localStorage:`, idsArray);
        } catch (e) {
          console.warn('Error saving accepted orders to localStorage:', e);
        }
      }
      return newSet;
    });
  }, [vendorId]);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await apiClient.get(`/vendor/${vendorId}/meal-products`);
      if (response && (response as any).success) {
        setProducts((response as any).products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }, [vendorId]);

  const fetchOrders = useCallback(async () => {
    try {
      setOrdersFetchError(null);
      const response = await apiClient.get(`/vendor/${vendorId}/meal-orders`);
      const body = response as { success?: boolean; orders?: unknown[]; error?: string };
      if (body?.success === false) {
        setOrdersFetchError(body.error || 'Could not load meal orders');
        return;
      }
      if (response && body.success !== false) {
        const rawList = body.orders || [];
        const fetchedOrders = rawList.map((raw: Record<string, unknown>) => ({
          ...raw,
          vendor_meal_total: coerceVendorMealListingAmount(raw),
        })) as MealOrder[];
        setOrders(fetchedOrders);
        
        // ✅ Initialize acceptedOrderIds: Merge stored accepted IDs with orders that have progressed
        // This preserves localStorage state (vendor accepted) while also including orders that have prep_started_at
        setAcceptedOrderIds(prev => {
          const newAcceptedIds = new Set(prev); // Preserve stored accepted IDs from localStorage
          const currentOrderIds = new Set(fetchedOrders.map((o: MealOrder) => o.id));
          
          fetchedOrders.forEach((order: MealOrder) => {
            // If order has prep_started_at or status beyond 'confirmed', vendor has accepted/started
            if (order.prep_started_at || 
                order.status === 'preparing' || 
                order.status === 'ready_for_pickup' || 
                order.status === 'picked_up' || 
                order.status === 'on_the_way' || 
                order.status === 'delivered') {
              newAcceptedIds.add(order.id);
            }
          });
          
          // Clean up: Remove accepted IDs for orders that no longer exist or are cancelled/delivered
          // This prevents localStorage from growing indefinitely
          Array.from(newAcceptedIds).forEach(orderId => {
            if (!currentOrderIds.has(orderId)) {
              // Order no longer in the list, remove from accepted set
              newAcceptedIds.delete(orderId);
            } else {
              const order = fetchedOrders.find((o: MealOrder) => o.id === orderId);
              if (order && (order.status === 'cancelled' || order.status === 'delivered')) {
                // Order is completed, remove from accepted set (no longer relevant)
                newAcceptedIds.delete(orderId);
              }
            }
          });
          
          // Persist to localStorage
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`accepted_meal_orders_${vendorId}`, JSON.stringify(Array.from(newAcceptedIds)));
            } catch (e) {
              console.warn('Error saving accepted orders to localStorage:', e);
            }
          }
          
          return newAcceptedIds;
        });
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrdersFetchError(
        error instanceof Error ? error.message : 'Could not load meal orders',
      );
    }
  }, [vendorId]);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      ),
    [orders],
  );

  const { pastOrders, todayOrders, upcomingOrders } = useMemo(() => {
    const past: MealOrder[] = [];
    const today: MealOrder[] = [];
    const upcoming: MealOrder[] = [];
    for (const o of sortedOrders) {
      const b = mealOrderBucket(o);
      if (b === 'past') past.push(o);
      else if (b === 'today') today.push(o);
      else upcoming.push(o);
    }
    return { pastOrders: past, todayOrders: today, upcomingOrders: upcoming };
  }, [sortedOrders]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      // ✅ Load accepted orders from localStorage first
      const stored = getStoredAcceptedOrders();
      if (stored.size > 0) {
        setAcceptedOrderIds(stored);
        console.log(`[NutritionistDashboard] Initialized with ${stored.size} accepted orders from localStorage:`, Array.from(stored));
      }
      await Promise.all([fetchProducts(), fetchOrders()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchProducts, fetchOrders]);

  useEffect(() => {
    if (activeTab !== 'orders') return;
    const id = window.setInterval(() => {
      void fetchOrders();
    }, 60_000);
    return () => clearInterval(id);
  }, [activeTab, fetchOrders]);

  useEffect(() => {
    if (activeTab !== 'orders') return;
    const onVis = () => {
      if (document.visibilityState === 'visible') void fetchOrders();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [activeTab, fetchOrders]);

  /** Customer reschedule/skip/pause on canonical sessions updates DB; refetch meal_orders-backed list. */
  useEffect(() => {
    const unsub = subscribeToMealSubscriptionDeliveryBroadcast(() => {
      if (activeTab === 'orders') void fetchOrders();
    });
    return () => unsub();
  }, [subscribeToMealSubscriptionDeliveryBroadcast, fetchOrders, activeTab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchProducts(), fetchOrders()]);
    setRefreshing(false);
  };

  const handleSaveMealProduct = async ({
    payload,
    editingId,
  }: {
    payload: Record<string, unknown>;
    editingId: string | null;
  }) => {
    try {
      if (editingId) {
        await apiClient.put(`/vendor/${vendorId}/meal-products/${editingId}`, payload);
        toast.success('Meal product updated successfully');
      } else {
        await apiClient.post(`/vendor/${vendorId}/meal-products`, payload);
        toast.success('Meal product created successfully');
      }
      setShowAddProduct(false);
      setEditingProduct(null);
      await fetchProducts();
    } catch (error: unknown) {
      console.error('Error saving product:', error);
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: string }).message)
          : 'Failed to save meal product. Please check all required fields.';
      toast.error(msg);
      throw error;
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    // Use toast promise for confirmation instead of native confirm
    const confirmed = window.confirm('Are you sure you want to delete this product?');
    if (!confirmed) return;
    
    try {
      const res = await apiClient.delete<any>(`/vendor/${vendorId}/meal-products/${productId}`);
      const msg =
        (res && typeof res === 'object' && 'message' in res && String((res as { message?: string }).message)) ||
        (res?.data?.message && String(res.data.message)) ||
        'Product removed';
      toast.success(msg);
      await fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(error?.message || 'Failed to delete product');
    }
  };

  const requestStartPreparing = (order: MealOrder) => {
    const scheduling = vendorMealPrepSchedulingFromOrder(order as Record<string, unknown>);
    if (!confirmVendorEarlyMealPrep(scheduling)) return;
    void handleUpdateOrderStatus(order.id, 'preparing');
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      // ✅ CRITICAL: Track acceptance BEFORE API call and persist to localStorage
      if (status === 'accepted') {
        updateAcceptedOrderIds(prev => new Set(prev).add(orderId));
      }
      
      const res = (await apiClient.put(`/vendor/${vendorId}/meal-orders/${orderId}/status`, {
        status,
      })) as { dispatch?: { ok?: boolean; idempotent?: boolean } };

      // ✅ BUSINESS LOGIC: Track vendor acceptance locally
      if (status === 'accepted') {
        toast.success('Order accepted successfully!');
      } else if (status === 'preparing') {
        // When vendor starts preparing, they've implicitly accepted
        updateAcceptedOrderIds(prev => new Set(prev).add(orderId));
        toast.success('Preparation started');
      } else if (status === 'ready_for_pickup') {
        if (res?.dispatch?.ok) {
          toast.success(
            res.dispatch.idempotent
              ? 'Ready for pickup — delivery partner already scheduled'
              : 'Ready for pickup — delivery partner scheduled'
          );
        } else {
          toast.success('Marked ready for pickup');
        }
      } else {
        toast.success('Order status updated');
      }
      
      // Refresh orders (this will merge with localStorage, preserving the accepted ID)
      await fetchOrders();
    } catch (error: any) {
      console.error('Error updating order status:', error);
      toast.error(error?.message || 'Failed to update status');
      // On error, remove from acceptedOrderIds if it was added
      if (status === 'accepted') {
        updateAcceptedOrderIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      }
    }
  };

  const handleNotifyLogistics = async (orderId: string) => {
    try {
      await apiClient.post(`/meal/orders/${orderId}/notify-logistics`);
      toast.success('Logistics notified');
      await fetchOrders();
    } catch (error: any) {
      console.error('Error notifying logistics:', error);
      toast.error(error?.message || 'Failed to notify logistics');
    }
  };

  const openEditModal = (product: MealProduct) => {
    setEditingProduct(product);
    setShowAddProduct(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'confirmed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'accepted': return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'preparing': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'paused': return 'bg-violet-50 text-violet-800 border-violet-200';
      case 'ready':
      case 'ready_for_pickup': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'dispatched':
      case 'picked_up':
      case 'on_the_way': return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'failed': return 'bg-red-50 text-red-800 border-red-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const renderMealOrderCard = (order: MealOrder) => {
    const badgeCanon: MealDeliveryEffective = vendorMealEffectiveStatus(order);
    const prepScheduling = vendorMealPrepSchedulingFromOrder(order as Record<string, unknown>);
    const isParentSub = Boolean(order.subscription_vendor_parent_booking);
    const isSessionSub = isSubscriptionSessionRow(order);
    const isPidgeLogistics = String(order.logistics_type || '').toLowerCase() === 'pidge';
    const vendorReadyStatuses = ['confirmed', 'accepted'];
    const sessionReadyForPrep =
      (isSessionSub || isParentSub) &&
      vendorReadyStatuses.includes(String(order.status || '').toLowerCase()) &&
      !order.prep_started_at;

    return (
      <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                {Icons.package}
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">{order.order_number || `Order #${order.id.slice(0, 8)}`}</h3>
                {(isSubscriptionSessionRow(order) || order.subscription_vendor_parent_booking) ? (
                  <p className="text-xs font-medium text-indigo-700 mt-0.5">{subscriptionSessionLabel(order)}</p>
                ) : null}
                <p className="text-sm text-slate-500 flex items-center gap-1">
                  {Icons.user}
                  {order.customer_name || 'Customer'}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(badgeCanon)}`}>
              {formatVendorMealDeliveryBadge(badgeCanon)}
            </span>
          </div>
        </div>

        <div className="p-4">
          {order.subscription_vendor_parent_booking && (
            <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-slate-800">
              <p className="text-sm font-semibold">
                {subscriptionParentPlanTitle(order)}
                {order.subscription_booking_session_count != null && order.subscription_booking_session_count > 0
                  ? ` · ${order.subscription_booking_session_count} sessions`
                  : null}
                {order.subscription_booking_delivery_type ? (
                  <span className="font-normal text-slate-600">
                    {' '}
                    · Delivery: {String(order.subscription_booking_delivery_type)}
                  </span>
                ) : null}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1">{Icons.phone} {order.customer_phone || 'N/A'}</span>
              <span className="flex items-center gap-1" title="Customer delivery commitment">
                {Icons.clock} {formatMealOrderCustomerDelivery(order as Record<string, unknown>)}
              </span>
            </div>
            <div className="text-right">
              {order.subscription_vendor_parent_booking ? (
                <>
                  <span className="text-lg font-semibold text-slate-800">
                    ₹{vendorMealListingRupee(order).toFixed(2)}
                  </span>
                  <p className="text-xs text-slate-500">Meal (this session)</p>
                </>
              ) : isSubscriptionSessionRow(order) ? (
                <>
                  <span className="text-lg font-semibold text-slate-800">
                    ₹{vendorMealListingRupee(order).toFixed(2)}
                  </span>
                  <p className="text-xs text-slate-500">Meal (this session)</p>
                </>
              ) : (
                <>
                  <span className="text-lg font-semibold text-slate-800">
                    ₹{vendorMealListingRupee(order).toFixed(2)}
                  </span>
                  <p className="text-xs text-slate-500">Meal total (your listing)</p>
                </>
              )}
            </div>
          </div>

          <VendorMealPrepScheduleInfo
            order={order as Record<string, unknown>}
            showAfterPrep={Boolean(order.prep_started_at) || order.status === 'preparing'}
            className="mb-4"
          />

          <div className="flex flex-wrap gap-2">
            {isPidgeLogistics &&
              ['preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'].includes(badgeCanon) && (
                <p className="text-xs text-slate-600 w-full rounded-lg bg-sky-50 border border-sky-100 px-3 py-2">
                  Pidge delivery: tap &quot;Ready for pickup&quot; when the meal is packed — we schedule the rider then.
                  Pickup and delivery stages update automatically from Pidge — no need to notify logistics or mark
                  delivered manually.
                </p>
              )}
            {order.status === 'paused' && (
              <p className="text-sm text-violet-800 w-full py-2 px-3 rounded-lg bg-violet-50 border border-violet-200">
                Customer paused this subscription — resume on their app before preparing or dispatching.
              </p>
            )}
            {order.status === 'pending' && (
              <>
                {isSessionSub ? (
                  <button
                    type="button"
                    disabled
                    title="Accept the subscription booking on the parent row first. Sessions update automatically."
                    className="flex-1 py-2 rounded-lg bg-slate-200 text-slate-500 cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    {Icons.utensils}
                    <span className="text-sm">Start Preparing</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleUpdateOrderStatus(order.id, 'accepted')}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                    >
                      {Icons.check}
                      <span className="text-sm">Accept</span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirmMealOrderCancel(order)) handleUpdateOrderStatus(order.id, 'cancelled');
                      }}
                      className="py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                    >
                      {Icons.x}
                      <span className="text-sm ml-1">Cancel</span>
                    </button>
                  </>
                )}
              </>
            )}

            {sessionReadyForPrep && (
              <button
                type="button"
                title={
                  prepScheduling.isEarlyPrep
                    ? 'Earlier than suggested — you can still start preparing'
                    : undefined
                }
                onClick={() => requestStartPreparing(order)}
                className="flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {Icons.utensils}
                <span className="text-sm">Start Preparing</span>
              </button>
            )}

            {(() => {
              const shouldShowAccept =
                order.status === 'confirmed' &&
                !order.prep_started_at &&
                !acceptedOrderIds.has(order.id) &&
                !isParentSub &&
                !isSessionSub;
              return shouldShowAccept;
            })() && (
              <>
                <button
                  onClick={() => handleUpdateOrderStatus(order.id, 'accepted')}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  {Icons.check}
                  <span className="text-sm">Accept</span>
                </button>
                <button
                  type="button"
                  title={
                    prepScheduling.isEarlyPrep
                      ? 'Earlier than suggested — you can still start preparing'
                      : undefined
                  }
                  onClick={() => requestStartPreparing(order)}
                  className="flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {Icons.utensils}
                  <span className="text-sm">Start Preparing</span>
                </button>
                {!vendorSubscriptionCancelHidden(order) && (
                  <button
                    onClick={() => {
                      if (confirmMealOrderCancel(order)) {
                        handleUpdateOrderStatus(order.id, 'cancelled');
                      }
                    }}
                    className="py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                  >
                    {Icons.x}
                    <span className="text-sm ml-1">Cancel</span>
                  </button>
                )}
              </>
            )}

            {order.status === 'confirmed' &&
              !order.prep_started_at &&
              acceptedOrderIds.has(order.id) &&
              !isParentSub &&
              !isSessionSub && (
                <>
                  <button
                    type="button"
                    title={
                      prepScheduling.isEarlyPrep
                        ? 'Earlier than suggested — you can still start preparing'
                        : undefined
                    }
                    onClick={() => requestStartPreparing(order)}
                    className="flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {Icons.utensils}
                    <span className="text-sm">Start Preparing</span>
                  </button>
                  {!vendorSubscriptionCancelHidden(order) && (
                    <button
                      onClick={() => {
                        if (confirmMealOrderCancel(order)) {
                          handleUpdateOrderStatus(order.id, 'cancelled');
                        }
                      }}
                      className="py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                    >
                      {Icons.x}
                      <span className="text-sm ml-1">Cancel</span>
                    </button>
                  )}
                </>
              )}

            {order.status === 'preparing' && (
              <button
                onClick={() => handleUpdateOrderStatus(order.id, 'ready_for_pickup')}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                {Icons.package}
                <span className="text-sm">Ready for Pickup</span>
              </button>
            )}
            {order.status === 'ready_for_pickup' && !isPidgeLogistics && (
              <>
                <button
                  onClick={() => handleNotifyLogistics(order.id)}
                  className="flex-1 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  {Icons.truck}
                  <span className="text-sm">Notify Logistics</span>
                </button>
                <button
                  onClick={() => handleUpdateOrderStatus(order.id, 'picked_up')}
                  className="py-2 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <span className="text-sm">Dispatched</span>
                </button>
              </>
            )}
            {order.status === 'ready_for_pickup' && isPidgeLogistics && (
              <p className="text-sm text-slate-600 w-full py-2 px-3 rounded-lg bg-slate-50 border border-slate-200">
                Waiting for rider pickup — status updates when Pidge confirms pickup and delivery.
              </p>
            )}
            {(order.status === 'picked_up' || order.status === 'on_the_way' || order.status === 'dispatched') &&
              !isPidgeLogistics && (
              <button
                onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                {Icons.check}
                <span className="text-sm">Mark Delivered</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading your kitchen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Frame UI: Orange header (vet service dashboard style) */}
      <header className="shrink-0 bg-gradient-to-r from-[#FF8C42] to-orange-500 border-b border-orange-200 shadow-md z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                title="Back to Dashboard"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                {Icons.leaf}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">{vendorName || 'Nutritionist Kitchen'}</h1>
                <p className="text-sm text-white/90">Fresh Pet Meals</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => router.push('/training/progress')}
                className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors text-sm font-medium"
                title="Pet diet / program enrollment progress"
              >
                {Icons.clipboard}
                <span className="hidden sm:inline">Program progress</span>
                <span className="sm:hidden">Progress</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
              >
                <span className={refreshing ? 'animate-spin' : ''}>{Icons.refresh}</span>
                <span className="text-sm font-medium">Refresh</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { id: 'products', label: 'Meal Products', icon: Icons.utensils, count: products.length },
              {
                id: 'orders',
                label: 'Orders',
                icon: Icons.package,
                count: orders.filter(
                  (o) => !isTerminalMealDeliveryState(vendorMealEffectiveStatus(o)),
                ).length,
              },
              { id: 'analytics', label: 'Insights', icon: Icons.fire, count: 0 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                    ? 'bg-white text-orange-600 shadow-md'
                    : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${activeTab === tab.id ? 'bg-orange-100' : 'bg-white/20'
                    }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content — scrolls under fixed header (works inside shells that use overflow-hidden). */}
      <main className="max-w-7xl mx-auto w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-6 overscroll-contain">
        <MealKitchenAvailabilityCard vendorId={vendorId} />

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-4 mt-4">
            {/* Add Product Button */}
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setShowAddProduct(true);
                }}
              className="w-full py-4 border-2 border-dashed border-emerald-300 rounded-2xl text-emerald-600 font-medium hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
            >
              {Icons.plus}
              <span>Add New Meal Product</span>
            </button>

            {products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  {Icons.utensils}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Meal Products Yet</h3>
                <p className="text-slate-500">Start adding your delicious pet meal recipes!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => {
                  const metadata = product.metadata ? (typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata) : {};
                  const mealImg = (metadata as { mealImageUrl?: string }).mealImageUrl;
                  const packWeightLabel = formatPackWeightLabel(
                    resolvePackWeightGramsFromMetadata(metadata as Record<string, unknown>),
                  );
                  return (
                    <div key={product.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="h-32 bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center overflow-hidden">
                        {mealImg ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mealImg} alt="" className="w-full h-full object-cover" />
                        ) : (
                        <div className="w-16 h-16 bg-white/80 rounded-xl flex items-center justify-center text-emerald-600">
                          {Icons.utensils}
                        </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <h3 className="font-semibold text-slate-800">{product.name}</h3>
                          <div className="text-right shrink-0">
                            <span className="text-lg font-bold text-emerald-600">₹{product.price}</span>
                            {packWeightLabel ? (
                              <p className="text-xs font-medium text-slate-500 mt-0.5">{packWeightLabel}</p>
                            ) : null}
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 mb-3 line-clamp-2">{product.description}</p>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {metadata.dietType && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">
                              {metadata.dietType}
                            </span>
                          )}
                          {(metadata.petTypes || []).map((pt: string) => (
                            <span key={pt} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                              {pt}
                            </span>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(product)}
                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            {Icons.edit}
                            <span className="text-sm">Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          >
                            {Icons.trash}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {ordersFetchError ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-800">
                {ordersFetchError}
              </div>
            ) : null}
            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  {Icons.package}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Orders Yet</h3>
                <p className="text-slate-500">Orders will appear here when customers place them</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setOrdersBucketFilter('past')}
                    aria-pressed={ordersBucketFilter === 'past'}
                    className={`rounded-2xl border p-4 text-left shadow-sm transition ring-offset-2 ring-offset-orange-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                      ordersBucketFilter === 'past'
                        ? 'bg-white border-orange-400 ring-2 ring-orange-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Previous / completed</p>
                    <p className="mt-1 text-2xl font-bold text-slate-800">{pastOrders.length}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrdersBucketFilter('today')}
                    aria-pressed={ordersBucketFilter === 'today'}
                    className={`rounded-2xl border p-4 text-left shadow-sm transition ring-offset-2 ring-offset-orange-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                      ordersBucketFilter === 'today'
                        ? 'bg-white border-orange-500 ring-2 ring-orange-400'
                        : 'bg-white border-orange-100 ring-1 ring-orange-100 hover:border-orange-200'
                    }`}
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-orange-800/90">Today &amp; yesterday</p>
                    <p className="mt-1 text-2xl font-bold text-orange-700">{todayOrders.length}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrdersBucketFilter('upcoming')}
                    aria-pressed={ordersBucketFilter === 'upcoming'}
                    className={`rounded-2xl border p-4 text-left shadow-sm transition ring-offset-2 ring-offset-orange-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                      ordersBucketFilter === 'upcoming'
                        ? 'bg-white border-orange-400 ring-2 ring-orange-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Upcoming</p>
                    <p className="mt-1 text-2xl font-bold text-slate-800">{upcomingOrders.length}</p>
                  </button>
                </div>
                {(() => {
                  const section =
                    ordersBucketFilter === 'past'
                      ? {
                          title: 'Previous / completed',
                          list: pastOrders,
                            empty: 'No delivered, cancelled, or failed orders yet.',
                        }
                      : ordersBucketFilter === 'today'
                        ? {
                            title: 'Today & yesterday',
                            list: todayOrders,
                            empty: 'No active orders for today or yesterday (delivered/cancelled appear under Previous / completed).',
                          }
                        : {
                            title: 'Upcoming orders',
                            list: upcomingOrders,
                            empty: 'No future scheduled drops.',
                          };
                  return (
                    <div className="space-y-3 pt-2">
                      <h3 className="text-sm font-semibold text-slate-800 px-1">{section.title}</h3>
                      {section.list.length === 0 ? (
                        <p className="text-sm text-slate-400 px-1 py-1">{section.empty}</p>
                      ) : (
                        section.list.map((order) => renderMealOrderCard(order))
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                  {Icons.package}
                </div>
                <span className="text-slate-600">Total Orders</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">{orders.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  {Icons.utensils}
                </div>
                <span className="text-slate-600">Menu Items</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">{products.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                  {Icons.dollarSign}
                </div>
                <span className="text-slate-600">Meal listing total</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">
                ₹{orders.reduce((sum, o) => sum + vendorMealListingRupee(o), 0)}
              </p>
            </div>
          </div>
        )}
      </main>

      <MealProductFormModal
        open={showAddProduct}
        onClose={() => {
          setShowAddProduct(false);
          setEditingProduct(null);
        }}
        vendorId={vendorId}
        editingProduct={editingProduct}
        onSave={handleSaveMealProduct}
      />
    </div>
  );
}
