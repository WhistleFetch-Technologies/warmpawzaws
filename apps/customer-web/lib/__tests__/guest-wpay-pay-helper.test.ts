/**
 * @jest-environment jsdom
 *
 * Import-level regression: requestGuestAuthForWpayPay must exist and persist.
 */

jest.mock('../allyticas-ingest', () => ({
  enqueueAllyticasEvent: jest.fn(),
}));

import { registerGuestAuthModalOpener, requestGuestAuthForWpayPay } from '../guest-auth-gate';
import { clearGuestBookingIntent, readGuestBookingIntent } from '../guest-booking-intent';
import { resolveGuestPublicApiPath } from '../guest-public-api-path';

describe('requestGuestAuthForWpayPay export', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearGuestBookingIntent();
    registerGuestAuthModalOpener(jest.fn());
    process.env.NEXT_PUBLIC_GUEST_BROWSING_ENABLED = 'true';
  });

  it('is an exported function that persists pay_bill amount', () => {
    expect(typeof requestGuestAuthForWpayPay).toBe('function');
    const blocked = requestGuestAuthForWpayPay({ vendorId: 'vendor-pay', amount: 1999 });
    expect(blocked).toBe(true);
    const snap = readGuestBookingIntent();
    expect(snap?.kind).toBe('pay_bill');
    expect(snap?.vendorId).toBe('vendor-pay');
    expect(snap?.price).toBe(1999);
    expect(snap?.requiresPet).toBe(false);
    expect(snap?.returnPath).toBe('/warmpawz-pay/vendors/vendor-pay');
    expect(JSON.stringify(snap)).not.toMatch(/jwt|refreshToken|otp|password/i);
  });

  it('keeps payment APIs authenticated', () => {
    expect(resolveGuestPublicApiPath('/customer/warmpawz-pay/initiate')).toBe(
      '/customer/warmpawz-pay/initiate'
    );
    expect(resolveGuestPublicApiPath('/customer/warmpawz-pay/verify')).toBe(
      '/customer/warmpawz-pay/verify'
    );
    expect(resolveGuestPublicApiPath('/customer/warmpawz-pay/appointment-context?vendorId=v')).toBe(
      '/customer/warmpawz-pay/appointment-context?vendorId=v'
    );
  });
});
