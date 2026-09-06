/**
 * @jest-environment jsdom
 */

jest.mock('../../guest-auth-gate', () => ({
  emitGuestAuthAnalytics: jest.fn(),
}));

import { saveGuestBookingIntent, clearGuestBookingIntent } from '../../guest-booking-intent';
import {
  buildWpayVendorPayPath,
  consumeRestoredWpayPayBillAmount,
  isWpayPayBillJourney,
} from '../wpay-guest-journey';
import { previewWpayQuote } from '../wpay-quote';
import { resolveGuestPublicApiPath } from '../../guest-public-api-path';
import * as fs from 'fs';
import * as path from 'path';

describe('wpay guest Pay Bill journey', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearGuestBookingIntent();
  });

  it('builds the shared vendor Pay Bill path for every entry point', () => {
    expect(buildWpayVendorPayPath('vendor-1')).toBe(
      '/warmpawz-pay/vendors/placeholder?vendorId=vendor-1',
    );
    expect(buildWpayVendorPayPath('')).toBe('/warmpawz-pay');
  });

  it('restores entered amount after login and ignores a stale guest discount', () => {
    saveGuestBookingIntent({
      kind: 'pay_bill',
      vendorId: 'vendor-1',
      price: 1000,
      returnPath: '/warmpawz-pay/vendors/vendor-1',
      resumeScreen: 'warmpawz-pay-vendor',
      requiresPet: false,
    });

    expect(consumeRestoredWpayPayBillAmount('vendor-1')).toBe(1000);
    expect(consumeRestoredWpayPayBillAmount('vendor-1')).toBeNull();

    const guestPreview = previewWpayQuote({ originalAmount: 1000, discountPercent: 10 });
    const afterLogin = previewWpayQuote({
      originalAmount: 1000,
      discountPercent: 5,
    });
    expect(afterLogin.discountAmount).not.toBe(guestPreview.discountAmount);
    expect(afterLogin.payableAmount).not.toBe(guestPreview.payableAmount);
  });

  it('does not restore another vendor amount', () => {
    saveGuestBookingIntent({
      kind: 'pay_bill',
      vendorId: 'vendor-A',
      price: 750,
      returnPath: '/warmpawz-pay/vendors/vendor-A',
      resumeScreen: 'warmpawz-pay-vendor',
    });
    expect(consumeRestoredWpayPayBillAmount('vendor-B')).toBeNull();
    expect(isWpayPayBillJourney({
      v: 1,
      savedAt: Date.now(),
      kind: 'pay_bill',
      returnPath: '/warmpawz-pay/vendors/vendor-A',
    })).toBe(true);
  });

  it('keeps payment and appointment-context APIs authenticated', () => {
    expect(resolveGuestPublicApiPath('/customer/warmpawz-pay/initiate')).toBe(
      '/customer/warmpawz-pay/initiate'
    );
    expect(resolveGuestPublicApiPath('/customer/warmpawz-pay/verify')).toBe(
      '/customer/warmpawz-pay/verify'
    );
    expect(resolveGuestPublicApiPath('/customer/warmpawz-pay/appointment-context?vendorId=v')).toBe(
      '/customer/warmpawz-pay/appointment-context?vendorId=v'
    );
    expect(resolveGuestPublicApiPath('/customer/warmpawz-pay/vendors/vendor-1')).toBe(
      '/public/warmpawz-pay/vendors/vendor-1'
    );
  });

  it('entry points open Pay Bill without an immediate login gate', () => {
    const root = path.resolve(__dirname, '../../..');
    const landing = fs.readFileSync(path.join(root, 'app/warmpawz-pay/page.tsx'), 'utf8');
    const walkIn = fs.readFileSync(path.join(root, 'lib/walk-in-vendor-actions.ts'), 'utf8');
    const discovery = fs.readFileSync(
      path.join(root, 'lib/wappt-discovery-vendor-card.tsx'),
      'utf8'
    );
    const tabs = fs.readFileSync(
      path.join(root, 'components/customer/bottomNavigation/BottomNavigation.tsx'),
      'utf8'
    );
    const payScreen = fs.readFileSync(
      path.join(root, 'app/warmpawz-pay/vendors/[vendorId]/WarmpawzPayVendorClient.tsx'),
      'utf8'
    );

    expect(landing).not.toMatch(/requestGuestAuthForWpay/);
    expect(walkIn).not.toMatch(/requestGuestAuth/);
    expect(discovery).toMatch(/launchWarmpawzPayServiceBooking/);
    expect(discovery).not.toMatch(/requestGuestAuth/);
    expect(tabs).toMatch(/handleNavClick\('warmpawz-pay'\)/);
    expect(tabs).not.toMatch(/requestGuestAuth/);
    expect(payScreen).toMatch(/requestGuestAuthForWpayPay\(\{ vendorId: resolvedVendorId, amount: billAmount \}\)/);
    expect(payScreen).toContain('buildWpaySuccessPath');
    expect(payScreen).not.toMatch(/Payment cancelled/);
  });
});
