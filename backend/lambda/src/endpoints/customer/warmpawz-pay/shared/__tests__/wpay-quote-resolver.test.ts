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
  it('does not apply catalogue pricing_discount_value to payable', async () => {
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
});
