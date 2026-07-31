import {
  isWarmpawzAppointmentsBooking,
  WAPPT_BOOKING_MODE,
  WAPPT_DISPLAY_SERVICE_NAME,
  WAPPT_SERVICE_SLUG,
} from '../wappt-booking-preflight';

describe('wappt-booking-preflight', () => {
  it('exposes stable slug and display label', () => {
    expect(WAPPT_SERVICE_SLUG).toBe('warmpawz_appointments');
    expect(WAPPT_BOOKING_MODE).toBe('warmpawz_appointments');
    expect(WAPPT_DISPLAY_SERVICE_NAME).toBe('Appointment');
  });

  it('detects WAPPT booking from bookingMode or serviceId slug', () => {
    expect(
      isWarmpawzAppointmentsBooking({
        bookingMode: WAPPT_BOOKING_MODE,
        serviceId: 'any',
      }),
    ).toBe(true);
    expect(
      isWarmpawzAppointmentsBooking({
        serviceId: WAPPT_SERVICE_SLUG,
      }),
    ).toBe(true);
    expect(
      isWarmpawzAppointmentsBooking({
        serviceId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    ).toBe(false);
  });
});
