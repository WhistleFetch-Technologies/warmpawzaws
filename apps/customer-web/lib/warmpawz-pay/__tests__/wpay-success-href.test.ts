/**
 * @jest-environment jsdom
 */

import { buildWpayCheckoutCallbackUrl, buildWpaySuccessPath } from '../wpay-success-href';

describe('buildWpaySuccessPath', () => {
  it('always includes paymentId and never hard-codes a host', () => {
    expect(buildWpaySuccessPath({ paymentId: 'pay-1' })).toBe(
      '/warmpawz-pay/success?paymentId=pay-1',
    );
    expect(buildWpaySuccessPath({ paymentId: 'pay-1', saved: 24, vendor: 'Clinic' })).toBe(
      '/warmpawz-pay/success?paymentId=pay-1&saved=24&vendor=Clinic',
    );
  });
});

describe('buildWpayCheckoutCallbackUrl', () => {
  it('uses the provided origin, not a production hostname', () => {
    expect(buildWpayCheckoutCallbackUrl('pay-1', 'https://dev.example')).toBe(
      'https://dev.example/warmpawz-pay/success?paymentId=pay-1',
    );
  });

  it('uses window.location.origin when no origin is passed', () => {
    expect(buildWpayCheckoutCallbackUrl('pay-1')).toBe(
      `${window.location.origin}/warmpawz-pay/success?paymentId=pay-1`,
    );
  });
});
