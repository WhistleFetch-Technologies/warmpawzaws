import type { ShopProduct } from '@/components/shop/shop-types';
import type { CartItem } from '@/context/CartContext';
import type { WarmpawzCartLine } from '@/lib/warmpawz-cart-storage';

/** Build a cart line + CartItem from a catalog product (also-bought, recommendations). */
export function shopProductToCartItem(product: ShopProduct, quantity = 1): CartItem {
  const catalogPrice = product.price;
  const mrp = product.original_price ?? catalogPrice;
  const line: WarmpawzCartLine = {
    product_id: product.id,
    quantity,
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
      category_id: product.category_id,
      stock: product.stock ?? 99,
      ...(product.delivery_regions?.length
        ? { delivery_regions: product.delivery_regions }
        : {}),
    },
  };

  return {
    id: product.id,
    name: product.name,
    price: catalogPrice,
    originalPrice: mrp,
    quantity,
    image: product.images?.[0] || product.emoji,
    vendorId: product.vendor_id,
    vendorName: product.vendor_name,
    categoryId: product.category_id,
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
