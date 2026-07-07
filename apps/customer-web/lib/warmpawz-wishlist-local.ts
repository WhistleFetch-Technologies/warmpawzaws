/**
 * Client-side wishlist ids (same key as `/shop` and product detail).
 * Dispatches `WISHLIST_UPDATED_EVENT` so other components can refresh heart state.
 */
import { isCustomerDatabaseUuid } from '@/lib/customer-id-storage';

export const WARMPAWZ_WISHLIST_KEY = 'warmpawz_wishlist';

export const WISHLIST_UPDATED_EVENT = 'wishlist-updated';

export type WishlistApiItem = {
  product_id?: string;
  id?: string;
  product?: { id?: string };
};

export function readWishlistIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(WARMPAWZ_WISHLIST_KEY) || '[]') as unknown;
    return Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function setWishlistIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WARMPAWZ_WISHLIST_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(WISHLIST_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

/** Product id from API wishlist row — never use row `id` (wishlist entry UUID). */
export function extractWishlistProductId(item: WishlistApiItem | null | undefined): string {
  if (!item || typeof item !== 'object') return '';
  const fromProductId = item.product_id != null ? String(item.product_id).trim() : '';
  if (fromProductId) return fromProductId;
  const fromNested =
    item.product?.id != null ? String(item.product.id).trim() : '';
  return fromNested;
}

/** Union local ids with API product ids; local list is never shrunk. */
export function mergeWishlistIds(localIds: string[], apiItems: WishlistApiItem[]): string[] {
  const merged = [...new Set(localIds.map(String).filter(Boolean))];
  for (const it of apiItems) {
    const pid = extractWishlistProductId(it);
    if (pid && !merged.some((x) => String(x) === pid)) {
      merged.push(pid);
    }
  }
  return merged;
}

export function sameWishlistIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a.map(String));
  for (const x of b) {
    if (!sa.has(String(x))) return false;
  }
  return true;
}

export function canSyncWishlistToApi(
  customerId: string | null | undefined,
  productId: string | null | undefined
): boolean {
  const cid = (customerId || '').trim();
  const pid = (productId || '').trim();
  return isCustomerDatabaseUuid(cid) && isCustomerDatabaseUuid(pid);
}
