import type { Context } from 'hono';
import {
  createWpayRazorpayOrder,
  WpayPaymentAlreadyCompletedError,
} from '../../../../utils/wpay-razorpay-order';
import { resolveWpayAuthenticatedCustomer } from '../shared/wpay-authenticated-customer';
import { dbWpayVendorById } from '../repos/wpay-vendor-detail.repo';
import { WpayCommercialValidationError } from '../shared/wpay-discount';
import { resolveWpayPayQuote } from '../shared/wpay-quote-resolver';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function executeCustomerWarmpawzPayInitiatePost(c: Context) {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      vendorId?: string;
      originalAmount?: number;
      phone?: string;
      bookingId?: string;
      clientRequestId?: string;
    };

    const vendorId = String(body.vendorId ?? '').trim();
    const phone = String(body.phone ?? c.req.query('phone') ?? '').trim();
    const originalAmount = Number(body.originalAmount);
    const clientRequestId = String(body.clientRequestId ?? '').trim();

    if (!UUID_RE.test(vendorId)) {
      return c.json({ success: false, error: 'Invalid vendor id' }, 400);
    }
    if (!phone) {
      return c.json({ success: false, error: 'Phone is required' }, 400);
    }
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      return c.json({ success: false, error: 'Invalid bill amount' }, 400);
    }
    // bookingId intentionally ignored — appointment credit unwired from Pay Bill.

    const identity = await resolveWpayAuthenticatedCustomer(c, phone);
    if (!identity.ok) {
      return c.json({ success: false, error: identity.error }, identity.status);
    }
    const customerId = identity.customerId;

    const vendorRow = await dbWpayVendorById(vendorId);
    if (!vendorRow) {
      return c.json({ success: false, error: 'Vendor not found or not available' }, 404);
    }

    const resolved = await resolveWpayPayQuote({
      vendorRow,
      quotedAmount: originalAmount,
    });

    const order = await createWpayRazorpayOrder({
      customerId,
      vendorId,
      payableAmount: resolved.payableAmount,
      bookingId: null,
      clientRequestId: clientRequestId || null,
      quoteMetadata: resolved.metadata,
    });

    if (resolved.commercialModel === 'tier_commission') {
      const q = resolved.quote;
      return c.json({
        success: true,
        paymentId: order.paymentId,
        razorpayOrderId: order.orderId,
        razorpayKeyId: order.keyId,
        amount: order.amount,
        amountPaise: order.amountPaise,
        currency: order.currency,
        commercialModel: 'tier_commission',
        originalAmount: q.quotedAmount,
        discountPercent: q.discountPercent,
        discountAmount: q.discountAmount,
        servicePayableAmount: q.servicePayableAmount,
        appointmentFeeCredit: 0,
        platformFee: q.platformFee,
        platformFeeGstAmount: q.platformFeeGstAmount,
        convenienceFee: q.convenienceFee,
        convenienceGstAmount: q.convenienceGstAmount,
        payableAmount: q.payNowAmount,
        bookingId: null,
      });
    }

    const q = resolved.quote;
    return c.json({
      success: true,
      paymentId: order.paymentId,
      razorpayOrderId: order.orderId,
      razorpayKeyId: order.keyId,
      amount: order.amount,
      amountPaise: order.amountPaise,
      currency: order.currency,
      commercialModel: 'withhold',
      originalAmount: q.originalAmount,
      appointmentFeeCredit: 0,
      billBase: q.billBase,
      discountAmount: q.discountAmount,
      payableAmount: q.payableAmount,
      bookingId: null,
    });
  } catch (error: unknown) {
    if (error instanceof WpayCommercialValidationError) {
      return c.json({ success: false, error: error.message }, 400);
    }
    if (error instanceof WpayPaymentAlreadyCompletedError) {
      return c.json(
        {
          success: false,
          error: error.message,
          paymentId: error.paymentId,
          code: 'WPAY_PAYMENT_ALREADY_COMPLETED',
        },
        409,
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to initiate payment';
    console.error('[customer/warmpawz-pay/initiate]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
