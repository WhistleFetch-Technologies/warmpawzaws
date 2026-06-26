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

function parseSnap(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as unknown;
      return typeof o === 'object' && o != null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function splitPlatformConvenience(
  platformCombined: number,
  snap: Record<string, unknown>,
  order: Record<string, unknown>,
): { platformFee: number; convenienceFee: number } {
  const cp = snap.checkoutPricing as Record<string, unknown> | undefined;
  const snapPlatform = safeMoney(cp?.platformFee ?? snap.platformFee);
  const snapConvenience = safeMoney(cp?.convenienceFee ?? snap.convenienceFee);
  const orderConvenience = safeMoney(order.convenience_fee);
  if (snapPlatform > 0 || snapConvenience > 0) {
    return { platformFee: snapPlatform, convenienceFee: snapConvenience };
  }
  if (orderConvenience > 0 && platformCombined > orderConvenience) {
    return {
      platformFee: Math.round((platformCombined - orderConvenience) * 100) / 100,
      convenienceFee: orderConvenience,
    };
  }
  if (platformCombined > 9) {
    return { platformFee: Math.round((platformCombined - 9) * 100) / 100, convenienceFee: 9 };
  }
  return { platformFee: platformCombined, convenienceFee: 0 };
}

export function buildMealTrackingSummaryLines(input: {
  order: Record<string, unknown>;
  subtotal: number;
  deliveryFee: number;
  platformFeeCombined: number;
  taxAmount: number;
  totalAmount: number;
  quantity?: number;
}): Array<{ label: string; amount: number; sublabel?: string }> {
  const qty = Math.max(1, Math.floor(input.quantity ?? 1));
  const snap = parseSnap(input.order.purchase_snapshot);
  const cp = (snap.checkoutPricing ?? {}) as Record<string, unknown>;
  const gst = (cp.gst ?? snap.gst) as Record<string, unknown> | undefined;

  let mealPrice = input.subtotal > 0 ? input.subtotal : safeMoney(cp.subtotal);
  let deliveryFee =
    input.deliveryFee > 0
      ? input.deliveryFee
      : safeMoney(cp.deliveryFee ?? input.order.logistics_cost);

  const { platformFee, convenienceFee } = splitPlatformConvenience(
    input.platformFeeCombined,
    snap,
    input.order,
  );

  const foodPct = gst?.foodGstPct != null ? safeMoney(gst.foodGstPct) : 5;
  const deliveryPct = gst?.deliveryGstPct != null ? safeMoney(gst.deliveryGstPct) : 0;
  let foodGst = safeMoney(gst?.foodGstAmount);
  let deliveryGst = safeMoney(gst?.deliveryGstAmount);
  if (foodGst <= 0 && mealPrice > 0) foodGst = Math.round(((mealPrice * foodPct) / 100) * 100) / 100;
  if (deliveryGst <= 0 && deliveryFee > 0 && deliveryPct > 0) {
    deliveryGst = Math.round(((deliveryFee * deliveryPct) / 100) * 100) / 100;
  }
  if (foodGst <= 0 && deliveryGst <= 0 && input.taxAmount > 0) foodGst = input.taxAmount;

  const total = input.totalAmount;
  if (total > 0 && mealPrice <= 0) {
    mealPrice = Math.max(
      0,
      total - deliveryFee - platformFee - convenienceFee - foodGst - deliveryGst,
    );
  }
  if (total > 0 && deliveryFee <= 0 && mealPrice > 0) {
    deliveryFee = Math.max(
      0,
      total - mealPrice - platformFee - convenienceFee - foodGst - deliveryGst,
    );
  }

  const lines: Array<{ label: string; amount: number; sublabel?: string }> = [
    {
      label: 'Meal price',
      amount: mealPrice,
      sublabel: qty > 1 ? `Qty ${qty}` : undefined,
    },
    { label: 'Delivery', amount: deliveryFee },
    { label: 'Platform fee', amount: platformFee },
    { label: 'Convenience fee', amount: convenienceFee },
    {
      label: 'GST on meal (food)',
      amount: foodGst,
      sublabel: `${foodPct}%`,
    },
    {
      label: 'GST on delivery',
      amount: deliveryGst,
      sublabel: `${deliveryPct}%`,
    },
  ];

  return lines.filter(
    (l) =>
      l.amount > 0 ||
      l.label === 'Delivery' ||
      l.label.startsWith('GST'),
  );
}

export async function buildMealTrackingCustomerPayload(
  customerRow: Record<string, unknown> | null | undefined,
  order: Record<string, unknown>,
  presignPhoto?: (url: string | null | undefined) => Promise<string | null | undefined>,
): Promise<Record<string, unknown> | null> {
  if (!customerRow) return null;
  const rawPhoto =
    typeof customerRow.profile_photo_url === 'string'
      ? customerRow.profile_photo_url.trim()
      : '';
  const photoUrl =
    rawPhoto && presignPhoto ? (await presignPhoto(rawPhoto)) ?? rawPhoto : rawPhoto || null;
  return {
    id: customerRow.id,
    full_name: customerRow.full_name,
    name: customerRow.full_name,
    phone: customerRow.phone ?? order.shipping_phone,
    profile_photo_url: photoUrl,
    profilePhotoUrl: photoUrl,
    photo: photoUrl,
  };
}

export function buildCustomerMealTrackingOrderPayload(input: {
  order: Record<string, unknown>;
  orderSource: MealTrackingOrderSource;
  displayStatus: string;
  mealDisplayTotals?: { subtotal: number; total: number } | null;
  mealPlan?: Record<string, unknown> | null;
  deliveryTracking?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const { order, orderSource, displayStatus, mealDisplayTotals, mealPlan, deliveryTracking } = input;

  let subtotal = 0;
  let deliveryFee = 0;
  let platformFee = 0;
  let totalAmount = 0;
  const taxAmount = safeMoney(order.tax_amount);

  if (orderSource === 'meal_orders') {
    const storedSubtotal = safeMoney(order.subtotal);
    const totals =
      mealDisplayTotals ??
      resolveCustomerMealPlanOrderDisplayTotals(order, mealPlan ?? null);
    subtotal = totals.subtotal > 0 ? totals.subtotal : storedSubtotal;
    totalAmount = totals.total > 0 ? totals.total : safeMoney(order.total_amount);
    deliveryFee = safeMoney(order.delivery_fee);
    platformFee = safeMoney(order.platform_fee);
    if (subtotal <= 0 && storedSubtotal > 0) subtotal = storedSubtotal;
    if (deliveryFee === 0 && totalAmount > subtotal + platformFee + taxAmount) {
      deliveryFee = Math.max(0, totalAmount - subtotal - platformFee - taxAmount);
    }
    if (subtotal === 0 && totalAmount > 0 && deliveryFee === 0 && platformFee === 0) {
      subtotal = Math.max(0, totalAmount - taxAmount);
    }
  } else {
    subtotal = safeMoney(order.subtotal);
    deliveryFee = safeMoney(order.shipping_amount ?? order.delivery_fee);
    platformFee = safeMoney(order.platform_fee);
    totalAmount =
      (mealDisplayTotals?.total ??
        safeMoney(order.total_amount)) ||
      Math.max(0, subtotal + deliveryFee + platformFee + taxAmount);
    if (deliveryFee === 0 && totalAmount > subtotal + platformFee + taxAmount) {
      deliveryFee = Math.max(0, totalAmount - subtotal - platformFee - taxAmount);
    }
    if (subtotal === 0 && totalAmount > 0) {
      subtotal = Math.max(0, totalAmount - deliveryFee - platformFee - taxAmount);
    }
  }

  const deliveredAtRaw =
    order.delivered_at ??
    order.actual_delivery_time ??
    deliveryTracking?.delivered_at ??
    null;
  const includeDeliveredAt = displayStatus === 'delivered';
  const deliveredAt = includeDeliveredAt ? deliveredAtRaw : null;

  const cancelledBy = order.cancelled_by ?? order.cancelledBy ?? null;
  const cancelledAt = order.cancelled_at ?? order.cancelledAt ?? null;

  const snapForAddr = parseSnap(order.purchase_snapshot);
  const snapAddr = snapForAddr.deliveryAddress as Record<string, unknown> | undefined;
  let deliveryAddress = formatMealDeliveryAddressForDisplay(order, orderSource);
  if (!deliveryAddress && snapAddr && typeof snapAddr === 'object') {
    deliveryAddress = formatAddressObject(snapAddr);
  }
  const quantityRaw = order.quantity ?? order.line_quantity;
  const quantity =
    quantityRaw != null && quantityRaw !== ''
      ? Math.max(1, Math.floor(Number(quantityRaw) || 1))
      : 1;

  const mealPlanName =
    (typeof order.meal_plan_name === 'string' && order.meal_plan_name.trim()) ||
    (typeof order.meal_name === 'string' && order.meal_name.trim()) ||
    '';

  const summaryLines = buildMealTrackingSummaryLines({
    order,
    subtotal,
    deliveryFee:
      deliveryFee > 0
        ? deliveryFee
        : safeMoney(order.logistics_cost),
    platformFeeCombined: platformFee,
    taxAmount,
    totalAmount,
    quantity,
  });

  const splitFees = splitPlatformConvenience(platformFee, snapForAddr, order);

  return {
    id: order.id,
    order_number: order.order_number || String(order.id ?? '').slice(-8),
    orderNumber: order.order_number || String(order.id ?? '').slice(-8),
    status: displayStatus,
    cancelled_by: cancelledBy,
    cancelledBy,
    cancelled_at: cancelledAt,
    cancelledAt,
    meal_plan_name: mealPlanName || undefined,
    mealPlanName: mealPlanName || undefined,
    quantity,
    subtotal,
    delivery_fee: deliveryFee,
    deliveryFee,
    platform_fee: splitFees.platformFee,
    platformFee: splitFees.platformFee,
    convenience_fee: splitFees.convenienceFee,
    convenienceFee: splitFees.convenienceFee,
    tax_amount: taxAmount,
    taxAmount,
    customer_lat: order.customer_lat ?? order.delivery_lat ?? null,
    customer_lng: order.customer_lng ?? order.delivery_lng ?? null,
    total: totalAmount,
    total_amount: totalAmount,
    delivered_at: deliveredAt,
    deliveredAt,
    delivery_address: deliveryAddress,
    deliveryAddress,
    delivery_address_raw: order.delivery_address ?? order.shipping_address ?? null,
    shipping_address: order.shipping_address ?? null,
    shipping_city: order.shipping_city ?? null,
    shipping_state: order.shipping_state ?? null,
    shipping_pincode: order.shipping_pincode ?? null,
    purchase_snapshot: order.purchase_snapshot ?? null,
    summary_lines: summaryLines,
    summaryLines,
    logistics_type: order.logistics_type ?? null,
    logisticsType: order.logistics_type ?? null,
    createdAt: order.created_at,
    created_at: order.created_at,
  };
}
