import { canonicalProductId } from '@/lib/product-id';
import { normalizeOptionValues } from '@/lib/product-sku-client';
import {
  getProductDiscountPercent as discountPercentFromPrices,
  listPriceForDiscountDisplay,
  resolveProductCompareAtPrice,
  resolveProductSellingPrice,
} from '@/lib/shop-product-pricing';
import type { ShopProduct } from './shop-types';
import { normalizeProductImagesList } from '@/lib/product-listing-image';

export function mapApiRowToShopProduct(p: Record<string, unknown>): ShopProduct | null {
  const id = canonicalProductId(p);
  if (!id) return null;

  const compareAt = resolveProductCompareAtPrice(p);
  const sellingPrice = resolveProductSellingPrice(p, compareAt);
  const rc = Number(p.review_count ?? 0) || 0;
  const rawRating = p.rating != null ? Number(p.rating) : NaN;
  const rating = rc > 0 && Number.isFinite(rawRating) && rawRating > 0 ? rawRating : 0;
  const hasVariants = Boolean(p.has_variants ?? p.has_variations);
  const listingSkuIdRaw = p.listing_sku_id ?? p.default_sku_id;
  const listingSkuId =
    listingSkuIdRaw != null && String(listingSkuIdRaw).trim()
      ? String(listingSkuIdRaw).trim()
      : undefined;
  const listingOptionValues = normalizeOptionValues(
    (p.listing_option_values ?? p.default_option_values) as
      | Record<string, unknown>
      | undefined,
  );

  return {
    ...(p as unknown as ShopProduct),
    id,
    stock: Number(p.stock_quantity ?? p.stock ?? 0) || 0,
    price: sellingPrice,
    original_price: listPriceForDiscountDisplay(sellingPrice, compareAt),
    rating,
    review_count: rc,
    images: normalizeProductImagesList(p.images),
    thumbUrl:
      typeof p.thumbUrl === 'string' && p.thumbUrl.trim()
        ? p.thumbUrl.trim()
        : typeof p.thumb_url === 'string' && p.thumb_url.trim()
          ? p.thumb_url.trim()
          : undefined,
    emoji: (p.emoji as string) || '🐾',
    name: String(p.name ?? ''),
    description: String(p.description ?? ''),
    category_id: String(p.category_id ?? ''),
    vendor_id: String(p.vendor_id ?? ''),
    vendor_name: '',
    is_active: p.is_active !== false,
    has_variants: hasVariants,
    listing_sku_id: hasVariants ? listingSkuId : undefined,
    listing_option_values:
      hasVariants && Object.keys(listingOptionValues).length > 0
        ? listingOptionValues
        : undefined,
    price_from: Boolean(p.price_from),
    min_price:
      p.min_price != null && Number.isFinite(Number(p.min_price))
        ? Number(p.min_price)
        : undefined,
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

/**
 * Client-side sort fallback — kept for non-shop contexts (e.g. recommendation carousels).
 * The main shop page now sends `sort` to the server; do not re-apply this on the shop catalog.
 */
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
