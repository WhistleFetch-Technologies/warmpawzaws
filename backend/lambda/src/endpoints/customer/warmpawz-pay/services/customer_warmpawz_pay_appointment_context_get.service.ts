import type { Context } from 'hono';
import { dbFindCreditEligibleWapptBookingForPay } from '../repos/wpay-appointment-context.repo';
import { mapWpayAppointmentContextBookingPublic } from '../shared/wpay-appointment-credit';
import { resolveWpayAuthenticatedCustomer } from '../shared/wpay-authenticated-customer';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Same-day at_home WAPPT booking eligible for Pay Bill appointment-fee credit.
 * Centre / clinic / tele never appear in creditEligibleBooking.
 */
export async function executeCustomerWarmpawzPayAppointmentContextGet(c: Context) {
  try {
    const vendorId = String(c.req.query('vendorId') ?? '').trim();
    const phone = String(c.req.query('phone') ?? '').trim();

    if (!UUID_RE.test(vendorId)) {
      return c.json({ success: false, error: 'Invalid vendor id' }, 400);
    }
    const identity = await resolveWpayAuthenticatedCustomer(c, phone);
    if (!identity.ok) {
      return c.json({ success: false, error: identity.error }, identity.status);
    }
    const customerId = identity.customerId;

    const creditRow = await dbFindCreditEligibleWapptBookingForPay(customerId, vendorId);
    const creditEligibleBooking = creditRow
      ? mapWpayAppointmentContextBookingPublic(creditRow)
      : null;

    return c.json({
      success: true,
      hasOpenAppointment: false,
      openAppointment: null,
      creditEligibleBooking:
        creditEligibleBooking?.creditEligible === true ? creditEligibleBooking : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load appointment context';
    console.error('[customer/warmpawz-pay/appointment-context]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
