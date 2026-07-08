import { apiClient } from '@/lib/api-client';
import { extractProductImageUrl } from '@/components/customer/home/utils/product-image';
import { canonicalProductId } from '@/lib/product-id';

export type WishlistProductRow = {
  /** Id as stored in `warmpawz_wishlist` — stable React key + localStorage removal. */
  storageKey: string;
  /** Canonical id for `/shop/[id]` and API. */
  id: string;
  name: string;
  price: number;
  image?: string;
  emoji?: string;
  missing?: boolean;
};

function resolveWishlistProductImage(
  product: Record<string, unknown>,
  skus?: unknown
): string | undefined {
  const fromProduct = extractProductImageUrl(product);
  if (fromProduct) return fromProduct;

  if (!Array.isArray(skus)) return undefined;
  for (const sku of skus) {
    if (!sku || typeof sku !== 'object') continue;
    const fromSku = extractProductImageUrl(sku as Record<string, unknown>);
    if (fromSku) return fromSku;
  }
  return undefined;
}

export async function fetchWishlistProductSummary(
  storageKey: string
): Promise<WishlistProductRow> {
  const paths = [
    `/ecommerce/products/${encodeURIComponent(storageKey)}`,
    `/products/${encodeURIComponent(storageKey)}`,
  ];
  for (const path of paths) {
    try {
      const res = await apiClient.get<{
        product?: Record<string, unknown>;
        skus?: unknown[];
      }>(path);
      const p = res?.product;
      if (!p || typeof p !== 'object') continue;
      const id = canonicalProductId(p as Record<string, unknown>) || storageKey;
      const image = resolveWishlistProductImage(p, res.skus);
      return {
        storageKey,
        id,
        name: String(p.name ?? 'Product'),
        price: parseFloat(String(p.price ?? '0')) || 0,
        image,
        emoji: p.emoji != null ? String(p.emoji) : undefined,
      };
    } catch {
      continue;
    }
  }
  return {
    storageKey,
    id: storageKey,
    name: 'Product unavailable',
    price: 0,
    missing: true,
  };
}
