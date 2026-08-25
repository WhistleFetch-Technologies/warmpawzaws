/**
 * Shared Warmpawz Razorpay Standard Checkout opener.
 *
 * Owns script load, options (via {@link buildSanitizedStandardRazorpayCheckoutOptions}),
 * `new Razorpay`, common `payment.failed` wiring, and `.open()`.
 * Callers own order creation, amount authority, and verification.
 */

import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  type BuildStandardRazorpayCheckoutOptionsInput,
} from '@/lib/razorpay/build-standard-checkout-options';
import { loadRazorpayScript } from '@/lib/razorpay/razorpay-utils';

export type OpenWarmpawzRazorpayCheckoutInput = BuildStandardRazorpayCheckoutOptionsInput & {
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
 * Load checkout.js, apply the shared UPI-first Warmpawz Checkout options, and open Razorpay.
 * Does not calculate or alter the caller's `amountPaise`.
 */
export async function openWarmpawzRazorpayCheckout(
  input: OpenWarmpawzRazorpayCheckoutInput
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
