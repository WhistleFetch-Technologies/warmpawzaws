import type { CheckoutAddress } from '@/components/customer/ecommerce/useEcommerceCheckout';

export type StoredCheckoutOrderResponse = {
  orderId: string;
  orderNumber?: string;
  totalAmount?: number;
  phone?: string;
  email?: string;
  shippingAddress?: CheckoutAddress;
  status?: string;
  paymentMethod?: 'online';
  shippingMethod?: 'standard' | 'express' | 'scheduled';
};

export const WARMPAWZ_CHECKOUT_ORDER_KEY = 'warmpawz_checkout_order_response';

export function persistCheckoutOrderResponse(data: StoredCheckoutOrderResponse): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(WARMPAWZ_CHECKOUT_ORDER_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function readCheckoutOrderResponse(): StoredCheckoutOrderResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(WARMPAWZ_CHECKOUT_ORDER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCheckoutOrderResponse;
  } catch {
    return null;
  }
}

export function clearCheckoutOrderResponse(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(WARMPAWZ_CHECKOUT_ORDER_KEY);
  } catch {
    /* ignore */
  }
}
