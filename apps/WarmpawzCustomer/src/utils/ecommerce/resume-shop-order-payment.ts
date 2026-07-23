import RazorpayCheckout from 'react-native-razorpay';
import { PaymentApi } from '../../services/api';
import { buildRazorpayEcommerceCreateOrderPayload } from './ecommerce-razorpay-payload';
import {
  applyWarmpawzCustomerToRazorpayOptions,
  profileEmailAndName,
} from '../razorpay-checkout-options';

export type ResumeShopOrderPaymentOptions = {
  orderId: string;
  payableAmount: number;
  customerId: string;
  phone?: string;
  prefillName?: string;
  profile?: unknown;
  onSuccess?: (orderId: string) => void;
  onDismiss?: () => void;
};

/**
 * Opens native Razorpay for an existing shop order (resume pay). Does not create a new ecommerce order.
 */
export async function resumeShopOrderPayment(
  options: ResumeShopOrderPaymentOptions,
): Promise<void> {
  const { orderId, payableAmount, customerId, phone, prefillName, profile, onSuccess, onDismiss } =
    options;

  const razorpayPayload = buildRazorpayEcommerceCreateOrderPayload(
    orderId,
    payableAmount,
    customerId,
  );

  const razorpayOrder = await PaymentApi.createShopRazorpayOrder(razorpayPayload);

  if ((razorpayOrder as { fullyCoveredByWallet?: boolean })?.fullyCoveredByWallet) {
    onSuccess?.(orderId);
    return;
  }

  const order_id =
    (razorpayOrder as { orderId?: string })?.orderId ||
    (razorpayOrder as { order_id?: string })?.order_id;
  if (!order_id) {
    throw new Error('Failed to create payment order');
  }

  const { email: profileEmail, name: profileName } = profileEmailAndName(profile);
  const baseOptions = {
    description: 'Order Payment',
    currency: (razorpayOrder as { currency?: string })?.currency || 'INR',
    key:
      (razorpayOrder as { keyId?: string })?.keyId ||
      (razorpayOrder as { razorpay_key?: string })?.razorpay_key ||
      '',
    amount: Math.max(
      1,
      Math.round(
        Number((razorpayOrder as { amount?: number })?.amount ?? payableAmount) * 100,
      ),
    ),
    name: 'Warmpawz',
    order_id,
    theme: { color: '#FF8C42' },
  };

  const checkoutOptions = applyWarmpawzCustomerToRazorpayOptions(baseOptions, {
    phone: phone || '',
    email: profileEmail,
    name: prefillName || profileName,
  });

  try {
    const razorpayResponse = await RazorpayCheckout.open(checkoutOptions);
    await PaymentApi.verifyShopRazorpayPayment({
      razorpay_order_id: razorpayResponse.razorpay_order_id,
      razorpay_payment_id: razorpayResponse.razorpay_payment_id,
      razorpay_signature: razorpayResponse.razorpay_signature,
    });
    onSuccess?.(orderId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('cancel')) {
      onDismiss?.();
    }
    throw error;
  }
}
