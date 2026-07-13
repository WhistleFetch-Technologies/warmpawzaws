import { canonicalProductId } from '@/lib/product-id';
import { normalizeOptionValues } from '@/lib/product-sku-client';
import {
  getProductDiscountPercent as discountPercentFromPrices,
  listPriceForDiscountDisplay,
  productHasListDiscount,
  resolveProductCompareAtPrice,
  resolveProductSellingPrice,
} from '@/lib/shop-product-pricing';
import type { ShopProduct } from './shop-types';

export function mapApiRowToShopProduct(p: Record<string, unknown>): ShopProduct | null {
  const id = canonicalProductId(p);
  if (!id) return null;

  const compareAt = resolveProductCompareAtPrice(p);
  const enrichedSelling = resolveProductSellingPrice(p, compareAt);
  /** Option A: cart/checkout use catalog MRP; browse may show enrichedSelling separately. */
  const catalogPrice = compareAt ?? enrichedSelling;
  const hasBrowseDiscount = productHasListDiscount(enrichedSelling, compareAt);
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

  const promoAppliedRaw = p.promo_applied;
  const promo_applied =
    promoAppliedRaw != null &&
    typeof promoAppliedRaw === 'object' &&
    !Array.isArray(promoAppliedRaw)
      ? {
          source: ((promoAppliedRaw as { source?: string }).source === 'admin'
            ? 'admin'
            : 'vendor') as 'vendor' | 'admin',
          id: String((promoAppliedRaw as { id?: string }).id ?? ''),
          label: String((promoAppliedRaw as { label?: string }).label ?? 'Promotion'),
          discountPercent:
            Number((promoAppliedRaw as { discountPercent?: number }).discountPercent) || 0,
        }
      : undefined;

  return {
    ...(p as unknown as ShopProduct),
    id,
    stock: Number(p.stock_quantity ?? p.stock ?? 0) || 0,
    price: catalogPrice,
    display_price: hasBrowseDiscount ? enrichedSelling : undefined,
    original_price: listPriceForDiscountDisplay(enrichedSelling, compareAt),
    rating,
    review_count: rc,
    images: (p.images as string[]) || [],
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
    promo_applied: promo_applied?.id ? promo_applied : undefined,
  };
}

export function mapApiProductsList(rawList: unknown[]): ShopProduct[] {
  return rawList
    .map((row) => mapApiRowToShopProduct(row as Record<string, unknown>))
    .filter((p): p is ShopProduct => Boolean(p));
}

export function getProductDiscountPercent(product: ShopProduct): number {
  const selling = product.display_price ?? product.price;
  return discountPercentFromPrices(selling, product.original_price);
}

/** Customer-facing unit price on shop cards (may differ from cart MRP when a browse promo applies). */
export function getShopProductDisplayPrice(product: ShopProduct): number {
  return product.display_price ?? product.price;
}

/**
 * Client-side sort fallback — kept for non-shop contexts (e.g. recommendation carousels).
 * The main shop page now sends `sort` to the server; do not re-apply this on the shop catalog.
 */
export function sortShopProducts(products: ShopProduct[], sortBy: string): ShopProduct[] {
  const list = [...products];
  switch (sortBy) {
    case 'price_low':
      return list.sort(
        (a, b) => getShopProductDisplayPrice(a) - getShopProductDisplayPrice(b),
      );
    case 'price_high':
      return list.sort(
        (a, b) => getShopProductDisplayPrice(b) - getShopProductDisplayPrice(a),
      );
    case 'rating':
      return list.sort((a, b) => b.rating - a.rating);
    case 'newest':
      return list;
    default:
      return list.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
  }
}
