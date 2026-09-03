import type { Context } from 'hono';
import { getRazorpayConfig } from '../../../../utils/payments/razorpay-client';
import { resolveWpayAuthenticatedCustomer } from '../shared/wpay-authenticated-customer';
import { verifyWpayRazorpaySignature } from '../../../../utils/wpay-razorpay-order';
import { dbWpayPaymentByIdForCustomer } from '../repos/wpay-payment.repo';
import {
  dbWpayAtomicCompleteVerify,
  WpayCreditConsumeConflictError,
} from '../repos/wpay-verify-transaction.repo';
import { accrueWpaySettlement } from '../shared/accrue-wpay-settlement';
import { resolveWpayDiscountPercent } from '../shared/wpay-discount';
import { dbWpayVendorById } from '../repos/wpay-vendor-detail.repo';
import { notifyWpayPaymentCompleted } from '../../../../utils/wpay-notifications';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readMetadataNumber(meta: Record<string, unknown> | null, key: string): number | null {
  if (!meta) return null;
  const raw = meta[key];
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function tryAccrueWpaySettlement(
  payment: NonNullable<Awaited<ReturnType<typeof dbWpayPaymentByIdForCustomer>>>,
): Promise<void> {
  try {
    await accrueWpaySettlement(payment);
  } catch (error) {
    console.error('[customer/warmpawz-pay/verify] settlement accrual failed', error);
  }
}

function tryNotifyWpayVendor(paymentId: string): void {
  void notifyWpayPaymentCompleted(paymentId).catch((error) => {
    console.error('[customer/warmpawz-pay/verify] vendor notify failed', error);
  });
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

    const identity = await resolveWpayAuthenticatedCustomer(c, phone);
    if (!identity.ok) {
      return c.json({ success: false, error: identity.error }, identity.status);
    }
    const customerId = identity.customerId;

    const existing = await dbWpayPaymentByIdForCustomer(paymentId, customerId);
    if (!existing) {
      return c.json({ success: false, error: 'Payment not found' }, 404);
    }

    if (existing.payment_status === 'completed') {
      await tryAccrueWpaySettlement(existing);
      tryNotifyWpayVendor(paymentId);
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
    const originalAmount =
      readMetadataNumber(meta, 'quotedOriginalAmount') ?? readMetadataNumber(meta, 'quotedAmount');
    const discountAmount = readMetadataNumber(meta, 'quotedDiscountAmount');
    if (originalAmount == null || discountAmount == null) {
      return c.json({ success: false, error: 'Payment quote missing' }, 400);
    }

    const vendorId = String(existing.vendor_id ?? '');
    const vendorRow = vendorId ? await dbWpayVendorById(vendorId) : null;
    if (!vendorRow) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }

    // Force discount percent resolution for side-effect-free vendor presence check.
    void (
      readMetadataNumber(meta, 'quotedDiscountPercent') ??
      readMetadataNumber(meta, 'discountPercentSnapshot') ??
      resolveWpayDiscountPercent(vendorRow)
    );

    // Appointment credit unwired — never consume credit rows for new Pay Bill payments.
    let completed;
    try {
      completed = await dbWpayAtomicCompleteVerify({
        paymentId,
        customerId,
        razorpayPaymentId,
        razorpaySignature,
        originalAmount,
        discountAmount,
        bookingId: null,
        creditAmount: 0,
      });
    } catch (error) {
      if (error instanceof WpayCreditConsumeConflictError) {
        return c.json({ success: false, error: error.message }, 409);
      }
      throw error;
    }

    if (!completed) {
      return c.json({ success: false, error: 'Failed to complete payment' }, 500);
    }

    await tryAccrueWpaySettlement(completed);
    tryNotifyWpayVendor(paymentId);

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
