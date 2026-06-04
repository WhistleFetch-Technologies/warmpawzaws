import { canonicalProductId } from '@/lib/product-id';
import {
  getProductDiscountPercent as discountPercentFromPrices,
  listPriceForDiscountDisplay,
  resolveProductCompareAtPrice,
  resolveProductSellingPrice,
} from '@/lib/shop-product-pricing';
import type { ShopProduct } from './shop-types';

export function mapApiRowToShopProduct(p: Record<string, unknown>): ShopProduct | null {
  const id = canonicalProductId(p);
  if (!id) return null;

  const compareAt = resolveProductCompareAtPrice(p);
  const sellingPrice = resolveProductSellingPrice(p, compareAt);
  const rc = Number(p.review_count ?? 0) || 0;
  const rawRating = p.rating != null ? Number(p.rating) : NaN;
  const rating = rc > 0 && Number.isFinite(rawRating) && rawRating > 0 ? rawRating : 0;

  return {
    ...(p as unknown as ShopProduct),
    id,
    stock: Number(p.stock_quantity ?? p.stock ?? 0) || 0,
    price: sellingPrice,
    original_price: listPriceForDiscountDisplay(sellingPrice, compareAt),
    rating,
    review_count: rc,
    images: (p.images as string[]) || [],
    emoji: (p.emoji as string) || '🐾',
    name: String(p.name ?? ''),
    description: String(p.description ?? ''),
    category_id: String(p.category_id ?? ''),
    vendor_id: String(p.vendor_id ?? ''),
    vendor_name: String(p.vendor_name ?? 'Warmpawz Store'),
    is_active: p.is_active !== false,
  };
}

export function mapApiProductsList(rawList: unknown[]): ShopProduct[] {
  return rawList
    .map((row) => mapApiRowToShopProduct(row as Record<string, unknown>))
    .filter((p): p is ShopProduct => Boolean(p));
}

export function getProductDiscountPercent(product: ShopProduct): number {
  return discountPercentFromPrices(product.price, product.original_price);
}

export function sortShopProducts(products: ShopProduct[], sortBy: string): ShopProduct[] {
  const list = [...products];
  switch (sortBy) {
    case 'price_low':
      return list.sort((a, b) => a.price - b.price);
    case 'price_high':
      return list.sort((a, b) => b.price - a.price);
    case 'rating':
      return list.sort((a, b) => b.rating - a.rating);
    case 'newest':
      return list;
    default:
      return list.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
  }
}
