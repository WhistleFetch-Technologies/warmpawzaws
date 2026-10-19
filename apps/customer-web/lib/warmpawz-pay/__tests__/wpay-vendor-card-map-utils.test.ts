import {
  buildWpayDiscountBadges,
  buildWpayVendorCardActions,
  formatWpayCatalogueDiscountLabel,
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

  it('rounds the average to one decimal', () => {
    expect(resolveWpayVendorCardRating('4.8333333333333333', 6)).toEqual({ average: 4.8, reviewCount: 6 });
    expect(resolveWpayVendorCardRating(4.86, 3)).toEqual({ average: 4.9, reviewCount: 3 });
    expect(resolveWpayVendorCardRating(5, 1)).toEqual({ average: 5, reviewCount: 1 });
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

describe('formatWpayCatalogueDiscountLabel', () => {
  it('names Instant Savings when a discount exists, with no percent', () => {
    expect(formatWpayCatalogueDiscountLabel(0)).toBeUndefined();
    expect(formatWpayCatalogueDiscountLabel(10)).toBe('Instant Savings');
    expect(formatWpayCatalogueDiscountLabel(40)).toBe('Instant Savings');
  });
});

describe('buildWpayDiscountBadges', () => {
  it('shows Instant Savings without a percent, and Wallet Cashback when the offer earns it', () => {
    expect(buildWpayDiscountBadges(0)).toBeUndefined();
    expect(buildWpayDiscountBadges(8)).toEqual([{ label: 'Instant Savings', tone: 'discount' }]);
    expect(buildWpayDiscountBadges(20, true)).toEqual([
      { label: 'Instant Savings', tone: 'discount' },
      { label: 'Wallet Cashback', tone: 'success' },
    ]);
  });

  it('shows Wallet Cashback alone when the offer has no instant discount', () => {
    expect(buildWpayDiscountBadges(0, true)).toEqual([{ label: 'Wallet Cashback', tone: 'success' }]);
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
