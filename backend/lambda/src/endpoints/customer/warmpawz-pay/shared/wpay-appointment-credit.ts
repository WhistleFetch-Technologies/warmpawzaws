import { hasCustomerPaidCapture } from '../../../../lib/services/refundable-base';
import { resolveCustomerBookingServiceDisplayName } from '../../../../utils/customer-booking-display-name';
import type { WpayWapptBookingContextRow } from '../repos/wpay-appointment-context.repo';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveWapptAppointmentFeeFromBooking(row: WpayWapptBookingContextRow): number {
  const fee = Number(row.total_amount ?? 0);
  return Number.isFinite(fee) && fee > 0 ? round2(fee) : 0;
}

export function mapWpayAppointmentContextBooking(row: WpayWapptBookingContextRow) {
  const vendorName = String(row.business_name || row.owner_name || 'Vendor').trim();
  const appointmentFee = resolveWapptAppointmentFeeFromBooking(row);
  const otpCode = String(row.otp_code ?? '').trim() || null;
  const completionOtp = String(row.completion_otp ?? '').trim() || otpCode;

  return {
    bookingId: String(row.id),
    status: String(row.status),
    serviceName: resolveCustomerBookingServiceDisplayName(row as Record<string, unknown>),
    vendorName,
    bookingDate: row.booking_date ?? null,
    bookingTime: row.booking_time ?? null,
    bookingDatetime: row.booking_datetime ?? null,
    appointmentFee,
    otpCode,
    completionOtp,
    otpVerified: Boolean(row.otp_verified),
    creditEligible: String(row.status).toLowerCase() === 'completed' && appointmentFee > 0,
  };
}

export async function resolveWapptAppointmentFeeCredit(params: {
  booking: WpayWapptBookingContextRow;
  creditAlreadyConsumed: boolean;
}): Promise<{ credit: number; error?: string; status?: number }> {
  if (params.creditAlreadyConsumed) {
    return { credit: 0, error: 'Appointment fee credit already used', status: 409 };
  }

  const status = String(params.booking.status ?? '').toLowerCase();
  if (status !== 'completed') {
    return {
      credit: 0,
      error: 'Complete your appointment with the vendor before applying appointment fee credit',
      status: 409,
    };
  }

  const paid = await hasCustomerPaidCapture(String(params.booking.id), {
    total_amount: params.booking.total_amount,
    payment_status: params.booking.payment_status,
  });
  if (!paid) {
    return { credit: 0, error: 'Appointment fee was not paid for this booking', status: 409 };
  }

  const credit = resolveWapptAppointmentFeeFromBooking(params.booking);
  if (credit <= 0) {
    return { credit: 0, error: 'No appointment fee available for credit', status: 400 };
  }

  return { credit };
}
