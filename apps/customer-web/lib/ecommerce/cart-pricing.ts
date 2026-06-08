/**
 * Shared marketplace cart pricing for `/cart` and checkout routes.
 * Business rules: per-vendor delivery, coupons, GST via tax-system.
 */
import { calculateTax } from '@/lib/tax-system';
import type { TaxResult } from '@/lib/tax-system/types';
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

/** Seller Hub / vendor_promotions savings (additive to legacy demo coupons). */
export type SellerPromotionPricing = {
  /** Auto-applied from POST /promotions/calculate-cart (e.g. BOGO). */
  autoDiscount?: number;
  /** Manual code via POST /promotions/validate-code at checkout. */
  codeDiscount?: number;
  label?: string;
  code?: string;
  promotionId?: string;
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
  discount: number;
  /** Legacy demo / cart coupons only. */
  couponDiscount?: number;
  /** Seller auto + code (capped with coupons at subtotal). */
  sellerPromotionDiscount?: number;
  subtotalAfterDiscount: number;
  deliveryFees: number;
  giftWrapFee: number;
  protectionFee: number;
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

const STANDARD_DELIVERY_FEE = 60;
const EXPRESS_DELIVERY_FEE = 150;
const SCHEDULED_DELIVERY_FEE = 80;
const GIFT_WRAP_PER_ITEM = 25;
const PROTECTION_RATE = 0.02;

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
  vendorId: string,
  vendorTotal: number,
  options: CartPricingOptions
): number {
  void vendorId;
  void vendorTotal;
  const speed = options.deliverySpeed ?? 'standard';
  if (speed === 'scheduled') return SCHEDULED_DELIVERY_FEE;
  return STANDARD_DELIVERY_FEE;
}

export function computeSellerPromotionDiscount(
  sellerPromotion?: SellerPromotionPricing
): number {
  if (!sellerPromotion) return 0;
  const auto = Math.max(0, sellerPromotion.autoDiscount ?? 0);
  const code = Math.max(0, sellerPromotion.codeDiscount ?? 0);
  return Math.max(auto, code);
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
  const discount = Math.min(
    lineSubtotal,
    couponDiscount + sellerPromotionDiscount
  );
  const subtotalAfterDiscount = Math.max(0, lineSubtotal - discount);

  const byVendor: VendorPricingRow[] = Object.keys(itemsByVendor).map((vendorId) => {
    const vendorItems = itemsByVendor[vendorId];
    const subtotal = getVendorSubtotal(vendorItems);
    const deliveryFee = calculateVendorDeliveryFee(vendorId, subtotal, options);
    return {
      vendorId,
      subtotal,
      deliveryFee,
      freeDeliveryMin: 0,
      freeDeliveryGap: 0,
    };
  });

  const deliveryFees = byVendor.reduce((sum, row) => sum + row.deliveryFee, 0);
  const giftWrapFee = options.giftWrap ? itemCount * GIFT_WRAP_PER_ITEM : 0;
  const protectionFee = options.productProtection ? lineSubtotal * PROTECTION_RATE : 0;

  const taxableItems = cartItemsToTaxableItems(cart as CartItem[]);
  const divisor = lineSubtotal > 0 ? lineSubtotal : 1;
  const adjusted = taxableItems.map((item) => ({
    ...item,
    amount:
      (item.amount * (item.quantity || 1) -
        (discount * (item.amount * (item.quantity || 1))) / divisor) /
      (item.quantity || 1),
  }));
  const taxResult = calculateTax(adjusted);
  const taxAmount = taxResult.total;

  const total =
    subtotalAfterDiscount + deliveryFees + giftWrapFee + protectionFee + taxAmount;

  const freeDeliveryGap = 0;

  return {
    lineSubtotal,
    discount,
    couponDiscount,
    sellerPromotionDiscount,
    subtotalAfterDiscount,
    deliveryFees,
    giftWrapFee,
    protectionFee,
    taxAmount,
    taxResult,
    total,
    freeDeliveryGap: 0,
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
