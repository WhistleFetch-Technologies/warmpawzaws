import { isGuestBrowsingEnabled } from '../guest-browsing-flag';

describe('isGuestBrowsingEnabled', () => {
  const originalEnv = process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = originalEnv;
    }
    delete (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: unknown }).__WARMPAWZ_RUNTIME_CONFIG__;
  });

  it('defaults to false when unset', () => {
    delete process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED;
    expect(isGuestBrowsingEnabled()).toBe(false);
  });

  it('respects env true', () => {
    process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = 'true';
    expect(isGuestBrowsingEnabled()).toBe(true);
  });

  it('runtime config overrides env', () => {
    process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = 'false';
    (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__: { guestBrowsingEnabled: boolean } }).__WARMPAWZ_RUNTIME_CONFIG__ =
      { guestBrowsingEnabled: true };
    expect(isGuestBrowsingEnabled()).toBe(true);
  });
});
