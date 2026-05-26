/**
 * Meal order tracking — checkout-style summary, delivery address, customer profile.
 */

import { sanitizeDisplayImageUrl } from '@/lib/resolve-display-image-url';

export type MealTrackingSummaryLine = {
  label: string;
  amount: number;
  sublabel?: string;
  /** Show ₹0.00 instead of dash */
  showZero?: boolean;
};

function safeMoney(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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

function checkoutPricingFromSnapshot(snap: Record<string, unknown>): Record<string, unknown> | null {
  const cp = snap.checkoutPricing ?? snap.checkout_pricing;
  if (cp && typeof cp === 'object' && !Array.isArray(cp)) return cp as Record<string, unknown>;
  return null;
}

/** Customer-facing delivery address (booking address). */
export function formatMealOrderDeliveryAddress(order: Record<string, unknown>): string {
  const snap = parseJsonObject(order.purchase_snapshot ?? order.purchaseSnapshot) ?? {};
  const snapAddr = snap.deliveryAddress ?? snap.delivery_address;
  if (snapAddr && typeof snapAddr === 'object' && !Array.isArray(snapAddr)) {
    const fromSnap = formatAddressObject(snapAddr as Record<string, unknown>);
    if (fromSnap) return fromSnap;
  }

  const preformatted =
    (typeof order.delivery_address === 'string' && order.delivery_address.trim()) ||
    (typeof order.deliveryAddress === 'string' && order.deliveryAddress.trim());
  if (preformatted && !preformatted.startsWith('{')) return preformatted;

  const raw =
    order.delivery_address_raw ??
    order.delivery_address ??
    order.deliveryAddress ??
    order.shipping_address ??
    order.shippingAddress;

  if (raw == null || raw === '') {
    const parts = [
      order.shipping_address,
      order.shipping_city,
      order.shipping_state,
      order.shipping_pincode,
    ].filter((x) => typeof x === 'string' && x.trim()) as string[];
    return parts.join(', ');
  }

  if (typeof raw === 'string') {
    const parsed = parseJsonObject(raw);
    if (parsed) {
      const fromObj = formatAddressObject(parsed);
      if (fromObj) return fromObj;
      return raw.trim();
    }
    return raw.trim();
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return formatAddressObject(raw as Record<string, unknown>);
  }

  return '';
}

export function resolveMealPlanTitle(order: Record<string, unknown>): string {
  const name =
    order.meal_plan_name ??
    order.mealPlanName ??
    order.meal_name ??
    order.mealName ??
    order.plan_name ??
    order.planName;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return 'Meal plan';
}

export function resolveMealOrderQuantity(order: Record<string, unknown>): number {
  const q = order.quantity ?? order.line_quantity ?? order.lineQuantity;
  const n = typeof q === 'number' ? q : parseInt(String(q ?? '1'), 10);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function resolveMealTrackingCustomer(
  order: Record<string, unknown>,
  customer?: Record<string, unknown> | null,
): { name: string; phone: string; photoUrl?: string } {
  const c = customer ?? (order.customer as Record<string, unknown> | undefined);
  const name =
    (typeof c?.full_name === 'string' && c.full_name.trim()) ||
    (typeof c?.name === 'string' && c.name.trim()) ||
    (typeof order.customer_name === 'string' && order.customer_name.trim()) ||
    'Customer';
  const phone =
    (typeof c?.phone === 'string' && c.phone.trim()) ||
    (typeof order.customer_phone === 'string' && order.customer_phone.trim()) ||
    (typeof order.shipping_phone === 'string' && order.shipping_phone.trim()) ||
    '';
  const photoRaw =
    (typeof c?.photo === 'string' && c.photo.trim()) ||
    (typeof c?.profile_photo_url === 'string' && c.profile_photo_url.trim()) ||
    (typeof c?.profilePhotoUrl === 'string' && c.profilePhotoUrl.trim()) ||
    undefined;
  const photoUrl = sanitizeDisplayImageUrl(photoRaw);
  return { name, phone, photoUrl };
}

function splitPlatformAndConvenience(
  platformCombined: number,
  snap: Record<string, unknown>,
  order: Record<string, unknown>,
): { platformFee: number; convenienceFee: number } {
  const snapPlatform = safeMoney(snap.platformFee ?? snap.platform_fee);
  const snapConvenience = safeMoney(snap.convenienceFee ?? snap.convenience_fee);
  const orderConvenience = safeMoney(order.convenience_fee ?? order.convenienceFee);

  if (snapPlatform > 0 || snapConvenience > 0) {
    return {
      platformFee: snapPlatform,
      convenienceFee: snapConvenience,
    };
  }
  if (orderConvenience > 0 && platformCombined > orderConvenience) {
    return {
      platformFee: round2(platformCombined - orderConvenience),
      convenienceFee: orderConvenience,
    };
  }
  if (platformCombined > 9) {
    return { platformFee: round2(platformCombined - 9), convenienceFee: 9 };
  }
  return { platformFee: platformCombined, convenienceFee: 0 };
}

function computeGstAmounts(
  mealPrice: number,
  deliveryFee: number,
  gst: Record<string, unknown> | undefined,
): { foodGst: number; deliveryGst: number; foodPct?: number; deliveryPct?: number } {
  const foodPct = gst?.foodGstPct != null ? safeMoney(gst.foodGstPct) : undefined;
  const deliveryPct = gst?.deliveryGstPct != null ? safeMoney(gst.deliveryGstPct) : undefined;
  const foodGst =
    safeMoney(gst?.foodGstAmount ?? gst?.food_gst_amount) ||
    (mealPrice > 0 && foodPct != null ? round2((mealPrice * foodPct) / 100) : 0);
  const deliveryGst =
    safeMoney(gst?.deliveryGstAmount ?? gst?.delivery_gst_amount) ||
    (deliveryFee > 0 && deliveryPct != null ? round2((deliveryFee * deliveryPct) / 100) : 0);
  return { foodGst, deliveryGst, foodPct, deliveryPct };
}

/**
 * Same line items as MealOrderCheckout order summary (third reference screenshot).
 */
export function buildMealOrderTrackingSummary(order: Record<string, unknown>): {
  planTitle: string;
  quantity: number;
  lines: MealTrackingSummaryLine[];
  total: number;
} {
  const snap = parseJsonObject(order.purchase_snapshot ?? order.purchaseSnapshot) ?? {};
  const cp = checkoutPricingFromSnapshot(snap);
  const planTitle = resolveMealPlanTitle(order);
  const quantity = resolveMealOrderQuantity(order);
  const total = safeMoney(
    order.total_amount ?? order.total ?? order.totalAmount ?? cp?.totalAmount ?? cp?.total_amount,
  );

  let mealPrice = safeMoney(
    order.subtotal ??
      order.subtotal_amount ??
      cp?.subtotal ??
      snap.foodSubtotalUpfront ??
      snap.food_subtotal_upfront,
  );
  let deliveryFee = safeMoney(
    order.delivery_fee ??
      order.deliveryFee ??
      order.shipping_amount ??
      order.shippingAmount ??
      cp?.deliveryFee ??
      cp?.delivery_fee ??
      order.logistics_cost ??
      order.logisticsCost,
  );

  const platformCombined = safeMoney(order.platform_fee ?? order.platformFee ?? cp?.platformFee);
  const { platformFee, convenienceFee } = splitPlatformAndConvenience(platformCombined, snap, order);

  const gstRaw = (cp?.gst ?? snap.gst) as Record<string, unknown> | undefined;
  let { foodGst, deliveryGst, foodPct, deliveryPct } = computeGstAmounts(mealPrice, deliveryFee, gstRaw);

  if (mealPrice <= 0 && snap.subtotalPerCycle != null) {
    mealPrice = safeMoney(snap.subtotalPerCycle);
  }

  const taxStored = safeMoney(order.tax_amount ?? order.taxAmount);
  if (foodGst <= 0 && deliveryGst <= 0 && taxStored > 0) {
    foodGst = taxStored;
  }

  if (total > 0 && mealPrice <= 0 && deliveryFee <= 0 && platformCombined <= 0) {
    mealPrice = Math.max(0, total - foodGst - deliveryGst);
  } else if (total > 0 && mealPrice <= 0) {
    mealPrice = Math.max(
      0,
      total - deliveryFee - platformFee - convenienceFee - foodGst - deliveryGst,
    );
    if (mealPrice <= 0 && foodPct === 5 && deliveryPct === 0) {
      mealPrice = round2((total - deliveryFee - platformFee - convenienceFee) / 1.05);
    }
  }

  if (total > 0 && deliveryFee <= 0 && mealPrice > 0) {
    const implied = total - mealPrice - platformFee - convenienceFee - foodGst - deliveryGst;
    if (implied > 0) deliveryFee = round2(implied);
  }

  if (foodGst <= 0 && mealPrice > 0 && foodPct == null) {
    const inferred = computeGstAmounts(mealPrice, deliveryFee, { foodGstPct: 5, deliveryGstPct: 0 });
    foodGst = inferred.foodGst;
    foodPct = 5;
    deliveryPct = 0;
  }

  const lines: MealTrackingSummaryLine[] = [
    {
      label: 'Meal price',
      amount: mealPrice,
      sublabel: quantity > 1 ? `Qty ${quantity}` : undefined,
      showZero: false,
    },
    {
      label: 'Delivery',
      amount: deliveryFee,
      showZero: true,
    },
    {
      label: 'Platform fee',
      amount: platformFee,
      showZero: false,
    },
    {
      label: 'Convenience fee',
      amount: convenienceFee,
      showZero: false,
    },
    {
      label: 'GST on meal (food)',
      amount: foodGst,
      sublabel: foodPct != null ? `${foodPct}%` : undefined,
      showZero: true,
    },
    {
      label: 'GST on delivery',
      amount: deliveryGst,
      sublabel: deliveryPct != null ? `${deliveryPct}%` : '0%',
      showZero: true,
    },
  ].filter((line) => line.showZero || line.amount > 0 || line.label.startsWith('GST'));

  const computedTotal = round2(
    mealPrice + deliveryFee + platformFee + convenienceFee + foodGst + deliveryGst,
  );

  return {
    planTitle,
    quantity,
    lines,
    total: total > 0 ? total : computedTotal,
  };
}

export function formatInr(value: unknown): string {
  if (value == null) return '—';
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
