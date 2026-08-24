import type { Context } from 'hono';
import { createWpayRazorpayOrder } from '../../../../utils/wpay-razorpay-order';
import { resolveWpayAuthenticatedCustomer } from '../shared/wpay-authenticated-customer';
import { dbWpayVendorById } from '../repos/wpay-vendor-detail.repo';
import {
  dbIsAppointmentCreditConsumed,
  dbLoadWapptBookingForPayCredit,
} from '../repos/wpay-appointment-context.repo';
import { resolveWapptAppointmentFeeCredit } from '../shared/wpay-appointment-credit';
import { computeWpayDiscountQuote, resolveWpayDiscountPercent } from '../shared/wpay-discount';
import { resolveWpayPlatformWithholdPercent } from '../shared/accrue-wpay-settlement';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function executeCustomerWarmpawzPayInitiatePost(c: Context) {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      vendorId?: string;
      originalAmount?: number;
      phone?: string;
      bookingId?: string;
    };

    const vendorId = String(body.vendorId ?? '').trim();
    const phone = String(body.phone ?? c.req.query('phone') ?? '').trim();
    const originalAmount = Number(body.originalAmount);
    const bookingId = String(body.bookingId ?? '').trim();

    if (!UUID_RE.test(vendorId)) {
      return c.json({ success: false, error: 'Invalid vendor id' }, 400);
    }
    if (!phone) {
      return c.json({ success: false, error: 'Phone is required' }, 400);
    }
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
      return c.json({ success: false, error: 'Invalid bill amount' }, 400);
    }
    if (bookingId && !UUID_RE.test(bookingId)) {
      return c.json({ success: false, error: 'Invalid booking id' }, 400);
    }

    const identity = await resolveWpayAuthenticatedCustomer(c, phone);
    if (!identity.ok) {
      return c.json({ success: false, error: identity.error }, identity.status);
    }
    const customerId = identity.customerId;

    const vendorRow = await dbWpayVendorById(vendorId);
    if (!vendorRow) {
      return c.json({ success: false, error: 'Vendor not found or not available' }, 404);
    }

    let appointmentFeeCredit = 0;
    let appointmentFeeBookingId: string | null = null;

    if (bookingId) {
      const booking = await dbLoadWapptBookingForPayCredit(bookingId, customerId, vendorId);
      if (!booking) {
        return c.json({ success: false, error: 'Booking not found for this vendor' }, 404);
      }

      const consumed = await dbIsAppointmentCreditConsumed(bookingId);
      const creditResult = await resolveWapptAppointmentFeeCredit({ booking, creditAlreadyConsumed: consumed });
      if (creditResult.error) {
        return c.json({ success: false, error: creditResult.error }, creditResult.status ?? 409);
      }

      appointmentFeeCredit = creditResult.credit;
      appointmentFeeBookingId = bookingId;
    }

    const discountPercent = resolveWpayDiscountPercent(vendorRow);
    const quote = computeWpayDiscountQuote(originalAmount, discountPercent, {
      appointmentFeeCredit,
    });

    const platformWithholdPercent = await resolveWpayPlatformWithholdPercent(vendorId);

    const order = await createWpayRazorpayOrder({
      customerId,
      vendorId,
      payableAmount: quote.payableAmount,
      bookingId: appointmentFeeBookingId,
      quote: {
        originalAmount: quote.originalAmount,
        discountAmount: quote.discountAmount,
        discountPercent: quote.discountPercent,
        billBase: quote.billBase,
        appointmentFeeCredit: quote.appointmentFeeCredit,
        appointmentFeeBookingId,
        platformWithholdPercent,
      },
    });

    return c.json({
      success: true,
      paymentId: order.paymentId,
      razorpayOrderId: order.orderId,
      razorpayKeyId: order.keyId,
      amount: order.amount,
      amountPaise: order.amountPaise,
      currency: order.currency,
      originalAmount: quote.originalAmount,
      appointmentFeeCredit: quote.appointmentFeeCredit,
      billBase: quote.billBase,
      discountAmount: quote.discountAmount,
      payableAmount: quote.payableAmount,
      bookingId: appointmentFeeBookingId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to initiate payment';
    console.error('[customer/warmpawz-pay/initiate]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
