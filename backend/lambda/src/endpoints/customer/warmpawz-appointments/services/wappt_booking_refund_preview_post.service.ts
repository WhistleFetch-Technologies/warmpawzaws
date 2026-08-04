import type { Context } from 'hono';
import {
  assertWapptBookingEligible,
  previewWapptCustomerCancellationRefund,
} from '../../../warmpawz-appointments/shared/wappt-booking-cancel.service';
import { dbLoadBookingForCustomer } from '../repos/wappt_booking_policy.repo';

export async function executeWapptBookingRefundPreviewPost(c: Context) {
  const customerId = await resolveCustomerIdFromHonoContext(c);
  if (!customerId) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const bookingId = c.req.param('bookingId');
  const body = await c.req.json().catch(() => ({}));
  const row = await dbLoadBookingForCustomer(bookingId, customerId);
  if (!row) return c.json({ success: false, error: 'Booking not found' }, 404);
  try {
    assertWapptBookingEligible(row);
  } catch (e: any) {
    return c.json({ success: false, error: e.message, useMarketplaceApi: true }, e.status ?? 409);
  }
  const preview = await previewWapptCustomerCancellationRefund(row, body.refundMethod);
  return c.json({ success: true, bookingId, ...preview });
}
