import { PRICING_DISCOUNT_TYPE, PRICING_STATUS } from '../../../constants/merchant-pricing';
import type { IMerchantPricingRepository, PricingRow } from '../../../repositories/interfaces/IMerchantPricingRepository';
import { PricingErrorCode } from '../dto/pricing.errors';
import {
  PricingAdminError,
  WarmpawzPayPricingService,
} from '../services/warmpawz-pay-pricing.service';
import { PricingAuditService } from '../services/pricing-audit.service';

describe('WarmpawzPayPricingService', () => {
  const sampleRow = {
    id: 'pricing-1',
    vendorId: 'vendor-1',
    catalogueId: 'cat-1',
    discountType: PRICING_DISCOUNT_TYPE.PERCENTAGE,
    discountValue: 10,
    status: PRICING_STATUS.ACTIVE,
    effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
    effectiveUntil: null,
    createdBy: 'admin-1',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-23T00:00:00.000Z'),
    businessName: 'Happy Paws',
    ownerName: 'Anjali',
    legacyCategory: null,
    roleCategory: 'grooming',
    customerService: 'grooming',
    roleConfig: null,
  } as const;

  const auditService = {
    logCreated: jest.fn().mockResolvedValue(undefined),
    logUpdated: jest.fn().mockResolvedValue(undefined),
    logEnabled: jest.fn().mockResolvedValue(undefined),
    logDisabled: jest.fn().mockResolvedValue(undefined),
    logDeleted: jest.fn().mockResolvedValue(undefined),
  } as unknown as PricingAuditService;

  it('lists pricing rows with pagination', async () => {
    const repository: IMerchantPricingRepository = {
      listAdmin: jest.fn().mockResolvedValue([sampleRow]),
      countAdmin: jest.fn().mockResolvedValue(1),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService);
    const result = await service.listPricing({
      page: 1,
      pageSize: 20,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    expect(result.items[0].businessName).toBe('Happy Paws');
    expect(result.items[0].discountValue).toBe(10);
    expect(result.pagination.total).toBe(1);
  });

  it('rejects duplicate pricing on create', async () => {
    const repository: IMerchantPricingRepository = {
      assertCatalogueVendor: jest.fn().mockResolvedValue({ catalogueId: 'cat-1' }),
      findRowByVendorId: jest.fn().mockResolvedValue({ id: 'pricing-1' } as PricingRow),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService);

    await expect(
      service.createPricing(
        {
          vendorId: 'vendor-1',
          discountType: PRICING_DISCOUNT_TYPE.PERCENTAGE,
          discountValue: 10,
          status: PRICING_STATUS.ACTIVE,
          effectiveFrom: '2026-07-01T00:00:00.000Z',
        },
        'admin-1',
      ),
    ).rejects.toMatchObject({
      code: PricingErrorCode.DUPLICATE_PRICING,
    });
  });

  it('rejects invalid effective date range', async () => {
    const repository: IMerchantPricingRepository = {
      assertCatalogueVendor: jest.fn().mockResolvedValue({ catalogueId: 'cat-1' }),
      findRowByVendorId: jest.fn().mockResolvedValue(null),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService);

    await expect(
      service.createPricing(
        {
          vendorId: 'vendor-1',
          discountType: PRICING_DISCOUNT_TYPE.PERCENTAGE,
          discountValue: 10,
          status: PRICING_STATUS.ACTIVE,
          effectiveFrom: '2026-08-01T00:00:00.000Z',
          effectiveUntil: '2026-07-01T00:00:00.000Z',
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(PricingAdminError);
  });
});
