import {
  formatCommissionRateDisplay,
  formatCommissionRateSource,
  parseVendorCommissionAnalytics,
} from '../vendor-commission-analytics';

describe('parseVendorCommissionAnalytics', () => {
  it('parses configured ecommerce commission rate', () => {
    const parsed = parseVendorCommissionAnalytics({
      commissionRate: 12.5,
      commissionRateSource: 'vendor_default',
      commissionConfigured: true,
      commissionMissing: [],
      gstRate: 18,
      totalRevenue: 1000,
      totalCommission: 125,
      netEarnings: 875,
      pendingPayout: 200,
      tiers: [],
    });

    expect(parsed?.commissionConfigured).toBe(true);
    expect(parsed?.commissionRate).toBe(12.5);
    expect(parsed?.commissionRateSource).toBe('vendor_default');
    expect(parsed?.gstRate).toBe(18);
  });

  it('returns null rate when commission is not configured', () => {
    const parsed = parseVendorCommissionAnalytics({
      commissionRate: null,
      commissionRateSource: null,
      commissionConfigured: false,
      commissionMissing: ['commission_model'],
      gstRate: 0,
      totalRevenue: 0,
      totalCommission: 0,
      netEarnings: 0,
      pendingPayout: 0,
      tiers: [],
    });

    expect(parsed?.commissionConfigured).toBe(false);
    expect(parsed?.commissionRate).toBeNull();
    expect(parsed?.commissionMissing).toEqual(['commission_model']);
  });
});

describe('formatCommissionRateDisplay', () => {
  it('formats configured rate', () => {
    expect(formatCommissionRateDisplay(25, true)).toBe('25%');
    expect(formatCommissionRateDisplay(8.6, true)).toBe('8.6%');
  });

  it('shows dash when not configured', () => {
    expect(formatCommissionRateDisplay(null, false)).toBe('—');
    expect(formatCommissionRateDisplay(15, false)).toBe('—');
  });
});

describe('formatCommissionRateSource', () => {
  it('maps known sources to friendly labels', () => {
    expect(formatCommissionRateSource('vendor_default')).toBe('Your default shop rate');
    expect(formatCommissionRateSource('vendor_own_brand')).toBe('Own brand rate');
  });
});
