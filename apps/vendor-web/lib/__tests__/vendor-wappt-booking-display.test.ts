import {
  isWarmpawzAppointmentsBooking,
  resolveVendorBookingServiceLabel,
  shouldShowVendorBookingPrice,
  shouldShowVendorBookingServiceOnHomeDashboard,
  WAPPT_VENDOR_COMMERCE_MODE,
  WAPPT_VENDOR_SERVICE_LABEL,
} from '../vendor-utils';

describe('vendor WAPPT booking display', () => {
  it('WAPPT home hides price and uses Appointment label on Bookings tab', () => {
    const booking = {
      commerce_mode: WAPPT_VENDOR_COMMERCE_MODE,
      service_style: 'at_home',
      serviceName: 'Vaccination at Home',
    };
    expect(isWarmpawzAppointmentsBooking(booking)).toBe(true);
    expect(shouldShowVendorBookingPrice(booking)).toBe(false);
    expect(shouldShowVendorBookingServiceOnHomeDashboard(booking)).toBe(false);
    expect(resolveVendorBookingServiceLabel(booking)).toBe(WAPPT_VENDOR_SERVICE_LABEL);
  });

  it('WAPPT tele edge case: tele wins on Home and Bookings', () => {
    const booking = {
      commerce_mode: WAPPT_VENDOR_COMMERCE_MODE,
      service_style: 'tele',
      serviceName: 'Tele Consultation',
    };
    expect(shouldShowVendorBookingPrice(booking)).toBe(true);
    expect(shouldShowVendorBookingServiceOnHomeDashboard(booking)).toBe(true);
    expect(resolveVendorBookingServiceLabel(booking)).toBe('Tele Consultation');
  });

  it('marketplace home shows catalog label and price', () => {
    const booking = {
      commerce_mode: 'marketplace',
      service_style: 'at_home',
      serviceName: 'Home Grooming',
    };
    expect(shouldShowVendorBookingPrice(booking)).toBe(true);
    expect(shouldShowVendorBookingServiceOnHomeDashboard(booking)).toBe(true);
    expect(resolveVendorBookingServiceLabel(booking)).toBe('Home Grooming');
  });
});
