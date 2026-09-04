import type { WpayVendorListDbRow } from '../../repos/wpay-vendors-list.repo';
import { resolveWpayVendorCommercialConfig } from '../wpay-commercial-config';

function vendorRow(overrides: Partial<WpayVendorListDbRow> = {}): WpayVendorListDbRow {
  return {
    catalogue_id: 'cat-1',
    vendor_id: 'vendor-1',
    business_name: 'Happy Paws',
    owner_name: 'Anjali',
    address: null,
    city: 'Bengaluru',
    phone: '9999999999',
    vendor_type: null,
    metadata: null,
    profile_photo_url: null,
    customer_service: 'grooming',
    role_category: 'grooming',
    role_config: null,
    legacy_category: null,
    role_name: null,
    role_display_name: null,
    preferred_service_style: null,
    pricing_discount_value: 25,
    pricing_status: 'active',
    pricing_effective_from: new Date('2026-01-01T00:00:00.000Z'),
    pricing_effective_until: null,
    pricing_tier_id: null,
    pricing_tier_name: null,
    pricing_commission_rate: 0,
    pricing_platform_withhold_percent: 5,
    ...overrides,
  };
}

describe('resolveWpayVendorCommercialConfig', () => {
  it('keeps withhold when no tierId is present', () => {
    const config = resolveWpayVendorCommercialConfig(vendorRow());
    expect(config.commercialModel).toBe('withhold');
    expect(config.tierId).toBeNull();
    expect(config.commissionPercent).toBe(0);
    expect(config.discountPercent).toBe(25);
    expect(config.platformWithholdPercent).toBe(5);
  });

  it('uses tier_commission for a 0% commission WPay tier', () => {
    const config = resolveWpayVendorCommercialConfig(
      vendorRow({
        pricing_tier_id: 'tier-zero',
        pricing_tier_name: 'Marketing 0%',
        pricing_commission_rate: 0,
        pricing_discount_value: 25,
      }),
    );
    expect(config.commercialModel).toBe('tier_commission');
    expect(config.tierId).toBe('tier-zero');
    expect(config.commissionPercent).toBe(0);
    expect(config.discountPercent).toBe(25);
    expect(config.platformWithholdPercent).toBe(0);
  });

  it('uses tier_commission for a positive commission WPay tier', () => {
    const config = resolveWpayVendorCommercialConfig(
      vendorRow({
        pricing_tier_id: 'tier-20',
        pricing_tier_name: 'Both',
        pricing_commission_rate: 20,
        pricing_discount_value: 15,
      }),
    );
    expect(config.commercialModel).toBe('tier_commission');
    expect(config.commissionPercent).toBe(20);
    expect(config.discountPercent).toBe(15);
  });
});
