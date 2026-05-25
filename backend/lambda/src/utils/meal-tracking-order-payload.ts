/**
 * Normalize meal order rows for GET /customer/tracking/:orderId (customer track-order UI).
 */
import {
  resolveCustomerMealPlanOrderDisplayTotals,
  safeMoney,
} from './meal-order-pricing';

export type MealTrackingOrderSource = 'meal_orders' | 'orders';

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function formatMealDeliveryAddressForDisplay(
  order: Record<string, unknown>,
  orderSource: MealTrackingOrderSource
): string {
  const raw = order.delivery_address ?? order.shipping_address;
  if (raw == null || raw === '') {
    if (orderSource === 'orders') {
      return [
        order.shipping_address,
        order.shipping_city,
        order.shipping_state,
        order.shipping_pincode,
      ]
        .filter((x) => typeof x === 'string' && x.trim())
        .join(', ');
    }
    return '';
  }

  if (typeof raw === 'string') {
    const parsed = parseJsonObject(raw);
    if (parsed) return formatAddressObject(parsed);
    return raw.trim();
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return formatAddressObject(raw as Record<string, unknown>);
  }

  return '';
}

function formatAddressObject(a: Record<string, unknown>): string {
  const direct = a.address ?? a.full_address ?? a.fullAddress;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const parts = [
    a.address_line1,
    a.addressLine1,
    a.line1,
    a.address_line2,
    a.addressLine2,
    a.line2,
    a.landmark,
    a.city,
    a.state,
    a.pincode,
    a.postal_code,
    a.postalCode,
  ].filter((x) => typeof x === 'string' && x.trim()) as string[];

  return parts.join(', ');
}

export function buildCustomerMealTrackingOrderPayload(input: {
  order: Record<string, unknown>;
  orderSource: MealTrackingOrderSource;
  displayStatus: string;
  mealDisplayTotals?: { subtotal: number; total: number } | null;
  deliveryTracking?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const { order, orderSource, displayStatus, mealDisplayTotals, deliveryTracking } = input;

  let subtotal = 0;
  let deliveryFee = 0;
  let platformFee = 0;
  let totalAmount = 0;

  if (orderSource === 'meal_orders') {
    const totals =
      mealDisplayTotals ??
      resolveCustomerMealPlanOrderDisplayTotals(order, null);
    subtotal = totals.subtotal;
    totalAmount = totals.total;
    deliveryFee = safeMoney(order.delivery_fee);
    platformFee = safeMoney(order.platform_fee);
    if (deliveryFee === 0 && totalAmount > subtotal) {
      deliveryFee = Math.max(0, totalAmount - subtotal - platformFee);
    }
  } else {
    subtotal = safeMoney(order.subtotal);
    deliveryFee = safeMoney(order.shipping_amount ?? order.delivery_fee);
    platformFee = safeMoney(order.platform_fee);
    const tax = safeMoney(order.tax_amount);
    totalAmount =
      (mealDisplayTotals?.total ??
        safeMoney(order.total_amount)) ||
      Math.max(0, subtotal + deliveryFee + platformFee + tax);
    if (deliveryFee === 0 && totalAmount > subtotal + platformFee + tax) {
      deliveryFee = Math.max(0, totalAmount - subtotal - platformFee - tax);
    }
    if (subtotal === 0 && totalAmount > 0) {
      subtotal = Math.max(0, totalAmount - deliveryFee - platformFee - tax);
    }
  }

  const deliveredAt =
    order.delivered_at ??
    order.actual_delivery_time ??
    deliveryTracking?.delivered_at ??
    null;

  const deliveryAddress = formatMealDeliveryAddressForDisplay(order, orderSource);

  return {
    id: order.id,
    order_number: order.order_number || String(order.id ?? '').slice(-8),
    orderNumber: order.order_number || String(order.id ?? '').slice(-8),
    status: displayStatus,
    subtotal,
    delivery_fee: deliveryFee,
    deliveryFee,
    platform_fee: platformFee,
    platformFee,
    customer_lat: order.customer_lat ?? order.delivery_lat ?? null,
    customer_lng: order.customer_lng ?? order.delivery_lng ?? null,
    total: totalAmount,
    total_amount: totalAmount,
    delivered_at: deliveredAt,
    deliveredAt,
    delivery_address: deliveryAddress,
    deliveryAddress,
    logistics_type: order.logistics_type ?? null,
    logisticsType: order.logistics_type ?? null,
    createdAt: order.created_at,
    created_at: order.created_at,
  };
}
