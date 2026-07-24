import { PRICING_STATUS } from '../../constants/merchant-pricing';
import { MerchantPricingRepository } from '../merchant-pricing.repository';

describe('MerchantPricingRepository', () => {
  it('finds pricing by vendor id', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: 'pricing-1',
          vendor_id: 'vendor-1',
          catalogue_id: 'cat-1',
          discount_type: 'percentage',
          discount_value: '10',
          status: PRICING_STATUS.ACTIVE,
          effective_from: new Date('2026-07-01T00:00:00.000Z'),
          effective_until: null,
          created_by: null,
          created_at: new Date('2026-07-01T00:00:00.000Z'),
          updated_at: new Date('2026-07-23T00:00:00.000Z'),
          business_name: 'Happy Paws',
          owner_name: 'Anjali',
          legacy_category: null,
          role_category: 'grooming',
          customer_service: 'grooming',
          role_config: null,
        },
      ],
    });
    const repo = new MerchantPricingRepository({ query });

    const row = await repo.findByVendorId('vendor-1');

    expect(row?.discountValue).toBe(10);
    expect(row?.businessName).toBe('Happy Paws');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('warmpawz_pay_merchant_pricing'),
      ['vendor-1'],
    );
  });

  it('returns average active percentage discount', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ average_discount: 12.5 }] });
    const repo = new MerchantPricingRepository({ query });

    await expect(repo.getAverageActiveDiscountPercent()).resolves.toBe(12.5);
  });

  it('returns active configured vendor ids', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ vendor_id: 'vendor-1' }, { vendor_id: 'vendor-2' }],
    });
    const repo = new MerchantPricingRepository({ query });

    const ids = await repo.getActiveConfiguredVendorIds(['vendor-1', 'vendor-2']);
    expect(ids.has('vendor-1')).toBe(true);
    expect(ids.has('vendor-2')).toBe(true);
  });

  it('stores null created_by for non-UUID admin actors on insert', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: 'pricing-1',
          vendor_id: 'vendor-1',
          catalogue_id: 'cat-1',
          discount_type: 'percentage',
          discount_value: '15',
          status: PRICING_STATUS.ACTIVE,
          effective_from: new Date('2026-07-01T00:00:00.000Z'),
          effective_until: null,
          created_by: null,
          created_at: new Date('2026-07-01T00:00:00.000Z'),
          updated_at: new Date('2026-07-23T00:00:00.000Z'),
        },
      ],
    });
    const repo = new MerchantPricingRepository({ query });

    await repo.insert(
      {
        vendorId: 'vendor-1',
        discountType: 'percentage',
        discountValue: 15,
        status: PRICING_STATUS.ACTIVE,
        effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
        effectiveUntil: null,
        createdBy: 'uat-admin-user',
      },
      'cat-1',
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO warmpawz_pay_merchant_pricing'),
      expect.arrayContaining([null]),
    );
  });
});
