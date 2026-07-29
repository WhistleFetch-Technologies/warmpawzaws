import {
  buildWpayDiscountBadges,
  buildWpayVendorCardActions,
  normalizeWpayVendorCardAddress,
  resolveWpayVendorCardRating,
} from '../wpay-vendor-card-map-utils';

describe('resolveWpayVendorCardRating', () => {
  it('returns null when review count is zero', () => {
    expect(resolveWpayVendorCardRating(4.5, 0)).toBeNull();
  });

  it('returns null when rating is invalid or non-positive', () => {
    expect(resolveWpayVendorCardRating('bad', 5)).toBeNull();
    expect(resolveWpayVendorCardRating(0, 5)).toBeNull();
  });

  it('returns normalized rating when valid', () => {
    expect(resolveWpayVendorCardRating('4.2', 8)).toEqual({ average: 4.2, reviewCount: 8 });
  });
});

describe('normalizeWpayVendorCardAddress', () => {
  it('returns undefined for empty or whitespace-only strings', () => {
    expect(normalizeWpayVendorCardAddress('')).toBeUndefined();
    expect(normalizeWpayVendorCardAddress('   ')).toBeUndefined();
  });

  it('returns trimmed address', () => {
    expect(normalizeWpayVendorCardAddress('  42 Park Lane  ')).toBe('42 Park Lane');
  });
});

describe('buildWpayDiscountBadges', () => {
  it('returns undefined when discount is zero or negative', () => {
    expect(buildWpayDiscountBadges(0)).toBeUndefined();
    expect(buildWpayDiscountBadges(-5)).toBeUndefined();
  });

  it('returns discount badge with shared label format', () => {
    expect(buildWpayDiscountBadges(20)).toEqual([{ label: '20% OFF', tone: 'discount' }]);
  });
});

describe('buildWpayVendorCardActions', () => {
  it('builds primary action from parent label and handler', () => {
    const onPrimary = jest.fn();
    const result = buildWpayVendorCardActions({
      primaryLabel: 'Book Appointment',
      onPrimary,
    });

    expect(result.primaryAction).toEqual({
      label: 'Book Appointment',
      variant: 'default',
      onClick: onPrimary,
    });
    expect(result.secondaryAction).toBeUndefined();
  });

  it('builds secondary action only when label and handler are both provided', () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    const result = buildWpayVendorCardActions({
      primaryLabel: 'Book',
      onPrimary,
      secondaryLabel: 'Pay with Warmpawz',
      onSecondary,
    });

    expect(result.secondaryAction).toEqual({
      label: 'Pay with Warmpawz',
      variant: 'outline',
      onClick: onSecondary,
    });
  });

  it('omits secondary action when label is missing', () => {
    const result = buildWpayVendorCardActions({
      primaryLabel: 'Book',
      onPrimary: jest.fn(),
      onSecondary: jest.fn(),
    });

    expect(result.secondaryAction).toBeUndefined();
  });
});
