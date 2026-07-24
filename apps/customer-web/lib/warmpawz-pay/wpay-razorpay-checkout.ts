import { apiClient } from '@/lib/api-client';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  fetchCheckoutEmailForPrefill,
} from '@/lib/razorpay/build-standard-checkout-options';
import { loadRazorpayScript } from '@/lib/razorpay/razorpay-utils';

export type WpayInitiateResponse = {
  success?: boolean;
  paymentId?: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  amount?: number;
  currency?: string;
  originalAmount?: number;
  discountAmount?: number;
  payableAmount?: number;
  error?: string;
};

export type WpayVerifyResponse = {
  success?: boolean;
  paymentId?: string;
  originalAmount?: number;
  discountAmount?: number;
  payableAmount?: number;
  savedAmount?: number;
  error?: string;
};

export async function runWpayRazorpayCheckout(params: {
  vendorId: string;
  vendorName: string;
  originalAmount: number;
  customerPhone: string;
}): Promise<WpayVerifyResponse> {
  const { vendorId, vendorName, originalAmount, customerPhone } = params;

  const initiate = (await apiClient.post('/customer/warmpawz-pay/initiate', {
    vendorId,
    originalAmount,
    phone: customerPhone,
  })) as WpayInitiateResponse;

  if (!initiate?.success || !initiate.razorpayOrderId || !initiate.razorpayKeyId || !initiate.paymentId) {
    throw new Error(initiate?.error || 'Failed to start payment');
  }

  const payableAmount = Number(initiate.payableAmount ?? initiate.amount ?? 0);
  if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
    throw new Error('Invalid payable amount');
  }

  await loadRazorpayScript();
  const checkoutEmail = await fetchCheckoutEmailForPrefill(customerPhone);
  const paymentId = String(initiate.paymentId);

  const verifyPayload = {
    paymentId,
    phone: customerPhone,
  };

  return new Promise<WpayVerifyResponse>((resolve, reject) => {
    const options = buildSanitizedStandardRazorpayCheckoutOptions({
      key: initiate.razorpayKeyId!,
      amountPaise: Math.max(1, Math.round(payableAmount * 100)),
      currency: initiate.currency || 'INR',
      name: 'Warmpawz',
      description: `Warmpawz Pay — ${vendorName}`,
      order_id: initiate.razorpayOrderId,
      customerPhone,
      customerEmail: checkoutEmail,
      includeInstrumentBlocks: true,
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          const verified = (await apiClient.post('/customer/warmpawz-pay/verify', {
            ...verifyPayload,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          })) as WpayVerifyResponse;
          if (!verified?.success) {
            throw new Error(verified?.error || 'Payment verification failed');
          }
          resolve(verified);
        } catch (e: unknown) {
          reject(e instanceof Error ? e : new Error('Payment verification failed'));
        }
      },
      theme: { color: '#FF8C42' },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });

    const RazorpayCtor = (window as unknown as { Razorpay?: new (o: Record<string, unknown>) => { open: () => void } })
      .Razorpay;
    if (!RazorpayCtor) {
      reject(new Error('Payment gateway not available'));
      return;
    }
    const rz = new RazorpayCtor(options);
    rz.open();
  });
}
