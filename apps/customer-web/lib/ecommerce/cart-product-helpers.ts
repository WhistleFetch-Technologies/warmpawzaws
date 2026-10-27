import type { ShopProduct } from '@/components/shop/shop-types';
import type { CartItem } from '@/context/CartContext';
import { cartLineKey } from '@/lib/product-sku-client';
import type { WarmpawzCartLine } from '@/lib/warmpawz-cart-storage';

/** Build a cart line + CartItem from a catalog product (also-bought, recommendations). */
export function shopProductToCartItem(product: ShopProduct, quantity = 1): CartItem {
  const catalogPrice = product.price;
  const mrp = product.original_price ?? catalogPrice;
  const skuId =
    product.has_variants && product.listing_sku_id ? product.listing_sku_id : undefined;
  const selectedVariations =
    skuId &&
    product.listing_option_values &&
    Object.keys(product.listing_option_values).length > 0
      ? product.listing_option_values
      : undefined;
  const lineId = cartLineKey(product.id, skuId);
  const line: WarmpawzCartLine = {
    product_id: lineId,
    quantity,
    ...(skuId ? { product_sku_id: skuId } : {}),
    ...(selectedVariations ? { selected_variations: selectedVariations } : {}),
    product: {
      id: product.id,
      name: product.name,
      price: catalogPrice,
      original_price: mrp,
      emoji: product.emoji,
      images: product.images,
      vendor_id: product.vendor_id,
      vendor_name: product.vendor_name,
      ...(product.vendor_state ? { vendor_state: product.vendor_state } : {}),
      ...(product.vendor_pincode ? { vendor_pincode: product.vendor_pincode } : {}),
      ...(product.vendor_shipping_origin_pincode
        ? { vendor_shipping_origin_pincode: product.vendor_shipping_origin_pincode }
        : {}),
      ...(product.lead_time_min_days != null
        ? { lead_time_min_days: Number(product.lead_time_min_days) }
        : {}),
      ...(product.lead_time_max_days != null
        ? { lead_time_max_days: Number(product.lead_time_max_days) }
        : {}),
      category_id: product.category_id,
      stock: product.stock ?? 99,
      ...(product.delivery_regions?.length
        ? { delivery_regions: product.delivery_regions }
        : {}),
    },
  };

  return {
    id: lineId,
    name: product.name,
    price: catalogPrice,
    originalPrice: mrp,
    quantity,
    image: product.images?.[0] || product.emoji,
    vendorId: product.vendor_id,
    vendorName: product.vendor_name,
    categoryId: product.category_id,
    ...(selectedVariations ? { selectedVariations } : {}),
    ...(skuId ? { productSkuId: skuId } : {}),
    warmpawzLine: line,
  };
}

const AXIS_DISPLAY_LABELS: Record<string, string> = {
  size: 'Size',
  color: 'Color',
  pack: 'Pack',
  weight: 'Weight',
};

export function formatSelectedVariations(
  variations?: Record<string, string>,
  axisLabels?: Record<string, string>,
): string | null {
  if (!variations || Object.keys(variations).length === 0) return null;
  return Object.entries(variations)
    .map(([k, v]) => {
      const label = axisLabels?.[k] ?? AXIS_DISPLAY_LABELS[k] ?? k;
      return `${label}: ${v}`;
    })
    .join(' · ');
}

export function computeCartMrpTotal(
  cart: Array<{ price: number; quantity: number; originalPrice?: number }>
): number {
  return cart.reduce((sum, item) => {
    const mrp = item.originalPrice ?? item.price;
    return sum + mrp * item.quantity;
  }, 0);
}

export type PromoLineDiscount = {
  productId: string;
  lineKey?: string;
  discount: number;
};

export const PROMO_LINE_DISCOUNTS_KEY = 'promo_engine_ecom_line_discounts';

export function writePromoLineDiscounts(rows: PromoLineDiscount[]): void {
  try {
    sessionStorage.setItem(PROMO_LINE_DISCOUNTS_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export function readPromoLineDiscounts(): PromoLineDiscount[] | null {
  try {
    const raw = sessionStorage.getItem(PROMO_LINE_DISCOUNTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (row): row is PromoLineDiscount =>
        !!row &&
        typeof row === 'object' &&
        typeof (row as PromoLineDiscount).productId === 'string',
    );
  } catch {
    return null;
  }
}

/**
 * Discount for one cart row. When the API sent per-line amounts, only that
 * product is reduced. Otherwise fall back to a share of the order discount.
 */
export function resolveLinePromotionDiscount(opts: {
  lineId: string;
  productId: string;
  lineMrp: number;
  orderMrp: number;
  orderDiscount: number;
  lineDiscounts: PromoLineDiscount[] | null;
}): number {
  const rows = opts.lineDiscounts;
  if (rows) {
    const byKey = rows.find((row) => row.lineKey && row.lineKey === opts.lineId);
    if (byKey) return Math.max(0, Number(byKey.discount) || 0);
    const sameProduct = rows.filter((row) => row.productId === opts.productId);
    if (sameProduct.length === 1) return Math.max(0, Number(sameProduct[0].discount) || 0);
    return 0;
  }
  return allocateLinePromotionDiscount(opts.lineMrp, opts.orderMrp, opts.orderDiscount);
}

/** Allocate order-level promotion discount to a cart line (proportional to MRP share). */
export function allocateLinePromotionDiscount(
  lineMrpTotal: number,
  orderMrpSubtotal: number,
  orderPromotionDiscount: number
): number {
  if (orderPromotionDiscount <= 0 || orderMrpSubtotal <= 0 || lineMrpTotal <= 0) return 0;
  return Math.round(((lineMrpTotal / orderMrpSubtotal) * orderPromotionDiscount) * 100) / 100;
}

export function cartLineMrpTotal(item: { price: number; quantity: number; originalPrice?: number }): number {
  return (item.originalPrice ?? item.price) * item.quantity;
}
