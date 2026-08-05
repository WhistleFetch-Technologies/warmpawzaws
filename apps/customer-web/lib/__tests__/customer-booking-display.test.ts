import {
  isWarmpawzAppointmentsBookingRow,
  resolveCustomerBookingDisplayName,
  shouldHideWarmpawzAppointmentDuration,
  WAPPT_APPOINTMENT_SERVICE_ID,
  WAPPT_BOOKING_MODE,
} from '@/lib/warmpawz-appointments-customer';

describe('customer booking display helpers', () => {
  it('detects WAPPT rows by commerce mode', () => {
    expect(isWarmpawzAppointmentsBookingRow({ commerce_mode: WAPPT_BOOKING_MODE })).toBe(true);
    expect(isWarmpawzAppointmentsBookingRow({ commerceMode: WAPPT_BOOKING_MODE })).toBe(true);
  });

  it('detects WAPPT rows by booking mode and service id', () => {
    expect(isWarmpawzAppointmentsBookingRow({ booking_mode: WAPPT_BOOKING_MODE })).toBe(true);
    expect(isWarmpawzAppointmentsBookingRow({ serviceId: WAPPT_APPOINTMENT_SERVICE_ID })).toBe(true);
  });

  it('returns Appointment for WAPPT rows regardless of catalog service name', () => {
    expect(
      resolveCustomerBookingDisplayName({
        commerce_mode: WAPPT_BOOKING_MODE,
        serviceName: 'Vaccination',
      }),
    ).toBe('Appointment');
    expect(
      resolveCustomerBookingDisplayName({
        service_name: 'Vaccination',
        serviceId: WAPPT_APPOINTMENT_SERVICE_ID,
      }),
    ).toBe('Appointment');
  });

  it('keeps marketplace service names unchanged', () => {
    expect(
      resolveCustomerBookingDisplayName({
        commerce_mode: 'marketplace',
        serviceName: 'Vaccination',
      }),
    ).toBe('Vaccination');
  });

  it('detects WAPPT rows when persisted booking_service_name is Appointment', () => {
    expect(
      isWarmpawzAppointmentsBookingRow({
        commerce_mode: 'marketplace',
        booking_service_name: 'Appointment',
        service_name: 'Vaccination at Clinic',
      }),
    ).toBe(true);
  });

  it('hides duration only for WAPPT rows', () => {
    expect(shouldHideWarmpawzAppointmentDuration({ commerce_mode: WAPPT_BOOKING_MODE })).toBe(true);
    expect(shouldHideWarmpawzAppointmentDuration({ commerce_mode: 'marketplace' })).toBe(false);
  });

  it('returns Tele Consultation for WAPPT tele rows', () => {
    expect(
      resolveCustomerBookingDisplayName({
        commerce_mode: WAPPT_BOOKING_MODE,
        service_style: 'tele',
        service_name: 'Vaccination',
      }),
    ).toBe('Tele Consultation');
  });

  it('keeps catalog name for WAPPT nutrition rows', () => {
    expect(
      resolveCustomerBookingDisplayName({
        commerce_mode: WAPPT_BOOKING_MODE,
        service_type: 'nutrition',
        joined_service_name: 'Diet Consultation',
        service_name: 'Appointment',
      }),
    ).toBe('Diet Consultation');
  });
});
