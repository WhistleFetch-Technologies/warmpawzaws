import type { Context } from 'hono';
import { dbFetchPublishedVendorAppointmentFee } from '../repos/vendor_fee.repo';

export async function executeVendorFeeGet(c: Context) {
  const vendorId = c.req.param('vendorId');
  if (!vendorId) {
    return c.json({ success: false, error: 'vendorId is required' }, 400);
  }

  const appointmentFee = await dbFetchPublishedVendorAppointmentFee(vendorId);
  if (appointmentFee == null) {
    return c.json(
      { success: false, error: 'Vendor is not available for Warmpawz Appointments' },
      404,
    );
  }

  return c.json({
    success: true,
    vendorId,
    appointmentFee,
    currency: 'INR',
  });
}
