import { isGuestBookingEnabled } from '../guest-booking-flag';

describe('isGuestBookingEnabled', () => {
  const originalEnv = process.env.NEXT_PUBLIC_GUEST_BOOKING_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_GUEST_BOOKING_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_GUEST_BOOKING_ENABLED = originalEnv;
    }
    delete (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: unknown }).__WARMPAWZ_RUNTIME_CONFIG__;
  });

  it('defaults to false when unset', () => {
    delete process.env.NEXT_PUBLIC_GUEST_BOOKING_ENABLED;
    expect(isGuestBookingEnabled()).toBe(false);
  });

  it('respects env true', () => {
    process.env.NEXT_PUBLIC_GUEST_BOOKING_ENABLED = 'true';
    expect(isGuestBookingEnabled()).toBe(true);
  });

  it('runtime config overrides env', () => {
    process.env.NEXT_PUBLIC_GUEST_BOOKING_ENABLED = 'true';
    (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__: { guestBookingEnabled: boolean } }).__WARMPAWZ_RUNTIME_CONFIG__ =
      { guestBookingEnabled: false };
    expect(isGuestBookingEnabled()).toBe(false);
  });
});
