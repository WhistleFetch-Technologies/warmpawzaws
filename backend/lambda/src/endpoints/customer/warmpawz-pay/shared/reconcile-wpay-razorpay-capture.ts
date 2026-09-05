import { razorpayRequest } from '../../../../utils/payments/razorpay-client';
import type { WpayPaymentRow } from '../repos/wpay-payment.repo';
import { fulfillWpayCapturedPayment } from './fulfill-wpay-captured-payment';

export async function findCapturedRazorpayPaymentId(orderId: string): Promise<string | null> {
  const ord = await razorpayRequest(`/orders/${orderId}`, 'GET', undefined, 8000);
  const amountPaise = Number(ord?.amount ?? 0);
  const paidPaise = Number(ord?.amount_paid ?? 0);
  if (String(ord?.status || '') !== 'paid' || paidPaise + 1 < amountPaise) {
    return null;
  }

  const ops = await razorpayRequest(`/orders/${orderId}/payments`, 'GET', undefined, 8000);
  const captured = (ops?.items || []).find(
    (p: { status?: string; captured?: boolean; id?: string }) =>
      p.status === 'captured' || p.captured === true,
  );
  return captured?.id ? String(captured.id) : null;
}

export async function reconcileWpayRazorpayCapture(
  payment: WpayPaymentRow,
  customerId?: string,
): Promise<WpayPaymentRow | null> {
  if (String(payment.payment_status).toLowerCase() === 'completed' && payment.razorpay_payment_id) {
    return fulfillWpayCapturedPayment({
      paymentId: payment.id,
      razorpayPaymentId: String(payment.razorpay_payment_id),
      customerId,
    });
  }

  const orderId = String(payment.razorpay_order_id ?? '').trim();
  if (!orderId) return null;

  try {
    const razorpayPaymentId = await findCapturedRazorpayPaymentId(orderId);
    if (!razorpayPaymentId) return null;
    return fulfillWpayCapturedPayment({
      paymentId: payment.id,
      razorpayPaymentId,
      customerId,
    });
  } catch (error) {
    console.error('[wpay-reconcile] Razorpay lookup failed', { paymentId: payment.id, error });
    return null;
  }
}
