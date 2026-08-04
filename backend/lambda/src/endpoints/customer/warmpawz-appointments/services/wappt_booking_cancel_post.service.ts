import type { Context } from 'hono';
import { executeWapptCustomerCancel } from '../../../warmpawz-appointments/shared/wappt-booking-cancel.service';
import { resolveCustomerIdFromHonoContext } from '../../../../utils/customer-id-from-auth';
import { dbLoadBookingForCustomer } from '../repos/wappt_booking_policy.repo';

export async function executeWapptBookingCancelPost(c: Context) {
  const customerId = await resolveCustomerIdFromHonoContext(c);
  if (!customerId) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const bookingId = c.req.param('bookingId');
  const body = await c.req.json().catch(() => ({}));
  const row = await dbLoadBookingForCustomer(bookingId, customerId);
  if (!row) return c.json({ success: false, error: 'Booking not found' }, 404);
  if (String(row.status) === 'cancelled') {
    return c.json({ success: false, error: 'Appointment is already cancelled' }, 400);
  }
  try {
    const result = await executeWapptCustomerCancel({
      bookingRow: row,
      reason: body.reason,
      refundMethodRaw: body.refundMethod,
    });
    return c.json({ success: true, ...result });
  } catch (e: any) {
    return c.json(
      { success: false, error: e.message, useMarketplaceApi: e.status === 409 },
      e.status ?? 500,
    );
  }
}
