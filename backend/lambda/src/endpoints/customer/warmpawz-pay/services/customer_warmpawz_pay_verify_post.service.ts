import type { Context } from 'hono';
import { resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import { getRazorpayConfig } from '../../../../utils/payments/razorpay-client';
import { verifyWpayRazorpaySignature } from '../../../../utils/wpay-razorpay-order';
import { dbWpayCompletePayment, dbWpayPaymentByIdForCustomer } from '../repos/wpay-payment.repo';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readMetadataNumber(meta: Record<string, unknown> | null, key: string): number | null {
  if (!meta) return null;
  const raw = meta[key];
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function executeCustomerWarmpawzPayVerifyPost(c: Context) {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      paymentId?: string;
      phone?: string;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    const paymentId = String(body.paymentId ?? '').trim();
    const phone = String(body.phone ?? c.req.query('phone') ?? '').trim();
    const razorpayOrderId = String(body.razorpay_order_id ?? '').trim();
    const razorpayPaymentId = String(body.razorpay_payment_id ?? '').trim();
    const razorpaySignature = String(body.razorpay_signature ?? '').trim();

    if (!UUID_RE.test(paymentId)) {
      return c.json({ success: false, error: 'Invalid payment id' }, 400);
    }
    if (!phone) {
      return c.json({ success: false, error: 'Phone is required' }, 400);
    }
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return c.json({ success: false, error: 'Missing Razorpay payment details' }, 400);
    }

    const customerId = await resolveCustomerIdFromPhone(phone);
    if (!customerId) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }

    const existing = await dbWpayPaymentByIdForCustomer(paymentId, customerId);
    if (!existing) {
      return c.json({ success: false, error: 'Payment not found' }, 404);
    }

    if (existing.payment_status === 'completed') {
      return c.json({
        success: true,
        paymentId,
        originalAmount: Number(existing.original_amount ?? 0),
        discountAmount: Number(existing.discount_amount ?? 0),
        payableAmount: Number(existing.amount ?? 0),
        savedAmount: Number(existing.discount_amount ?? 0),
      });
    }

    if (String(existing.razorpay_order_id ?? '') !== razorpayOrderId) {
      return c.json({ success: false, error: 'Order mismatch' }, 400);
    }

    const config = await getRazorpayConfig();
    if (!config?.keySecret) {
      return c.json({ success: false, error: 'Razorpay is not configured' }, 500);
    }

    const valid = verifyWpayRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      config.keySecret,
    );
    if (!valid) {
      return c.json({ success: false, error: 'Invalid payment signature' }, 400);
    }

    const meta = (existing.metadata ?? {}) as Record<string, unknown>;
    const originalAmount = readMetadataNumber(meta, 'quotedOriginalAmount');
    const discountAmount = readMetadataNumber(meta, 'quotedDiscountAmount');
    if (originalAmount == null || discountAmount == null) {
      return c.json({ success: false, error: 'Payment quote missing' }, 400);
    }

    const completed = await dbWpayCompletePayment({
      paymentId,
      customerId,
      razorpayPaymentId,
      razorpaySignature,
      originalAmount,
      discountAmount,
    });
    if (!completed) {
      return c.json({ success: false, error: 'Failed to complete payment' }, 500);
    }

    return c.json({
      success: true,
      paymentId,
      originalAmount,
      discountAmount,
      payableAmount: Number(completed.amount ?? 0),
      savedAmount: discountAmount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to verify payment';
    console.error('[customer/warmpawz-pay/verify]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
