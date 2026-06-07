import type { ShopProduct } from '@/components/shop/shop-types';
import type { CartItem } from '@/context/CartContext';
import type { WarmpawzCartLine } from '@/lib/warmpawz-cart-storage';

/** Build a cart line + CartItem from a catalog product (also-bought, recommendations). */
export function shopProductToCartItem(product: ShopProduct, quantity = 1): CartItem {
  const line: WarmpawzCartLine = {
    product_id: product.id,
    quantity,
    product: {
      id: product.id,
      name: product.name,
      price: product.price,
      original_price: product.original_price,
      emoji: product.emoji,
      images: product.images,
      vendor_id: product.vendor_id,
      vendor_name: product.vendor_name,
      category_id: product.category_id,
      stock: product.stock ?? 99,
    },
  };

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    originalPrice: product.original_price,
    quantity,
    image: product.images?.[0] || product.emoji,
    vendorId: product.vendor_id,
    vendorName: product.vendor_name,
    categoryId: product.category_id,
    warmpawzLine: line,
  };
}

export function formatSelectedVariations(variations?: Record<string, string>): string | null {
  if (!variations || Object.keys(variations).length === 0) return null;
  return Object.entries(variations)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}

export function computeCartMrpTotal(
  cart: Array<{ price: number; quantity: number; originalPrice?: number }>
): number {
  return cart.reduce((sum, item) => {
    const mrp =
      item.originalPrice && item.originalPrice > item.price ? item.originalPrice : item.price;
    return sum + mrp * item.quantity;
  }, 0);
}
