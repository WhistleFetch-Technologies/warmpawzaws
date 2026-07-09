import { apiClient } from '@/lib/api-client';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  fetchCheckoutEmailForPrefill,
} from '@/lib/razorpay/build-standard-checkout-options';
import { buildRazorpayEcommerceCreateOrderPayload } from '@/lib/ecommerce/ecommerce-razorpay-payload';

export const SHOP_PENDING_ORDER_STORAGE_KEY = 'shop_pending_order_id';

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('No document'));
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

export function persistShopPendingOrderId(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SHOP_PENDING_ORDER_STORAGE_KEY, orderId);
  } catch {
    /* ignore */
  }
}

export function clearShopPendingOrderId(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SHOP_PENDING_ORDER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function readShopPendingOrderId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = sessionStorage.getItem(SHOP_PENDING_ORDER_STORAGE_KEY);
    return id?.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

export type ResumeShopOrderPaymentOptions = {
  orderId: string;
  payableAmount: number;
  customerId: string;
  phone?: string;
  prefillName?: string;
  onSuccess?: (orderId: string) => void;
  onDismiss?: () => void;
};

/**
 * Opens Razorpay for an existing shop order (resume pay). Does not create a new ecommerce order.
 */
export async function resumeShopOrderPayment(options: ResumeShopOrderPaymentOptions): Promise<void> {
  const { orderId, payableAmount, customerId, phone, prefillName, onSuccess, onDismiss } = options;

  const razorpayPayload = buildRazorpayEcommerceCreateOrderPayload(
    orderId,
    payableAmount,
    customerId
  );

  const razorpayOrder = await apiClient.post<{
    orderId: string;
    keyId: string;
    amount: number;
    currency: string;
    fullyCoveredByWallet?: boolean;
  }>('/razorpay/create-order', razorpayPayload);

  if (razorpayOrder?.fullyCoveredByWallet) {
    clearShopPendingOrderId();
    onSuccess?.(orderId);
    return;
  }

  if (!razorpayOrder?.orderId) {
    throw new Error('Failed to create payment order');
  }

  if (!(typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay)) {
    await loadRazorpayScript();
  }

  const checkoutEmail = phone ? await fetchCheckoutEmailForPrefill(phone) : undefined;

  await new Promise<void>((resolve, reject) => {
    const checkoutOptions = buildSanitizedStandardRazorpayCheckoutOptions({
      key: razorpayOrder.keyId,
      amountPaise: Math.max(1, Math.round(Number(razorpayOrder.amount) * 100)),
      currency: razorpayOrder.currency || 'INR',
      name: 'Warmpawz',
      description: 'Order Payment',
      order_id: razorpayOrder.orderId,
      customerPhone: phone,
      customerEmail: checkoutEmail,
      prefillName,
      includeInstrumentBlocks: true,
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          await apiClient.post('/razorpay/verify-payment', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          clearShopPendingOrderId();
          onSuccess?.(orderId);
          resolve();
        } catch (err) {
          reject(err);
        }
      },
      theme: { color: '#FF8C42' },
      modal: {
        ondismiss: () => {
          onDismiss?.();
          reject(new Error('Payment cancelled'));
        },
      },
    });

    const RazorpayCtor = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } })
      .Razorpay;
    if (!RazorpayCtor) {
      reject(new Error('Razorpay not available'));
      return;
    }
    const razorpay = new RazorpayCtor(checkoutOptions);
    razorpay.open();
  });
}
