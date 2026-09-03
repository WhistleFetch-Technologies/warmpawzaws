import { apiClient } from '@/lib/api-client';
import { fetchCheckoutEmailForPrefill } from '@/lib/razorpay/build-standard-checkout-options';
import { openStandardRazorpayCheckout } from '@/lib/razorpay/open-standard-razorpay-checkout';
import { razorpaySafeDescription } from '@/lib/razorpay/razorpay-utils';

export type WpayInitiateResponse = {
  success?: boolean;
  paymentId?: string;
  razorpayOrderId?: string;
  razorpayKeyId?: string;
  amount?: number;
  amountPaise?: number;
  currency?: string;
  originalAmount?: number;
  appointmentFeeCredit?: number;
  billBase?: number;
  discountAmount?: number;
  payableAmount?: number;
  bookingId?: string | null;
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

  const amountPaise =
    typeof initiate.amountPaise === 'number' && Number.isFinite(initiate.amountPaise)
      ? Math.max(1, Math.round(initiate.amountPaise))
      : Math.max(1, Math.round(Number(initiate.amount ?? payableAmount) * 100));

  const checkoutEmail = await fetchCheckoutEmailForPrefill(customerPhone);
  const paymentId = String(initiate.paymentId);

  const verifyPayload = {
    paymentId,
    phone: customerPhone,
  };

  const paymentDescription = razorpaySafeDescription(`Warmpawz Pay - ${vendorName}`);

  return new Promise<WpayVerifyResponse>((resolve, reject) => {
    void openStandardRazorpayCheckout({
      key: initiate.razorpayKeyId!,
      amountPaise,
      currency: initiate.currency || 'INR',
      name: 'Warmpawz',
      description: paymentDescription,
      order_id: initiate.razorpayOrderId,
      customerPhone,
      customerEmail: checkoutEmail,
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
      onPaymentFailed: reject,
    }).catch(reject);
  });
}
