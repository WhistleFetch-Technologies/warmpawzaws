import {
  buildPaymentTierListWhere,
  mapVendorPaymentTierRow,
  parseOptionalBooleanQuery,
  parseTierApplicabilityFlags,
} from '../payment-tier-applicability';

describe('payment-tier-applicability', () => {
  it('defaults create flags to marketplace-only', () => {
    expect(parseTierApplicabilityFlags({}, { marketplaceEnabled: true, warmpawzPayEnabled: false })).toEqual({
      marketplaceEnabled: true,
      warmpawzPayEnabled: false,
    });
  });

  it('accepts Both as true/true', () => {
    expect(
      parseTierApplicabilityFlags(
        { marketplaceEnabled: true, warmpawzPayEnabled: true },
        { marketplaceEnabled: true, warmpawzPayEnabled: false },
      ),
    ).toEqual({ marketplaceEnabled: true, warmpawzPayEnabled: true });
  });

  it('accepts WPay-only', () => {
    expect(
      parseTierApplicabilityFlags(
        { marketplace_enabled: false, warmpawz_pay_enabled: true },
        { marketplaceEnabled: true, warmpawzPayEnabled: false },
      ),
    ).toEqual({ marketplaceEnabled: false, warmpawzPayEnabled: true });
  });

  it('maps DB row flags for Abhi contract', () => {
    const mapped = mapVendorPaymentTierRow({
      id: 'tier-1',
      tier_name: 'Tier 2',
      display_name: 'Standard',
      description: 'WPay',
      commission_rate: '20',
      payout_period_days: 7,
      monthly_cost: 0,
      yearly_cost: 0,
      is_default: false,
      is_active: true,
      features: [],
      applicable_roles: [],
      terms_and_conditions: '',
      terms_version: '1.0',
      marketplace_enabled: false,
      warmpawz_pay_enabled: true,
    });
    expect(mapped.marketplaceEnabled).toBe(false);
    expect(mapped.warmpawzPayEnabled).toBe(true);
    expect(mapped.commissionRate).toBe(20);
  });

  it('treats missing marketplace_enabled as true and missing WPay as false', () => {
    const mapped = mapVendorPaymentTierRow({
      id: 'tier-1',
      tier_name: 'Basic',
      display_name: 'Basic',
      commission_rate: 15,
    });
    expect(mapped.marketplaceEnabled).toBe(true);
    expect(mapped.warmpawzPayEnabled).toBe(false);
  });

  it('builds WPay-eligible list filter', () => {
    expect(parseOptionalBooleanQuery('true')).toBe(true);
    expect(parseOptionalBooleanQuery('false')).toBe(false);
    expect(parseOptionalBooleanQuery(undefined)).toBeUndefined();
    const where = buildPaymentTierListWhere({ warmpawzPayEnabled: true, isActive: true });
    expect(where.sql).toBe('WHERE warmpawz_pay_enabled = $1 AND is_active = $2');
    expect(where.values).toEqual([true, true]);
  });
});
