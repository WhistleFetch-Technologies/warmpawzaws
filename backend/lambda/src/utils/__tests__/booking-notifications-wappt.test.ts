import { resolveBookingNotificationServiceName } from '../booking-notifications';
import { WAPPT_BOOKING_MODE, WAPPT_DISPLAY_SERVICE_NAME } from '../../endpoints/warmpawz-appointments/shared/wappt-booking-preflight';

describe('resolveBookingNotificationServiceName', () => {
  it('returns Appointment for WAPPT commerce_mode regardless of joined catalog name', () => {
    const label = resolveBookingNotificationServiceName(
      {
        commerce_mode: WAPPT_BOOKING_MODE,
        service_name: WAPPT_DISPLAY_SERVICE_NAME,
      },
      'General Consultation',
    );
    expect(label).toBe('Appointment');
  });

  it('falls back to Appointment when WAPPT booking has no service_name column', () => {
    const label = resolveBookingNotificationServiceName(
      { commerce_mode: WAPPT_BOOKING_MODE },
      'Vaccination',
    );
    expect(label).toBe('Appointment');
  });

  it('uses joined catalog name for marketplace bookings', () => {
    const label = resolveBookingNotificationServiceName(
      { commerce_mode: 'marketplace', service_name: 'Stored label' },
      'Grooming Bath',
    );
    expect(label).toBe('Grooming Bath');
  });
});
