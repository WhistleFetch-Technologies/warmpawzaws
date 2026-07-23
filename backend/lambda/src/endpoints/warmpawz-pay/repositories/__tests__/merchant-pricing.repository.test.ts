import { PRICING_STATUS } from '../../constants/merchant-pricing';
import { MerchantPricingRepository } from '../merchant-pricing.repository';

describe('MerchantPricingRepository', () => {
  it('lists admin pricing rows with pagination params', async () => {
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

    const rows = await repo.listAdmin({
      page: 1,
      pageSize: 20,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].discountValue).toBe(10);
    expect(rows[0].businessName).toBe('Happy Paws');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('warmpawz_pay_merchant_pricing'),
      expect.arrayContaining([20, 0]),
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
});
