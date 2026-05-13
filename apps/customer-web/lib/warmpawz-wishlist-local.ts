/**
 * Client-side wishlist ids (same key as `/shop` and product detail).
 * Dispatches `WISHLIST_UPDATED_EVENT` so other components can refresh heart state.
 */
export const WARMPAWZ_WISHLIST_KEY = 'warmpawz_wishlist';

export const WISHLIST_UPDATED_EVENT = 'wishlist-updated';

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
