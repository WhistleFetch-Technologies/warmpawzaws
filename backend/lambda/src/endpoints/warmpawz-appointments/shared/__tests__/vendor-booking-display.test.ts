import {
  applyVendorBookingDisplayFields,
  isTeleServiceStyle,
  isWarmpawzAppointmentsCommerceMode,
  resolveVendorBookingServiceDisplayName,
  shouldExposeVendorBookingPrice,
} from '../vendor-booking-display';
import {
  WAPPT_BOOKING_MODE,
  WAPPT_DISPLAY_SERVICE_NAME,
} from '../wappt-booking-preflight';

describe('vendor-booking-display', () => {
  it('detects WAPPT commerce_mode', () => {
    expect(
      isWarmpawzAppointmentsCommerceMode({ commerce_mode: WAPPT_BOOKING_MODE }),
    ).toBe(true);
    expect(
      isWarmpawzAppointmentsCommerceMode({ commerce_mode: 'marketplace' }),
    ).toBe(false);
  });

  it('WAPPT home uses Appointment label and hides price', () => {
    const booking = {
      commerce_mode: WAPPT_BOOKING_MODE,
      service_style: 'at_home',
      service_name: 'Vaccination at Home (Leptospirosis)',
    };
    expect(
      resolveVendorBookingServiceDisplayName(booking, 'Vaccination at Home'),
    ).toBe('Appointment');
    expect(shouldExposeVendorBookingPrice(booking)).toBe(false);
    const patch = applyVendorBookingDisplayFields(booking, {
      catalogServiceName: 'Vaccination at Home',
      vendorVisibleAmount: 1299,
    });
    expect(patch.serviceName).toBe('Appointment');
    expect(patch.price).toBeNull();
    expect(patch.total_amount).toBeNull();
  });

  it('WAPPT tele edge case: tele wins — catalog name and price visible', () => {
    const booking = {
      commerce_mode: WAPPT_BOOKING_MODE,
      service_style: 'tele',
    };
    expect(
      resolveVendorBookingServiceDisplayName(booking, 'Tele Consultation'),
    ).toBe('Tele Consultation');
    expect(shouldExposeVendorBookingPrice(booking)).toBe(true);
    expect(isTeleServiceStyle(booking)).toBe(true);
    const patch = applyVendorBookingDisplayFields(booking, {
      catalogServiceName: 'Tele Consultation',
      vendorVisibleAmount: 499,
    });
    expect(patch.serviceName).toBe('Tele Consultation');
    expect(patch.price).toBe(499);
  });

  it('marketplace tele shows catalog name and price', () => {
    const booking = {
      commerce_mode: 'marketplace',
      service_style: 'tele',
    };
    expect(
      resolveVendorBookingServiceDisplayName(booking, 'Video Vet Visit'),
    ).toBe('Video Vet Visit');
    expect(shouldExposeVendorBookingPrice(booking)).toBe(true);
  });

  it('marketplace home shows catalog name and price', () => {
    const booking = {
      commerce_mode: 'marketplace',
      service_style: 'at_home',
    };
    expect(
      resolveVendorBookingServiceDisplayName(booking, 'Home Grooming'),
    ).toBe('Home Grooming');
    expect(shouldExposeVendorBookingPrice(booking)).toBe(true);
    const patch = applyVendorBookingDisplayFields(booking, {
      catalogServiceName: 'Home Grooming',
      vendorVisibleAmount: 800,
    });
    expect(patch.price).toBe(800);
  });
});
