/**
 * Canonical Warmpawz Razorpay Standard Checkout opener.
 *
 * Mechanics recovered from the Aug 5–Aug 25 Pay Bill implementation:
 * load checkout.js → build minimal options → sanitize → `new Razorpay`
 * → `payment.failed` → `.open()`.
 *
 * Callers own order creation, amount authority, verification, and
 * dismiss / failure business state (Pay Bill reject, Appointment slot
 * abandon, shop resume, etc.).
 */

import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  type BuildStandardRazorpayCheckoutOptionsInput,
} from '@/lib/razorpay/build-standard-checkout-options';
import { loadRazorpayScript } from '@/lib/razorpay/razorpay-utils';

export type OpenStandardRazorpayCheckoutInput = BuildStandardRazorpayCheckoutOptionsInput & {
  onPaymentFailed?: (error: Error) => void;
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on?: (event: string, cb: (resp: unknown) => void) => void;
};

function paymentFailedMessage(resp: unknown): string {
  const err = resp as { error?: { description?: string; reason?: string } } | null;
  return err?.error?.description || err?.error?.reason || 'Payment failed';
}

/**
 * Load checkout.js, apply the canonical minimal Standard Checkout options, and open Razorpay.
 * Does not calculate or alter the caller's `amountPaise`.
 */
export async function openStandardRazorpayCheckout(
  input: OpenStandardRazorpayCheckoutInput
): Promise<void> {
  const { onPaymentFailed, ...builderInput } = input;

  await loadRazorpayScript();

  const RazorpayCtor = (
    window as unknown as {
      Razorpay?: new (o: Record<string, unknown>) => RazorpayCheckoutInstance;
    }
  ).Razorpay;
  if (!RazorpayCtor) {
    throw new Error('Payment gateway not available');
  }

  const options = buildSanitizedStandardRazorpayCheckoutOptions(builderInput);
  const rz = new RazorpayCtor(options);

  if (onPaymentFailed && typeof rz.on === 'function') {
    rz.on('payment.failed', (resp: unknown) => {
      onPaymentFailed(new Error(paymentFailedMessage(resp)));
    });
  }

  rz.open();
}
