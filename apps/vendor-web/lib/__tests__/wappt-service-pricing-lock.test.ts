import {
  canVendorEditServicePrice,
  isPricingLockedServiceStyle,
  shouldHideVendorServicePrice,
} from '../wappt-service-pricing-lock';

jest.mock('../commerce-switch-client', () => ({
  isWarmpawzPay: jest.fn(),
}));

import { isWarmpawzPay } from '../commerce-switch-client';

const mockedIsWarmpawzPay = isWarmpawzPay as jest.MockedFunction<typeof isWarmpawzPay>;

describe('wappt-service-pricing-lock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('locks at_home and at_center when Warmpawz Pay is active', () => {
    mockedIsWarmpawzPay.mockReturnValue(true);
    expect(canVendorEditServicePrice('at_home')).toBe(false);
    expect(canVendorEditServicePrice('at_center')).toBe(false);
    expect(shouldHideVendorServicePrice('at_home')).toBe(true);
  });

  it('allows tele pricing when Warmpawz Pay is active', () => {
    mockedIsWarmpawzPay.mockReturnValue(true);
    expect(canVendorEditServicePrice('tele')).toBe(true);
    expect(shouldHideVendorServicePrice('tele')).toBe(false);
  });

  it('allows package price edits when Warmpawz Pay is active', () => {
    mockedIsWarmpawzPay.mockReturnValue(true);
    expect(canVendorEditServicePrice('at_home', { isPackage: true })).toBe(true);
    expect(canVendorEditServicePrice('at_center', { isPackage: true })).toBe(true);
    expect(canVendorEditServicePrice('at_home', { isPackage: false })).toBe(false);
  });

  it('allows all styles in marketplace mode', () => {
    mockedIsWarmpawzPay.mockReturnValue(false);
    expect(canVendorEditServicePrice('at_home')).toBe(true);
    expect(canVendorEditServicePrice('tele')).toBe(true);
  });

  it('normalizes at_vendor as locked style', () => {
    expect(isPricingLockedServiceStyle('at_vendor')).toBe(true);
  });
});
