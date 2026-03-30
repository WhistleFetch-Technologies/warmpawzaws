/**
 * Shared cart persistence for shop flows. Next.js `/cart` and `/checkout`
 * read `warmpawz_cart` from localStorage — embedded ProductDetailPage must
 * write here on Buy Now or the cart route shows empty.
 */
export const WARMPAWZ_CART_KEY = 'warmpawz_cart';

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
    window.dispatchEvent(new CustomEvent('cart-updated'));
    return true;
  } catch (e) {
    console.error('[warmpawz_cart] merge failed', e);
    return false;
  }
}
