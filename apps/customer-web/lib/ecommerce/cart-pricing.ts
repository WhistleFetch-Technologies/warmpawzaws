/**
 * Shared marketplace cart pricing for `/cart` and checkout routes.
 * Business rules: per-vendor delivery, single customer-chosen promotion, GST via tax-system.
 *
 * GST decision (locked — see Ecommerce Settlement Engine plan): product prices are
 * GST-inclusive MRP. GST is ALWAYS computed informationally from the ORIGINAL per-line
 * price and is never added on top of the total, and never recomputed from a discounted
 * amount — a discount is a separate "Less: Promotional Discount" line, not a tax adjustment.
 */
import { calculateTax } from '@/lib/tax-system';
import type { TaxBreakdown, TaxByType, TaxResult } from '@/lib/tax-system/types';
import { cartItemsToTaxableItems, type CartItem } from '@/lib/tax-system/taxCalculatorUtils';

export type CartPricingCoupon = {
  id: string;
  code: string;
  type: 'percentage' | 'fixed' | 'delivery';
  value: number;
  minOrder: number;
  maxDiscount?: number;
  vendorId?: string;
  description: string;
  expiryDate?: string;
};

export type DeliverySpeed = 'standard' | 'express' | 'scheduled';

export type PricingCartLine = Pick<
  CartItem,
  'id' | 'name' | 'price' | 'quantity' | 'vendorId' | 'vendorName'
> & {
  category?: string;
  categoryId?: string;
};

/** Seller Hub / vendor_promotions or Commercial Campaign (admin) savings — ONE at a time. */
export type SellerPromotionPricing = {
  /** Auto-applied from POST /promotions/calculate-cart (e.g. BOGO). */
  autoDiscount?: number;
  /** Manual code via POST /promotions/validate-code at checkout. */
  codeDiscount?: number;
  label?: string;
  code?: string;
  promotionId?: string;
  /** Which table validated this discount — required so the backend never mixes sources. */
  source?: 'vendor' | 'admin';
};

export type CartPricingOptions = {
  appliedCoupons?: CartPricingCoupon[];
  deliverySpeed?: DeliverySpeed;
  giftWrap?: boolean;
  productProtection?: boolean;
  itemCount?: number;
  /** Optional seller promotion; does not change coupon behavior when omitted. */
  sellerPromotion?: SellerPromotionPricing;
};

export type VendorPricingRow = {
  vendorId: string;
  subtotal: number;
  deliveryFee: number;
  freeDeliveryMin: number;
  freeDeliveryGap: number;
};

export type CartPricingBreakdown = {
  lineSubtotal: number;
  /** The ONE active discount (max of legacy coupon vs seller/admin promotion — never summed). */
  discount: number;
  /** Legacy demo / cart coupons only — informational; only applied when it is the winning discount. */
  couponDiscount?: number;
  /** Seller (vendor_promotions) or admin (ecommerce_admin_promotions) — informational; only applied when winning. */
  sellerPromotionDiscount?: number;
  /** Which source funds the winning discount, when it is the seller/admin promotion. */
  promotionSource?: 'vendor' | 'admin';
  subtotalAfterDiscount: number;
  deliveryFees: number;
  giftWrapFee: number;
  protectionFee: number;
  /** Informational only — already included inside lineSubtotal/subtotalAfterDiscount (GST-inclusive MRP). Never added to `total`. */
  taxAmount: number;
  taxResult: TaxResult;
  total: number;
  /** Smallest amount to add (across vendors) for free delivery on the primary vendor block. */
  freeDeliveryGap: number;
  byVendor: VendorPricingRow[];
  itemCount: number;
};

export const CART_PRICING_OPTIONS_KEY = 'warmpawz_cart_pricing_options';

export const VENDOR_DELIVERY_CONFIG: Record<
  string,
  { name: string; deliveryTime: string; freeDeliveryMin: number }
> = {
  vendor1: { name: 'PawSome Pets Store', deliveryTime: '2-3 days', freeDeliveryMin: 999 },
  vendor2: { name: 'Pet Paradise', deliveryTime: '1-2 days', freeDeliveryMin: 799 },
  vendor3: { name: 'Furry Friends Shop', deliveryTime: '3-4 days', freeDeliveryMin: 1200 },
  default: { name: 'Warmpawz Store', deliveryTime: '2-3 days', freeDeliveryMin: 999 },
};

// These constants are intentionally duplicated from backend/lambda/src/utils/ecommerce/delivery-fee.ts
// because the two packages cannot share source. If you change the delivery policy here,
// you MUST update the backend file to match (and vice versa) to prevent cart↔order fee mismatches.
export const ECOMMERCE_DEFAULT_DELIVERY_FEE = 150;

const GIFT_WRAP_PER_ITEM = 25;
const PROTECTION_RATE = 0.02;

/** Order-level delivery: flat ₹150 on all order values (delivery coupons may waive). */
export function computeEcommerceDeliveryFee(_subtotalAfterDiscount?: number): number {
  void _subtotalAfterDiscount;
  return ECOMMERCE_DEFAULT_DELIVERY_FEE;
}

export function groupCartLinesByVendor(
  cart: PricingCartLine[]
): Record<string, PricingCartLine[]> {
  return cart.reduce(
    (acc, item) => {
      const vendorId = item.vendorId || 'default';
      if (!acc[vendorId]) acc[vendorId] = [];
      acc[vendorId].push(item);
      return acc;
    },
    {} as Record<string, PricingCartLine[]>
  );
}

export function getVendorSubtotal(vendorItems: PricingCartLine[]): number {
  return vendorItems.reduce((total, item) => total + item.price * item.quantity, 0);
}

export function calculateVendorDeliveryFee(
  _vendorId: string,
  _vendorTotal: number,
  _options: CartPricingOptions,
  orderSubtotalAfterDiscount: number
): number {
  void _vendorId;
  void _vendorTotal;
  void _options;
  return computeEcommerceDeliveryFee(orderSubtotalAfterDiscount);
}

export function computeSellerPromotionDiscount(
  sellerPromotion?: SellerPromotionPricing
): number {
  if (!sellerPromotion) return 0;
  const auto = Math.max(0, sellerPromotion.autoDiscount ?? 0);
  const code = Math.max(0, sellerPromotion.codeDiscount ?? 0);
  return Math.max(auto, code);
}

/**
 * GST is informational and must reflect the price being GST-INCLUSIVE — never the
 * naive "rate% on top" math that lib/tax-system/taxCalculator.ts uses (that engine
 * treats `amount` as tax-EXCLUSIVE, which is correct for services but wrong for
 * product MRP). Re-derive each breakdown line as amount x rate/(100+rate).
 */
function toInclusiveTaxResult(result: TaxResult): TaxResult {
  const breakdown: TaxBreakdown[] = result.breakdown.map((b) => {
    const inclusiveTax = b.rate > 0 ? (b.baseAmount * b.rate) / (100 + b.rate) : 0;
    return { ...b, taxAmount: Math.round(inclusiveTax * 100) / 100 };
  });

  const byTypeMap = new Map<string, TaxByType>();
  for (const tax of breakdown) {
    const existing = byTypeMap.get(tax.taxType);
    if (existing) {
      existing.totalAmount += tax.taxAmount;
      existing.breakdown.push(tax);
    } else {
      byTypeMap.set(tax.taxType, { taxType: tax.taxType, totalAmount: tax.taxAmount, breakdown: [tax] });
    }
  }
  const byType: TaxByType[] = Array.from(byTypeMap.values()).map((t) => ({
    ...t,
    totalAmount: Math.round(t.totalAmount * 100) / 100,
  }));
  const total = Math.round(breakdown.reduce((sum, b) => sum + b.taxAmount, 0) * 100) / 100;

  return {
    ...result,
    breakdown,
    byType,
    total,
    // Inclusive: the "grand total" IS the subtotal — GST is already inside it.
    grandTotal: result.subtotal,
  };
}

export function computeCouponDiscount(
  cartTotal: number,
  appliedCoupons: CartPricingCoupon[]
): number {
  let totalDiscount = 0;
  for (const coupon of appliedCoupons) {
    if (coupon.type === 'percentage') {
      const d = (cartTotal * coupon.value) / 100;
      totalDiscount += coupon.maxDiscount ? Math.min(d, coupon.maxDiscount) : d;
    } else if (coupon.type === 'fixed') {
      totalDiscount += coupon.value;
    }
  }
  return totalDiscount;
}

export function computeCartPricing(
  cart: PricingCartLine[],
  options: CartPricingOptions = {}
): CartPricingBreakdown {
  const itemCount =
    options.itemCount ?? cart.reduce((sum, item) => sum + item.quantity, 0);
  const appliedCoupons = options.appliedCoupons ?? [];
  const itemsByVendor = groupCartLinesByVendor(cart);

  const lineSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const couponDiscount = computeCouponDiscount(lineSubtotal, appliedCoupons);
  const sellerPromotionDiscount = computeSellerPromotionDiscount(options.sellerPromotion);
  // Only ONE promotion is ever active (customer's single choice in CartPromotionSelect) —
  // never sum a legacy coupon with a seller/admin promotion. Whichever is larger wins for
  // display purposes; in practice only one of the two is ever non-zero in the live UI.
  const discount = Math.min(lineSubtotal, Math.max(couponDiscount, sellerPromotionDiscount));
  const promotionSource =
    sellerPromotionDiscount > 0 && sellerPromotionDiscount >= couponDiscount
      ? options.sellerPromotion?.source
      : undefined;
  const subtotalAfterDiscount = Math.max(0, lineSubtotal - discount);
  const hasFreeDeliveryCoupon = appliedCoupons.some(
    (c) => c.type === 'delivery' && lineSubtotal >= (c.minOrder ?? 0)
  );
  const deliveryFees = hasFreeDeliveryCoupon ? 0 : computeEcommerceDeliveryFee(subtotalAfterDiscount);
  const freeDeliveryGap = 0;

  const byVendor: VendorPricingRow[] = Object.keys(itemsByVendor).map((vendorId) => {
    const vendorItems = itemsByVendor[vendorId];
    const subtotal = getVendorSubtotal(vendorItems);
    return {
      vendorId,
      subtotal,
      deliveryFee: 0,
      freeDeliveryMin: 0,
      freeDeliveryGap: 0,
    };
  });

  if (byVendor.length > 0) {
    byVendor[0].deliveryFee = deliveryFees;
    byVendor[0].freeDeliveryGap = freeDeliveryGap;
  }
  const giftWrapFee = options.giftWrap ? itemCount * GIFT_WRAP_PER_ITEM : 0;
  const protectionFee = options.productProtection ? lineSubtotal * PROTECTION_RATE : 0;

  // GST is ALWAYS computed on the ORIGINAL per-line price — never adjusted for the
  // discount. It is informational (already embedded in the GST-inclusive MRP), so it
  // is never added into `total` below.
  const taxableItems = cartItemsToTaxableItems(cart as CartItem[]);
  const taxResult = toInclusiveTaxResult(calculateTax(taxableItems));
  const taxAmount = taxResult.total;

  const total = subtotalAfterDiscount + deliveryFees + giftWrapFee + protectionFee;

  return {
    lineSubtotal,
    discount,
    couponDiscount,
    sellerPromotionDiscount,
    promotionSource,
    subtotalAfterDiscount,
    deliveryFees,
    giftWrapFee,
    protectionFee,
    taxAmount,
    taxResult,
    total,
    freeDeliveryGap,
    byVendor,
    itemCount,
  };
}

export function persistPricingOptionsForCheckout(options: CartPricingOptions): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CART_PRICING_OPTIONS_KEY, JSON.stringify(options));
  } catch {
    /* ignore quota */
  }
}

export function readPricingOptionsForCheckout(): CartPricingOptions {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(CART_PRICING_OPTIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CartPricingOptions;
  } catch {
    return {};
  }
}

export function clearPricingOptionsForCheckout(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CART_PRICING_OPTIONS_KEY);
  } catch {
    /* ignore */
  }
}
