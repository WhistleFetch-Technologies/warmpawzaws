import { apiClient } from '@/lib/api-client';
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

export async function fetchWishlistProductSummary(
  storageKey: string
): Promise<WishlistProductRow> {
  const paths = [
    `/ecommerce/products/${encodeURIComponent(storageKey)}`,
    `/products/${encodeURIComponent(storageKey)}`,
  ];
  for (const path of paths) {
    try {
      const res = await apiClient.get<{ product?: Record<string, unknown> }>(path);
      const p = res?.product;
      if (!p || typeof p !== 'object') continue;
      const id = canonicalProductId(p as Record<string, unknown>) || storageKey;
      const images = p.images as unknown;
      const firstImg =
        Array.isArray(images) && images[0] != null ? String(images[0]) : undefined;
      return {
        storageKey,
        id,
        name: String(p.name ?? 'Product'),
        price: parseFloat(String(p.price ?? '0')) || 0,
        image: firstImg,
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
