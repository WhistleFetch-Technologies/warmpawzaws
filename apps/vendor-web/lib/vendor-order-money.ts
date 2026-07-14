/**
 * Vendor-facing ecommerce money view.
 *
 * Catalog subtotal (P) is always the vendor base. Who funds the promotion:
 * - admin/platform → vendor still settles on P (minus commission); platform absorbs D
 * - vendor        → vendor settles on (P − D) minus commission
 */

export type VendorPromotionSource = 'vendor' | 'admin' | null;

export type VendorOrderMoneyInput = {
  subtotal?: number | string | null;
  shipping_amount?: number | string | null;
  tax_amount?: number | string | null;
  total_amount?: number | string | null;
  discount_amount?: number | string | null;
  promotion_source?: string | null;
  vendor_promotion_amount?: number | string | null;
  admin_promotion_amount?: number | string | null;
  commission_amount?: number | string | null;
  commission_rate?: number | string | null;
  vendor_payout_amount?: number | string | null;
};

export type VendorOrderMoneyView = {
  catalogSubtotal: number;
  shipping: number;
  taxIncluded: number;
  customerPaid: number;
  discountAmount: number;
  promotionSource: VendorPromotionSource;
  /** Goods value used for settlement before commission. */
  vendorGoodsAmount: number;
  commissionAmount: number | null;
  /** Stored % rate when available (applied on ex-GST taxable value). */
  commissionRate: number | null;
  vendorPayoutAmount: number | null;
  isPlatformFunded: boolean;
  isVendorFunded: boolean;
};

export function toMoney(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizePromotionSource(
  raw: string | null | undefined
): VendorPromotionSource {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (s === 'admin' || s === 'platform') return 'admin';
  if (s === 'vendor') return 'vendor';
  return null;
}

export function resolveVendorOrderMoney(order: VendorOrderMoneyInput): VendorOrderMoneyView {
  const catalogSubtotal = toMoney(order.subtotal);
  const shipping = toMoney(order.shipping_amount);
  const taxIncluded = toMoney(order.tax_amount);
  const customerPaid = toMoney(order.total_amount);

  const vendorPromo = toMoney(order.vendor_promotion_amount);
  const adminPromo = toMoney(order.admin_promotion_amount);
  let promotionSource = normalizePromotionSource(order.promotion_source);
  // Infer funding when older rows only populated amount columns.
  if (!promotionSource) {
    if (adminPromo > 0 && vendorPromo <= 0) promotionSource = 'admin';
    else if (vendorPromo > 0 && adminPromo <= 0) promotionSource = 'vendor';
  }

  const discountFromSource =
    promotionSource === 'vendor'
      ? vendorPromo || toMoney(order.discount_amount)
      : promotionSource === 'admin'
        ? adminPromo || toMoney(order.discount_amount)
        : Math.max(vendorPromo, adminPromo, toMoney(order.discount_amount));

  const isPlatformFunded = promotionSource === 'admin' && discountFromSource > 0;
  const isVendorFunded = promotionSource === 'vendor' && discountFromSource > 0;

  // Platform promo never reduces vendor goods base; vendor promo does.
  const vendorGoodsAmount = isVendorFunded
    ? Math.max(0, catalogSubtotal - discountFromSource)
    : catalogSubtotal;

  const commissionAmount =
    order.commission_amount != null && order.commission_amount !== ''
      ? toMoney(order.commission_amount)
      : null;
  const commissionRate =
    order.commission_rate != null && order.commission_rate !== ''
      ? toMoney(order.commission_rate)
      : null;

  let vendorPayoutAmount: number | null =
    order.vendor_payout_amount != null && order.vendor_payout_amount !== ''
      ? toMoney(order.vendor_payout_amount)
      : null;

  if (vendorPayoutAmount == null && commissionAmount != null) {
    vendorPayoutAmount = Math.max(0, vendorGoodsAmount - commissionAmount);
  }

  return {
    catalogSubtotal,
    shipping,
    taxIncluded,
    customerPaid,
    discountAmount: discountFromSource,
    promotionSource,
    vendorGoodsAmount,
    commissionAmount,
    commissionRate,
    vendorPayoutAmount,
    isPlatformFunded,
    isVendorFunded,
  };
}

export function formatInrAmount(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  })}`;
}

/** Line total for vendor item list — always catalog unit × qty. */
export function vendorOrderItemCatalogTotal(item: {
  total_price?: number | string | null;
  total?: number | string | null;
  unit_price?: number | string | null;
  price?: number | string | null;
  quantity?: number | string | null;
}): number {
  const qty = Math.max(1, toMoney(item.quantity) || 1);
  const explicit = toMoney(item.total_price ?? item.total);
  if (explicit > 0) return explicit;
  const unit = toMoney(item.unit_price ?? item.price);
  return unit * qty;
}
