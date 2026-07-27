import type { Context } from 'hono';
import { resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import { createWpayRazorpayOrder } from '../../../../utils/wpay-razorpay-order';
import { dbWpayVendorById } from '../repos/wpay-vendor-detail.repo';
import { computeWpayDiscountQuote, resolveWpayDiscountPercent } from '../shared/wpay-discount';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function executeCustomerWarmpawzPayInitiatePost(c: Context) {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      vendorId?: string;
      originalAmount?: number;
      phone?: string;
    };

    const vendorId = String(body.vendorId ?? '').trim();
    const phone = String(body.phone ?? c.req.query('phone') ?? '').trim();
    const originalAmount = Number(body.originalAmount);

    if (!UUID_RE.test(vendorId)) {
      return c.json({ success: false, error: 'Invalid vendor id' }, 400);
    }
    if (!phone) {
      return c.json({ success: false, error: 'Phone is required' }, 400);
    }
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      return c.json({ success: false, error: 'Invalid bill amount' }, 400);
    }

    const customerId = await resolveCustomerIdFromPhone(phone);
    if (!customerId) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }

    const vendorRow = await dbWpayVendorById(vendorId);
    if (!vendorRow) {
      return c.json({ success: false, error: 'Vendor not found or not available' }, 404);
    }

    const discountPercent = resolveWpayDiscountPercent(vendorRow);
    const quote = computeWpayDiscountQuote(originalAmount, discountPercent, null);

    const order = await createWpayRazorpayOrder({
      customerId,
      vendorId,
      payableAmount: quote.payableAmount,
      quote: {
        originalAmount: quote.originalAmount,
        discountAmount: quote.discountAmount,
        discountPercent: quote.discountPercent,
      },
    });

    return c.json({
      success: true,
      paymentId: order.paymentId,
      razorpayOrderId: order.orderId,
      razorpayKeyId: order.keyId,
      amount: order.amount,
      currency: order.currency,
      originalAmount: quote.originalAmount,
      discountAmount: quote.discountAmount,
      payableAmount: quote.payableAmount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to initiate payment';
    console.error('[customer/warmpawz-pay/initiate]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
