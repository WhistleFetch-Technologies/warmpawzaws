/**
 * Meal in-app + push notifications (customer, vendor, subscriptions, Pidge rider stages).
 * Idempotent via notifications.data.dedupeKey.
 */

import { query, select } from '../database/rds-connection';
import { sendEventNotification } from '../aws/aws-sns-notification-service';
import type { NotificationEventType } from '../aws/constatns/interface';

export type MealNotifyRecipientType = 'customer' | 'vendor';

/** Customer delivery-stage events (kitchen + rider). */
export const MEAL_CUSTOMER_DELIVERY_STAGES = [
  'meal_order_confirmed',
  'meal_order_preparing',
  'meal_order_ready',
  'meal_rider_assigned',
  'meal_order_pickup',
  'meal_rider_on_the_way',
  'meal_rider_nearby',
  'meal_order_delivered',
  'meal_order_cancelled',
  'meal_logistics_cancelled',
  'meal_refund_review_initiated',
  'meal_refund_approved',
  'meal_refund_completed',
] as const;

/** Vendor operational events. */
export const MEAL_VENDOR_EVENTS = [
  'vendor_meal_order_received',
  'vendor_meal_order_cancelled',
  'vendor_meal_rider_assigned',
  'vendor_meal_rider_picked_up',
  'vendor_meal_order_delivered',
  'vendor_meal_delivery_failed',
  'vendor_meal_dispatch_failed',
  'vendor_meal_subscription_due',
  'vendor_meal_subscription_paused',
  'vendor_meal_subscription_resumed',
  'vendor_meal_subscription_cancelled',
  'vendor_meal_subscription_active',
] as const;

/** Customer subscription lifecycle events. */
export const MEAL_CUSTOMER_SUBSCRIPTION_EVENTS = [
  'meal_subscription_paused',
  'meal_subscription_resumed',
  'meal_subscription_cancelled',
  'meal_subscription_delivery_due',
] as const;

export const MEAL_NOTIFY_EVENT_TYPES = [
  ...MEAL_CUSTOMER_DELIVERY_STAGES,
  ...MEAL_VENDOR_EVENTS,
  ...MEAL_CUSTOMER_SUBSCRIPTION_EVENTS,
] as const;

export type MealNotifyEventType = (typeof MEAL_NOTIFY_EVENT_TYPES)[number];
export type MealDeliveryNotifyStage = (typeof MEAL_CUSTOMER_DELIVERY_STAGES)[number];

export function isMealNotifyEventType(v: string): v is MealNotifyEventType {
  return (MEAL_NOTIFY_EVENT_TYPES as readonly string[]).includes(v);
}

export function isMealDeliveryNotifyStage(v: string): v is MealDeliveryNotifyStage {
  return (MEAL_CUSTOMER_DELIVERY_STAGES as readonly string[]).includes(v);
}

export function mealKitchenNotifyStageForStatus(status: string): MealDeliveryNotifyStage | null {
  switch (status) {
    case 'confirmed':
      return 'meal_order_confirmed';
    case 'preparing':
      return 'meal_order_preparing';
    case 'ready_for_pickup':
      return 'meal_order_ready';
    default:
      return null;
  }
}

export function mealRiderNotifyStageForLogistics(
  normalized: string,
  deliveryTrackingStatus: string,
): MealDeliveryNotifyStage | null {
  const n = normalized.trim().toLowerCase();
  const dt = deliveryTrackingStatus.trim().toLowerCase();

  if (n === 'delivered' || dt === 'delivered') return 'meal_order_delivered';
  if (n === 'nearby' || dt === 'nearby') return 'meal_rider_nearby';
  if (n === 'picked_up' || dt === 'picked_up') return 'meal_order_pickup';
  if (n === 'in_transit' || n === 'out_for_delivery' || dt === 'on_the_way') {
    return 'meal_rider_on_the_way';
  }
  if (
    n === 'pending_assignment' ||
    n === 'assigned' ||
    n === 'awb_generated' ||
    n === 'pickup_scheduled' ||
    n === 'pending' ||
    dt === 'heading_to_pickup'
  ) {
    return 'meal_rider_assigned';
  }
  if (n === 'cancelled' || n === 'failed' || n === 'lost' || n === 'damaged' || dt === 'failed') {
    return 'meal_logistics_cancelled';
  }
  return null;
}

export function mealVendorRiderNotifyStageForLogistics(
  normalized: string,
  deliveryTrackingStatus: string,
): Extract<
  MealNotifyEventType,
  'vendor_meal_rider_assigned' | 'vendor_meal_rider_picked_up' | 'vendor_meal_order_delivered' | 'vendor_meal_delivery_failed'
> | null {
  const n = normalized.trim().toLowerCase();
  const dt = deliveryTrackingStatus.trim().toLowerCase();

  if (n === 'cancelled' || n === 'failed' || dt === 'failed') return 'vendor_meal_delivery_failed';
  if (n === 'delivered' || dt === 'delivered') return 'vendor_meal_order_delivered';
  if (n === 'picked_up' || dt === 'picked_up') return 'vendor_meal_rider_picked_up';
  if (
    n === 'pending_assignment' ||
    n === 'assigned' ||
    n === 'awb_generated' ||
    n === 'pickup_scheduled' ||
    n === 'pending' ||
    n === 'in_transit' ||
    n === 'out_for_delivery' ||
    n === 'nearby' ||
    dt === 'heading_to_pickup' ||
    dt === 'on_the_way' ||
    dt === 'nearby'
  ) {
    return 'vendor_meal_rider_assigned';
  }
  return null;
}

export function buildMealDedupeKey(
  scopeId: string,
  eventType: string,
  recipientType: MealNotifyRecipientType,
): string {
  return `meal:${scopeId}:${eventType}:${recipientType}`;
}

export type NotifyMealEventParams = {
  recipientId: string;
  recipientType: MealNotifyRecipientType;
  eventType: MealNotifyEventType;
  relatedId?: string;
  dedupeScopeId?: string;
  orderId?: string;
  orderNumber?: string;
  subscriptionId?: string;
  vendorName?: string;
  customerName?: string;
  riderName?: string;
  reason?: string;
  customerMessage?: string;
  deliveryTrackingId?: string;
  pidgeOrderId?: string;
  logisticsStatus?: string;
  mealPlanName?: string;
  refundAmount?: string;
  action?: string;
};

export async function notifyMealEvent(
  params: NotifyMealEventParams,
): Promise<{ sent: boolean; skipped?: string }> {
  const recipientId = String(params.recipientId || '').trim();
  if (!recipientId) return { sent: false, skipped: 'missing_recipient' };

  const scopeId =
    params.dedupeScopeId?.trim() ||
    params.orderId?.trim() ||
    params.subscriptionId?.trim() ||
    params.relatedId?.trim() ||
    '';
  if (!scopeId) return { sent: false, skipped: 'missing_dedupe_scope' };

  const dedupeKey = buildMealDedupeKey(scopeId, params.eventType, params.recipientType);

  try {
    const existing = await query(
      `SELECT id FROM notifications
       WHERE recipient_id = $1 AND recipient_type = $2
         AND notification_type = $3
         AND (data->>'dedupeKey') = $4
       LIMIT 1`,
      [recipientId, params.recipientType, params.eventType, dedupeKey],
    );
    if (existing.rows?.length) return { sent: false, skipped: 'dedupe' };
  } catch (e) {
    console.warn('[meal-notify] dedupe check failed:', (e as Error).message);
  }

  const defaultAction =
    params.recipientType === 'vendor'
      ? params.orderId
        ? 'open_meal_order'
        : params.subscriptionId
          ? 'open_meal_subscription'
          : undefined
      : params.orderId
        ? 'track_meal'
        : params.subscriptionId
          ? 'open_meal_subscription'
          : undefined;

  await sendEventNotification({
    eventType: params.eventType as NotificationEventType,
    recipientId,
    recipientType: params.recipientType,
    relatedId: params.relatedId || params.orderId || params.subscriptionId,
    data: {
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      subscriptionId: params.subscriptionId,
      orderType: 'meal',
      vendorName: params.vendorName,
      customerName: params.customerName,
      riderName: params.riderName,
      reason: params.reason,
      customerMessage: params.customerMessage,
      mealPlanName: params.mealPlanName,
      deliveryTrackingId: params.deliveryTrackingId,
      pidgeOrderId: params.pidgeOrderId,
      logisticsStatus: params.logisticsStatus,
      refundAmount: params.refundAmount,
      action: params.action || defaultAction,
      dedupeKey,
      eventType: params.eventType,
    },
  });

  return { sent: true };
}

/** @deprecated use notifyMealEvent — kept for existing customer kitchen/rider call sites */
export type NotifyMealDeliveryParams = {
  customerId: string;
  orderId: string;
  eventType: MealDeliveryNotifyStage;
  vendorName?: string;
  orderNumber?: string;
  riderName?: string;
  deliveryTrackingId?: string;
  pidgeOrderId?: string;
  logisticsStatus?: string;
};

export async function notifyMealDeliveryStage(
  params: NotifyMealDeliveryParams,
): Promise<{ sent: boolean; skipped?: string }> {
  return notifyMealEvent({
    recipientId: params.customerId,
    recipientType: 'customer',
    eventType: params.eventType,
    relatedId: params.orderId,
    dedupeScopeId: params.orderId,
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    vendorName: params.vendorName,
    riderName: params.riderName,
    deliveryTrackingId: params.deliveryTrackingId,
    pidgeOrderId: params.pidgeOrderId,
    logisticsStatus: params.logisticsStatus,
  });
}

type MealOrderContext = {
  orderId: string;
  orderNumber: string;
  customerId: string;
  vendorId: string;
  customerName: string;
  vendorName: string;
  mealPlanName?: string;
  subscriptionId?: string;
};

async function loadMealOrderContext(orderId: string): Promise<MealOrderContext | null> {
  try {
    const r = await query(
      `SELECT mo.id, mo.order_number, mo.customer_id, mo.vendor_id, mo.subscription_id,
              c.full_name AS customer_name, c.name AS customer_name_alt,
              v.business_name AS vendor_name,
              COALESCE(mp.name, mp.plan_name) AS meal_plan_name
       FROM meal_orders mo
       LEFT JOIN customers c ON c.id = mo.customer_id
       LEFT JOIN vendors v ON v.id = mo.vendor_id
       LEFT JOIN meal_plans mp ON mp.id = mo.meal_plan_id
       WHERE mo.id = $1
       LIMIT 1`,
      [orderId],
    );
    const row = r.rows?.[0] as Record<string, unknown> | undefined;
    if (!row?.customer_id || !row?.vendor_id) return null;
    return {
      orderId: String(row.id),
      orderNumber: String(row.order_number || ''),
      customerId: String(row.customer_id),
      vendorId: String(row.vendor_id),
      customerName: String(row.customer_name || row.customer_name_alt || 'Customer'),
      vendorName: String(row.vendor_name || 'Your kitchen'),
      mealPlanName: row.meal_plan_name ? String(row.meal_plan_name) : undefined,
      subscriptionId: row.subscription_id ? String(row.subscription_id) : undefined,
    };
  } catch (e) {
    console.warn('[meal-notify] loadMealOrderContext failed:', (e as Error).message);
    return null;
  }
}

type MealSubscriptionContext = {
  subscriptionId: string;
  customerId: string;
  vendorId: string;
  customerName: string;
  vendorName: string;
  mealPlanName?: string;
};

async function loadMealSubscriptionContext(
  subscriptionId: string,
): Promise<MealSubscriptionContext | null> {
  try {
    const r = await query(
      `SELECT ms.id, ms.customer_id, ms.vendor_id,
              c.full_name AS customer_name, c.name AS customer_name_alt,
              v.business_name AS vendor_name,
              COALESCE(mp.name, mp.plan_name, ms.meal_plan_name) AS meal_plan_name
       FROM meal_subscriptions ms
       LEFT JOIN customers c ON c.id = ms.customer_id
       LEFT JOIN vendors v ON v.id = ms.vendor_id
       LEFT JOIN meal_plans mp ON mp.id = ms.meal_plan_id
       WHERE ms.id = $1
       LIMIT 1`,
      [subscriptionId],
    );
    const row = r.rows?.[0] as Record<string, unknown> | undefined;
    if (!row?.customer_id || !row?.vendor_id) return null;
    return {
      subscriptionId: String(row.id),
      customerId: String(row.customer_id),
      vendorId: String(row.vendor_id),
      customerName: String(row.customer_name || row.customer_name_alt || 'Customer'),
      vendorName: String(row.vendor_name || 'Your kitchen'),
      mealPlanName: row.meal_plan_name ? String(row.meal_plan_name) : undefined,
    };
  } catch (e) {
    console.warn('[meal-notify] loadMealSubscriptionContext failed:', (e as Error).message);
    return null;
  }
}

export async function notifyMealOrderPaid(orderId: string): Promise<void> {
  const ctx = await loadMealOrderContext(orderId);
  if (!ctx) return;
  await Promise.all([
    notifyMealEvent({
      recipientId: ctx.vendorId,
      recipientType: 'vendor',
      eventType: 'vendor_meal_order_received',
      relatedId: ctx.orderId,
      dedupeScopeId: ctx.orderId,
      orderId: ctx.orderId,
      orderNumber: ctx.orderNumber,
      customerName: ctx.customerName,
      vendorName: ctx.vendorName,
      mealPlanName: ctx.mealPlanName,
    }),
    notifyMealEvent({
      recipientId: ctx.customerId,
      recipientType: 'customer',
      eventType: 'meal_order_confirmed',
      relatedId: ctx.orderId,
      dedupeScopeId: ctx.orderId,
      orderId: ctx.orderId,
      orderNumber: ctx.orderNumber,
      vendorName: ctx.vendorName,
    }),
  ]).catch((e) => console.warn('[meal-notify] notifyMealOrderPaid failed:', e));
}

export async function notifyMealOrderCancelledByVendor(
  orderId: string,
  reason?: string,
): Promise<void> {
  const ctx = await loadMealOrderContext(orderId);
  if (!ctx) return;
  await notifyMealEvent({
    recipientId: ctx.customerId,
    recipientType: 'customer',
    eventType: 'meal_order_cancelled',
    relatedId: ctx.orderId,
    dedupeScopeId: ctx.orderId,
    orderId: ctx.orderId,
    orderNumber: ctx.orderNumber,
    vendorName: ctx.vendorName,
    reason: reason || 'Your meal order was cancelled by the kitchen.',
  }).catch((e) => console.warn('[meal-notify] vendor cancel notify failed:', e));
}

export async function notifyMealOrderCancelledByCustomer(
  orderId: string,
  reason?: string,
): Promise<void> {
  const ctx = await loadMealOrderContext(orderId);
  if (!ctx) return;
  await notifyMealEvent({
    recipientId: ctx.vendorId,
    recipientType: 'vendor',
    eventType: 'vendor_meal_order_cancelled',
    relatedId: ctx.orderId,
    dedupeScopeId: ctx.orderId,
    orderId: ctx.orderId,
    orderNumber: ctx.orderNumber,
    customerName: ctx.customerName,
    reason: reason || 'Customer cancelled the meal order.',
  }).catch((e) => console.warn('[meal-notify] customer cancel notify failed:', e));
}

export async function notifyVendorMealDispatchFailed(
  orderId: string,
  errorMessage: string,
): Promise<void> {
  const ctx = await loadMealOrderContext(orderId);
  if (!ctx) return;
  await notifyMealEvent({
    recipientId: ctx.vendorId,
    recipientType: 'vendor',
    eventType: 'vendor_meal_dispatch_failed',
    relatedId: ctx.orderId,
    dedupeScopeId: `${ctx.orderId}:dispatch`,
    orderId: ctx.orderId,
    orderNumber: ctx.orderNumber,
    reason: errorMessage,
  }).catch((e) => console.warn('[meal-notify] dispatch failed notify:', e));
}

export async function notifyMealSubscriptionLifecycle(
  subscriptionId: string,
  action: 'paused' | 'resumed' | 'cancelled',
  reason?: string,
): Promise<void> {
  const ctx = await loadMealSubscriptionContext(subscriptionId);
  if (!ctx) return;

  const customerEvent =
    action === 'paused'
      ? 'meal_subscription_paused'
      : action === 'resumed'
        ? 'meal_subscription_resumed'
        : 'meal_subscription_cancelled';
  const vendorEvent =
    action === 'paused'
      ? 'vendor_meal_subscription_paused'
      : action === 'resumed'
        ? 'vendor_meal_subscription_resumed'
        : 'vendor_meal_subscription_cancelled';

  await Promise.all([
    notifyMealEvent({
      recipientId: ctx.customerId,
      recipientType: 'customer',
      eventType: customerEvent,
      relatedId: ctx.subscriptionId,
      dedupeScopeId: ctx.subscriptionId,
      subscriptionId: ctx.subscriptionId,
      vendorName: ctx.vendorName,
      mealPlanName: ctx.mealPlanName,
      reason,
    }),
    notifyMealEvent({
      recipientId: ctx.vendorId,
      recipientType: 'vendor',
      eventType: vendorEvent,
      relatedId: ctx.subscriptionId,
      dedupeScopeId: ctx.subscriptionId,
      subscriptionId: ctx.subscriptionId,
      customerName: ctx.customerName,
      mealPlanName: ctx.mealPlanName,
      reason,
    }),
  ]).catch((e) => console.warn('[meal-notify] subscription lifecycle failed:', e));
}

export async function notifyVendorMealSubscriptionActive(subscriptionId: string): Promise<void> {
  const ctx = await loadMealSubscriptionContext(subscriptionId);
  if (!ctx) return;
  await notifyMealEvent({
    recipientId: ctx.vendorId,
    recipientType: 'vendor',
    eventType: 'vendor_meal_subscription_active',
    relatedId: ctx.subscriptionId,
    dedupeScopeId: ctx.subscriptionId,
    subscriptionId: ctx.subscriptionId,
    customerName: ctx.customerName,
    mealPlanName: ctx.mealPlanName,
  }).catch((e) => console.warn('[meal-notify] subscription active failed:', e));
}

export async function notifyVendorMealSubscriptionDue(params: {
  vendorId: string;
  subscriptionId: string;
  customerName: string;
  mealPlanName: string;
  deliveryDate?: string;
  orderId?: string;
}): Promise<void> {
  await notifyMealEvent({
    recipientId: params.vendorId,
    recipientType: 'vendor',
    eventType: 'vendor_meal_subscription_due',
    relatedId: params.orderId || params.subscriptionId,
    dedupeScopeId: `${params.subscriptionId}:${params.deliveryDate || 'today'}`,
    subscriptionId: params.subscriptionId,
    orderId: params.orderId,
    customerName: params.customerName,
    mealPlanName: params.mealPlanName,
  }).catch((e) => console.warn('[meal-notify] subscription due failed:', e));
}
