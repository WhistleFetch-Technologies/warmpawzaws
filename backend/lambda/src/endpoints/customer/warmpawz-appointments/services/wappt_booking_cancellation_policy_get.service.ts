import type { Context } from 'hono';
import { previewCustomerCancellationRefund } from '../../../../lib/services/cancellation-policy-service';
import { assertWapptBookingEligible } from '../../../warmpawz-appointments/shared/wappt-booking-cancel.service';
import { resolveCustomerIdFromHonoContext } from '../../../../utils/customer-id-from-auth';
import {
  dbFetchWapptPolicyTiersForCategory,
  dbLoadBookingForCustomer,
  rowToBookingForPolicy,
} from '../repos/wappt_booking_policy.repo';

export async function executeWapptBookingCancellationPolicyGet(c: Context) {
  const customerId = await resolveCustomerIdFromHonoContext(c);
  if (!customerId) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const bookingId = c.req.param('bookingId');
  const row = await dbLoadBookingForCustomer(bookingId, customerId);
  if (!row) return c.json({ success: false, error: 'Booking not found' }, 404);
  try {
    assertWapptBookingEligible(row);
  } catch (e: any) {
    return c.json({ success: false, error: e.message, useMarketplaceApi: true }, e.status ?? 409);
  }
  const booking = rowToBookingForPolicy(row);
  const preview = await previewCustomerCancellationRefund(booking);
  const policyMeta = await dbFetchWapptPolicyTiersForCategory(String(row.service_category ?? ''));
  return c.json({
    success: true,
    bookingId,
    policyScope: policyMeta.policyScope,
    category: policyMeta.category,
    tiers: policyMeta.tiers,
    refundPreview: preview,
  });
}
