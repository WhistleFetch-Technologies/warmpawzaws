jest.mock('@/lib/commerce-switch-client', () => ({
  isWarmpawzPay: jest.fn(),
}));

import { isWarmpawzPay } from '@/lib/commerce-switch-client';
import { shouldHideDiscoveryPricing } from '../wappt-discovery-ui';

describe('shouldHideDiscoveryPricing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false in marketplace even when row is tagged warmpawzAppointments', () => {
    (isWarmpawzPay as jest.Mock).mockReturnValue(false);
    expect(
      shouldHideDiscoveryPricing({ warmpawzAppointments: true, serviceStyle: 'at_center' }),
    ).toBe(false);
  });

  it('returns false in marketplace for appointmentsMode rows', () => {
    (isWarmpawzPay as jest.Mock).mockReturnValue(false);
    expect(shouldHideDiscoveryPricing({ appointmentsMode: true })).toBe(false);
  });

  it('returns true in Pay mode for tagged rows', () => {
    (isWarmpawzPay as jest.Mock).mockReturnValue(true);
    expect(
      shouldHideDiscoveryPricing({ warmpawzAppointments: true, serviceStyle: 'at_center' }),
    ).toBe(true);
  });

  it('returns true in Pay mode for untagged non-tele rows', () => {
    (isWarmpawzPay as jest.Mock).mockReturnValue(true);
    expect(shouldHideDiscoveryPricing({ serviceStyle: 'at_center' })).toBe(true);
  });

  it('returns false in Pay mode for tele rows without tag', () => {
    (isWarmpawzPay as jest.Mock).mockReturnValue(true);
    expect(shouldHideDiscoveryPricing({ serviceStyle: 'tele' })).toBe(false);
  });

  it('returns false for null/undefined row', () => {
    (isWarmpawzPay as jest.Mock).mockReturnValue(true);
    expect(shouldHideDiscoveryPricing(null)).toBe(false);
    expect(shouldHideDiscoveryPricing(undefined)).toBe(false);
  });
});
