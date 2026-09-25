import type { Context } from 'hono';
import { pickWapptFeeForStyle } from '../../../warmpawz-appointments/shared/wappt-fee-by-style';
import { dbFetchPublishedVendorAppointmentFees } from '../repos/vendor_fee_get.repo';

export async function executeVendorFeeGet(c: Context) {
  const vendorId = c.req.param('vendorId');
  if (!vendorId) {
    return c.json({ success: false, error: 'vendorId is required' }, 400);
  }

  const fees = await dbFetchPublishedVendorAppointmentFees(vendorId);
  if (fees == null) {
    return c.json(
      { success: false, error: 'Vendor is not available for Warmpawz Appointments' },
      404,
    );
  }

  const serviceStyle = c.req.query('serviceStyle') ?? c.req.query('service_style') ?? null;
  const appointmentFee = pickWapptFeeForStyle({
    centreFee: fees.appointmentFee,
    homeFee: fees.appointmentFeeHome,
    serviceStyle,
  });

  return c.json({
    success: true,
    vendorId,
    appointmentFee,
    appointmentFeeCentre: fees.appointmentFee,
    appointmentFeeHome: fees.appointmentFeeHome,
    serviceStyle: serviceStyle || 'at_center',
    currency: 'INR',
  });
}
