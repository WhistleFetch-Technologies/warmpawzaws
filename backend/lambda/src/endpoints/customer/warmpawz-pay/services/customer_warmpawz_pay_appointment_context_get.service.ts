import type { Context } from 'hono';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Soft-unwired: Pay Bill no longer applies appointment fee credit.
 * Endpoint kept for client compatibility; always returns no credit-eligible booking.
 */
export async function executeCustomerWarmpawzPayAppointmentContextGet(c: Context) {
  try {
    const vendorId = String(c.req.query('vendorId') ?? '').trim();
    const phone = String(c.req.query('phone') ?? '').trim();

    if (!UUID_RE.test(vendorId)) {
      return c.json({ success: false, error: 'Invalid vendor id' }, 400);
    }
    if (!phone) {
      return c.json({ success: false, error: 'Phone is required' }, 400);
    }

    return c.json({
      success: true,
      hasOpenAppointment: false,
      openAppointment: null,
      creditEligibleBooking: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load appointment context';
    console.error('[customer/warmpawz-pay/appointment-context]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
