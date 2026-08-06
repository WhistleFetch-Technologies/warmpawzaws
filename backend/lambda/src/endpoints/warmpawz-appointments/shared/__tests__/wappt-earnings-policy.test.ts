import {
  isWapptAppointmentBooking,
  shouldSkipVendorEarningsForWappt,
  WAPPT_COMMERCE_MODE,
} from '../wappt-earnings-policy';

describe('wappt-earnings-policy', () => {
  it('detects WAPPT appointment bookings', () => {
    expect(isWapptAppointmentBooking({ commerce_mode: WAPPT_COMMERCE_MODE })).toBe(true);
    expect(isWapptAppointmentBooking({ commerceMode: WAPPT_COMMERCE_MODE })).toBe(true);
    expect(isWapptAppointmentBooking({ commerce_mode: 'marketplace' })).toBe(false);
  });

  it('skips vendor earnings for WAPPT bookings', () => {
    expect(shouldSkipVendorEarningsForWappt({ commerce_mode: WAPPT_COMMERCE_MODE })).toBe(true);
    expect(shouldSkipVendorEarningsForWappt({ commerce_mode: 'vet' })).toBe(false);
  });
});
