/**
 * @jest-environment jsdom
 */

import { navigateFromPushPayload } from '../push-navigation';

describe('navigateFromPushPayload', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // @ts-expect-error test stub
    delete window.location;
    // @ts-expect-error test stub
    window.location = { assign: jest.fn() };
  });

  afterEach(() => {
    // @ts-expect-error restore
    window.location = originalLocation;
  });

  it('opens bookings earnings tab for Warmpawz Pay and keeps query string', () => {
    navigateFromPushPayload({
      type: 'warmpawz_pay_received',
      deep_link: '/bookings?tab=earnings',
    });
    expect(window.location.assign).toHaveBeenCalledWith('/bookings?tab=earnings');
  });

  it('defaults WPay taps to bookings earnings when deep link missing', () => {
    navigateFromPushPayload({ type: 'warmpawz_pay_received' });
    expect(window.location.assign).toHaveBeenCalledWith('/bookings?tab=earnings');
  });
});
