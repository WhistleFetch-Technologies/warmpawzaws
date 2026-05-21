/**
 * Shared cart persistence for shop flows. Next.js `/cart` and `/checkout`
 * read `warmpawz_cart` from localStorage — embedded ProductDetailPage must
 * write here on Buy Now or the cart route shows empty.
 */
export const WARMPAWZ_CART_KEY = 'warmpawz_cart';

/** Dispatched after any same-tab write to `WARMPAWZ_CART_KEY` (see `CartProvider`). */
export const CART_UPDATED_EVENT = 'cart-updated';

export type WarmpawzCartProductSnapshot = {
  id: string;
  name: string;
  price: number;
  original_price?: number;
  emoji?: string;
  images?: string[];
  vendor_name?: string;
  stock: number;
};

export type WarmpawzCartLine = {
  product_id: string;
  product: WarmpawzCartProductSnapshot;
  quantity: number;
  selected_variations?: Record<string, string>;
};

export function readWarmpawzCartLines(): WarmpawzCartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WARMPAWZ_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as WarmpawzCartLine[]) : [];
  } catch {
    return [];
  }
}

export function emitWarmpawzCartUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
}

export function clearWarmpawzCartStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(WARMPAWZ_CART_KEY);
  } catch {
    /* ignore */
  }
  emitWarmpawzCartUpdated();
}

/** Set absolute line quantity (PDP +/-, Update Cart). Removes line when quantity is 0. */
export function setLineQuantityInWarmpawzCartStorage(params: {
  lineId: string;
  quantity: number;
  product: WarmpawzCartProductSnapshot;
  selectedVariations?: Record<string, string>;
}): boolean {
  if (typeof window === 'undefined' || !params.lineId) return false;
  const qty = Math.max(0, Math.floor(params.quantity));
  try {
    const cart = readWarmpawzCartLines();
    const existingIndex = cart.findIndex(
      (item) => String(item.product_id) === String(params.lineId)
    );

    if (qty <= 0) {
      if (existingIndex >= 0) cart.splice(existingIndex, 1);
    } else if (existingIndex >= 0) {
      cart[existingIndex].quantity = qty;
      cart[existingIndex].product = params.product;
      if (params.selectedVariations && Object.keys(params.selectedVariations).length > 0) {
        cart[existingIndex].selected_variations = params.selectedVariations;
      }
    } else {
      cart.push({
        product_id: params.lineId,
        product: params.product,
        quantity: qty,
        selected_variations:
          params.selectedVariations && Object.keys(params.selectedVariations).length > 0
            ? params.selectedVariations
            : undefined,
      });
    }

    localStorage.setItem(WARMPAWZ_CART_KEY, JSON.stringify(cart));
    emitWarmpawzCartUpdated();
    return true;
  } catch (e) {
    console.error('[warmpawz_cart] set quantity failed', e);
    return false;
  }
}

export function mergeLineIntoWarmpawzCartStorage(params: {
  lineId: string;
  quantity: number;
  product: WarmpawzCartProductSnapshot;
  selectedVariations?: Record<string, string>;
}): boolean {
  if (typeof window === 'undefined' || !params.lineId) return false;
  try {
    const cart = JSON.parse(
      localStorage.getItem(WARMPAWZ_CART_KEY) || '[]'
    ) as WarmpawzCartLine[];
    const existingIndex = cart.findIndex(
      (item) => String(item.product_id) === String(params.lineId)
    );

    if (existingIndex >= 0) {
      cart[existingIndex].quantity += params.quantity;
    } else {
      cart.push({
        product_id: params.lineId,
        product: params.product,
        quantity: params.quantity,
        selected_variations:
          params.selectedVariations && Object.keys(params.selectedVariations).length > 0
            ? params.selectedVariations
            : undefined,
      });
    }

    localStorage.setItem(WARMPAWZ_CART_KEY, JSON.stringify(cart));
    emitWarmpawzCartUpdated();
    return true;
  } catch (e) {
    console.error('[warmpawz_cart] merge failed', e);
    return false;
  }
}
