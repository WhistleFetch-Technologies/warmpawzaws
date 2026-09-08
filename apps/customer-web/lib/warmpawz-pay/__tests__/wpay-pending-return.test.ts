/**
 * @jest-environment jsdom
 */

import {
  clearWpayPendingReturn,
  consumeWpayPendingReturnPath,
  peekWpayPendingReturn,
  rememberWpayPendingReturn,
  WPAY_PENDING_RETURN_KEY,
} from '../wpay-pending-return';

describe('wpay pending return', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('stores and peeks a paymentId for the success page', () => {
    rememberWpayPendingReturn({ paymentId: 'pay-1', vendor: 'Clinic', saved: 24 });
    expect(peekWpayPendingReturn()).toEqual({
      paymentId: 'pay-1',
      vendor: 'Clinic',
      saved: 24,
    });
    expect(sessionStorage.getItem(WPAY_PENDING_RETURN_KEY)).toContain('pay-1');
    expect(localStorage.getItem(WPAY_PENDING_RETURN_KEY)).toContain('pay-1');
  });

  it('still finds a pending return after sessionStorage is cleared', () => {
    rememberWpayPendingReturn({ paymentId: 'pay-apk' });
    sessionStorage.clear();
    expect(peekWpayPendingReturn()?.paymentId).toBe('pay-apk');
  });

  it('consumes into the success path once', () => {
    rememberWpayPendingReturn({ paymentId: 'pay-9', vendor: 'Salon' });
    expect(consumeWpayPendingReturnPath()).toBe(
      '/warmpawz-pay/success?paymentId=pay-9&vendor=Salon',
    );
    expect(peekWpayPendingReturn()).toBeNull();
    expect(consumeWpayPendingReturnPath()).toBeNull();
  });

  it('ignores empty payment ids', () => {
    rememberWpayPendingReturn({ paymentId: '   ' });
    expect(peekWpayPendingReturn()).toBeNull();
    clearWpayPendingReturn();
  });
});
