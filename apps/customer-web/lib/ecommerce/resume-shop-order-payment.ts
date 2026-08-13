import { apiClient } from '@/lib/api-client';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  fetchCheckoutEmailForPrefill,
} from '@/lib/razorpay/build-standard-checkout-options';
import { buildRazorpayEcommerceCreateOrderPayload } from '@/lib/ecommerce/ecommerce-razorpay-payload';

export const SHOP_PENDING_ORDER_STORAGE_KEY = 'shop_pending_order_id';

const MAX_VERIFY_RETRIES = 3;

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

async function verifyShopPaymentWithRetries(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<void> {
  for (let attempt = 1; attempt <= MAX_VERIFY_RETRIES; attempt++) {
    try {
      const verifyRes = await apiClient.post<{
        success?: boolean;
        error?: string;
        message?: string;
      }>('/razorpay/verify-payment', payload, undefined, 30000);
      if (verifyRes?.success === false) {
        throw new Error(verifyRes?.error || verifyRes?.message || 'Payment verification failed');
      }
      return;
    } catch (verifyErr) {
      if (attempt === MAX_VERIFY_RETRIES) {
        throw verifyErr;
      }
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
}

async function reconcilePendingShopOrderPayment(orderId: string): Promise<boolean> {
  try {
    const res = await apiClient.post<{
      success?: boolean;
      paid?: boolean;
    }>(`/customer/orders/${orderId}/reconcile-payment`, {});
    return Boolean(res?.paid);
  } catch {
    try {
      const resume = await apiClient.get<{
        paid?: boolean;
        canResume?: boolean;
      }>(`/customer/orders/${orderId}/payment-resume`);
      return Boolean(resume?.paid);
    } catch {
      return false;
    }
  }
}

let shopPaymentReturnPollInstalled = false;

function installShopPaymentReturnPoll(onPaid: (orderId: string) => void): void {
  if (typeof window === 'undefined' || shopPaymentReturnPollInstalled) return;
  shopPaymentReturnPollInstalled = true;

  const poll = async () => {
    const orderId = readShopPendingOrderId();
    if (!orderId) return;
    const paid = await reconcilePendingShopOrderPayment(orderId);
    if (paid) {
      clearShopPendingOrderId();
      onPaid(orderId);
    }
  };

  const handleReturn = () => {
    if (document.visibilityState === 'hidden') return;
    void poll();
  };

  document.addEventListener('visibilitychange', handleReturn);
  window.addEventListener('pageshow', handleReturn);
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
  razorpayOrderId?: string | null;
  onSuccess?: (orderId: string) => void;
  onDismiss?: () => void;
};

/**
 * Opens Razorpay for an existing shop order (resume pay). Does not create a new ecommerce order.
 */
export async function resumeShopOrderPayment(options: ResumeShopOrderPaymentOptions): Promise<void> {
  const { orderId, payableAmount, customerId, phone, prefillName, razorpayOrderId, onSuccess, onDismiss } = options;

  installShopPaymentReturnPoll((paidOrderId) => {
    onSuccess?.(paidOrderId);
  });

  const razorpayPayload = buildRazorpayEcommerceCreateOrderPayload(
    orderId,
    payableAmount,
    customerId
  );

  let razorpayOrder: {
    orderId: string;
    keyId: string;
    amount: number;
    currency: string;
    fullyCoveredByWallet?: boolean;
  };

  if (razorpayOrderId && process.env.NEXT_PUBLIC_RAZORPAY_KEY) {
    razorpayOrder = {
      orderId: razorpayOrderId,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY,
      amount: payableAmount,
      currency: 'INR',
    };
  } else {
    razorpayOrder = await apiClient.post<{
      orderId: string;
      keyId: string;
      amount: number;
      currency: string;
      fullyCoveredByWallet?: boolean;
    }>('/razorpay/create-order', razorpayPayload);
  }

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
          await verifyShopPaymentWithRetries({
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
