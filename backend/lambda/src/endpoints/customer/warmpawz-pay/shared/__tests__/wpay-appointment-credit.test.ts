import {
  assertBookingEligibleForPayCredit,
  mapWpayAppointmentContextBooking,
  mapWpayAppointmentContextBookingPublic,
  resolveWapptAppointmentFeeCredit,
  resolveWapptAppointmentFeeFromBooking,
} from '../wpay-appointment-credit';
import type { WpayWapptBookingContextRow } from '../../repos/wpay-appointment-context.repo';

jest.mock('../../../../../lib/services/refundable-base', () => ({
  hasCustomerPaidCapture: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../../../utils/ist-scheduling', () => ({
  ymdInIst: jest.fn().mockReturnValue('2026-08-05'),
}));

const { hasCustomerPaidCapture } = jest.requireMock('../../../../../lib/services/refundable-base');

const baseRow: WpayWapptBookingContextRow = {
  id: 'booking-1',
  vendor_id: 'vendor-1',
  customer_id: 'cust-1',
  status: 'confirmed',
  booking_date: '2026-08-05',
  booking_time: '10:00',
  booking_datetime: '2026-08-05T10:00:00.000Z',
  service_type: 'at_center',
  service_category: 'vet',
  commerce_mode: 'warmpawz_appointments',
  total_amount: 200,
  payment_status: 'paid',
  otp_code: '123456',
  otp_verified: false,
  business_name: 'Happy Paws',
  owner_name: 'Dr Vet',
};

describe('wpay-appointment-credit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasCustomerPaidCapture.mockResolvedValue(true);
  });

  it('maps booking context with creditEligible for active same-day booking', () => {
    const mapped = mapWpayAppointmentContextBooking(baseRow);
    expect(mapped.bookingId).toBe('booking-1');
    expect(mapped.serviceName).toBe('Appointment');
    expect(mapped.otpVerified).toBe(false);
    expect(mapped.creditEligible).toBe(true);
  });

  it('public mapper never exposes OTP fields', () => {
    const mapped = mapWpayAppointmentContextBookingPublic(baseRow);
    expect(mapped.bookingId).toBe('booking-1');
    expect(mapped.otpCode).toBeNull();
    expect(mapped.completionOtp).toBeNull();
  });

  it('maps creditEligible when booking_date is a Date object from Postgres', () => {
    const mapped = mapWpayAppointmentContextBooking({
      ...baseRow,
      booking_date: new Date('2026-08-05T00:00:00.000Z') as unknown as string,
    });
    expect(mapped.creditEligible).toBe(true);
  });

  it('resolves appointment fee from booking total', () => {
    expect(resolveWapptAppointmentFeeFromBooking(baseRow)).toBe(200);
  });

  it('allows credit for active same-day paid booking', async () => {
    const result = await resolveWapptAppointmentFeeCredit({
      booking: baseRow,
      creditAlreadyConsumed: false,
    });
    expect(result).toEqual({ credit: 200 });
  });

  it('rejects credit when booking date is not today', async () => {
    const result = await resolveWapptAppointmentFeeCredit({
      booking: { ...baseRow, booking_date: '2026-08-04' },
      creditAlreadyConsumed: false,
    });
    expect(result.credit).toBe(0);
    expect(result.status).toBe(409);
  });

  it('rejects credit when booking is cancelled', async () => {
    const result = await resolveWapptAppointmentFeeCredit({
      booking: { ...baseRow, status: 'cancelled' },
      creditAlreadyConsumed: false,
    });
    expect(result.credit).toBe(0);
    expect(result.status).toBe(409);
  });

  it('allows credit when OTP already set booking status to completed', async () => {
    const mapped = mapWpayAppointmentContextBooking({ ...baseRow, status: 'completed', otp_verified: true });
    expect(mapped.creditEligible).toBe(true);

    const result = await resolveWapptAppointmentFeeCredit({
      booking: { ...baseRow, status: 'completed', otp_verified: true },
      creditAlreadyConsumed: false,
    });
    expect(result).toEqual({ credit: 200 });
  });

  it('assertBookingEligibleForPayCredit passes for OTP-completed same-day booking', () => {
    expect(assertBookingEligibleForPayCredit({ ...baseRow, status: 'completed', otp_verified: true })).toEqual({
      ok: true,
    });
  });

  it('rejects credit when already consumed', async () => {
    const result = await resolveWapptAppointmentFeeCredit({
      booking: baseRow,
      creditAlreadyConsumed: true,
    });
    expect(result.credit).toBe(0);
    expect(result.status).toBe(409);
  });

  it('assertBookingEligibleForPayCredit passes for active same-day booking', () => {
    expect(assertBookingEligibleForPayCredit(baseRow)).toEqual({ ok: true });
  });
});
