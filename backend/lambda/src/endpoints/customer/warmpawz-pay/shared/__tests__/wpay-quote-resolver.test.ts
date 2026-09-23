import { resolveWpayPayQuote } from '../wpay-quote-resolver';

jest.mock('../../../../warmpawz-pay/repositories/wpay-convenience-settings.repository', () => ({
  wpayConvenienceSettingsRepository: {
    getConvenienceSettings: jest.fn().mockResolvedValue({
      platformFee: 0,
      platformFeeMode: 'fixed',
      platformFeeGstRate: 0,
      convenienceFee: 0,
      convenienceFeeMode: 'fixed',
      convenienceGstRate: 0,
      platformGstRate: 0,
      burnMode: false,
    }),
  },
}));

describe('resolveWpayPayQuote', () => {
  const { wpayConvenienceSettingsRepository } = jest.requireMock(
    '../../../../warmpawz-pay/repositories/wpay-convenience-settings.repository',
  ) as {
    wpayConvenienceSettingsRepository: { getConvenienceSettings: jest.Mock };
  };

  beforeEach(() => {
    wpayConvenienceSettingsRepository.getConvenienceSettings.mockResolvedValue({
      platformFee: 30,
      platformFeeMode: 'fixed',
      platformFeeGstRate: 18,
      convenienceFee: 20,
      convenienceFeeMode: 'fixed',
      convenienceGstRate: 18,
      platformGstRate: 18,
      burnMode: false,
    });
  });

  it('does not apply catalogue pricing_discount_value to payable', async () => {
    wpayConvenienceSettingsRepository.getConvenienceSettings.mockResolvedValue({
      platformFee: 0,
      platformFeeMode: 'fixed',
      platformFeeGstRate: 0,
      convenienceFee: 0,
      convenienceFeeMode: 'fixed',
      convenienceGstRate: 0,
      platformGstRate: 0,
      burnMode: false,
    });
    const resolved = await resolveWpayPayQuote({
      vendorRow: {
        catalogue_id: 'cat-1',
        vendor_id: 'vendor-1',
        business_name: 'Vet Clinic',
        owner_name: null,
        address: null,
        city: null,
        phone: null,
        vendor_type: 'clinic',
        metadata: null,
        profile_photo_url: null,
        customer_service: null,
        role_category: 'vet',
        role_config: null,
        legacy_category: 'veterinary',
        role_name: 'Vet',
        role_display_name: 'Veterinarian',
        preferred_service_style: null,
        pricing_discount_value: 15,
        pricing_status: 'active',
        pricing_effective_from: null,
        pricing_effective_until: null,
        pricing_platform_withhold_percent: 10,
      },
      quotedAmount: 1000,
    });

    expect(resolved.payableAmount).toBe(1000);
    expect(resolved.metadata.quotedDiscountAmount).toBe(0);
  });

  it('applies dashboard fees when engine discount creates headroom under Q', async () => {
    const resolved = await resolveWpayPayQuote({
      vendorRow: {
        catalogue_id: 'cat-1',
        vendor_id: 'vendor-1',
        business_name: 'Grooming',
        owner_name: null,
        address: null,
        city: null,
        phone: null,
        vendor_type: 'solo',
        metadata: null,
        profile_photo_url: null,
        customer_service: null,
        role_category: 'grooming',
        role_config: null,
        legacy_category: 'grooming',
        role_name: 'Groomer',
        role_display_name: 'Groomer',
        preferred_service_style: null,
        pricing_discount_value: 0,
        pricing_status: 'active',
        pricing_effective_from: null,
        pricing_effective_until: null,
        pricing_platform_withhold_percent: null,
        pricing_commission_rate: 20,
        pricing_tier_id: 'tier-1',
        pricing_tier_name: 'Walk-in',
      } as never,
      quotedAmount: 1000,
      engineDiscount: 80,
    });

    expect(resolved.commercialModel).toBe('tier_commission');
    if (resolved.commercialModel !== 'tier_commission') return;
    expect(resolved.quote.discountAmount).toBe(80);
    expect(resolved.quote.platformFee).toBe(30);
    expect(resolved.quote.convenienceFee).toBe(20);
    expect(resolved.payableAmount).toBe(979);
    expect(resolved.payableAmount).toBeLessThanOrEqual(1000);
  });
});
