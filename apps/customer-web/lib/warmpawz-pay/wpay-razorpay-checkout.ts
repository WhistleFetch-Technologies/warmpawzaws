import { apiClient } from '@/lib/api-client';
import { fetchCheckoutEmailForPrefill } from '@/lib/razorpay/build-standard-checkout-options';
import {
  digitsToRazorpayContactE164,
  loadRazorpayScript,
  razorpaySafeDescription,
  sanitizeRazorpayInstanceOptions,
} from '@/lib/razorpay/razorpay-utils';

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
  bookingId?: string | null;
}): Promise<WpayVerifyResponse> {
  const { vendorId, vendorName, originalAmount, customerPhone, bookingId } = params;

  const initiate = (await apiClient.post('/customer/warmpawz-pay/initiate', {
    vendorId,
    originalAmount,
    phone: customerPhone,
    ...(bookingId ? { bookingId } : {}),
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

  await loadRazorpayScript();
  const checkoutEmail = await fetchCheckoutEmailForPrefill(customerPhone);
  const paymentId = String(initiate.paymentId);

  const verifyPayload = {
    paymentId,
    phone: customerPhone,
  };

  const phoneDigits = String(customerPhone).replace(/\D/g, '');
  const e164 = digitsToRazorpayContactE164(phoneDigits);
  const prefill: Record<string, string> = {};
  if (e164) prefill.contact = e164;
  const emailTrim =
    typeof checkoutEmail === 'string' && checkoutEmail.includes('@') ? checkoutEmail.trim() : '';
  if (emailTrim && emailTrim !== 'undefined' && emailTrim !== 'null') {
    prefill.email = emailTrim;
  }

  const paymentDescription = razorpaySafeDescription(`Warmpawz Pay - ${vendorName}`);

  return new Promise<WpayVerifyResponse>((resolve, reject) => {
    const rawOptions: Record<string, unknown> = {
      key: initiate.razorpayKeyId!,
      amount: amountPaise,
      currency: initiate.currency || 'INR',
      name: 'Warmpawz',
      description: paymentDescription,
      order_id: initiate.razorpayOrderId,
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
      ...(Object.keys(prefill).length > 0 ? { prefill } : {}),
      theme: { color: '#FF8C42', hide_topbar: true },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    };

    const options = sanitizeRazorpayInstanceOptions(rawOptions);

    const RazorpayCtor = (window as unknown as {
      Razorpay?: new (o: Record<string, unknown>) => {
        open: () => void;
        on: (event: string, cb: (resp: unknown) => void) => void;
      };
    }).Razorpay;
    if (!RazorpayCtor) {
      reject(new Error('Payment gateway not available'));
      return;
    }

    const rz = new RazorpayCtor(options);
    rz.on('payment.failed', (resp: unknown) => {
      const err = resp as { error?: { description?: string; reason?: string } } | null;
      const msg = err?.error?.description || err?.error?.reason || 'Payment failed';
      reject(new Error(msg));
    });
    rz.open();
  });
}
