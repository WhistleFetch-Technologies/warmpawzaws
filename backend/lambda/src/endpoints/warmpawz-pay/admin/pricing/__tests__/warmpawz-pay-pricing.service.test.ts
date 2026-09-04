import { PRICING_DISCOUNT_TYPE, PRICING_STATUS } from '../../../constants/merchant-pricing';
import type {
  IMerchantPricingRepository,
  PricingRow,
  PricingRowWithMerchant,
  WpayPublishTierRow,
} from '../../../repositories/interfaces/IMerchantPricingRepository';
import type { IWpayConvenienceSettingsRepository } from '../../../repositories/interfaces/IWpayConvenienceSettingsRepository';
import type { CreatePricingRequest } from '../dto/pricing.requests';
import { PricingErrorCode } from '../dto/pricing.errors';
import {
  assertDiscountBelowCommission,
  PricingAdminError,
  WarmpawzPayPricingService,
} from '../services/warmpawz-pay-pricing.service';
import { PricingAuditService } from '../services/pricing-audit.service';

const TIER_BOTH = '22222222-2222-4222-8222-222222222222';
const TIER_MARKETPLACE = '33333333-3333-4333-8333-333333333333';
const TIER_INACTIVE = '44444444-4444-4444-8444-444444444444';

const bothTier: WpayPublishTierRow = {
  id: TIER_BOTH,
  tierName: 'both',
  displayName: 'Both',
  commissionRate: 20,
  isActive: true,
  warmpawzPayEnabled: true,
};

const marketplaceOnlyTier: WpayPublishTierRow = {
  id: TIER_MARKETPLACE,
  tierName: 'marketplace',
  displayName: 'Marketplace only',
  commissionRate: 20,
  isActive: true,
  warmpawzPayEnabled: false,
};

const inactiveTier: WpayPublishTierRow = {
  id: TIER_INACTIVE,
  tierName: 'inactive',
  displayName: 'Inactive',
  commissionRate: 20,
  isActive: false,
  warmpawzPayEnabled: true,
};

const TIER_ZERO = '55555555-5555-4555-8555-555555555555';

const zeroCommissionTier: WpayPublishTierRow = {
  id: TIER_ZERO,
  tierName: 'marketing-zero',
  displayName: 'Marketing 0%',
  commissionRate: 0,
  isActive: true,
  warmpawzPayEnabled: true,
};

function settingsRepo(burnMode = false): IWpayConvenienceSettingsRepository {
  return {
    getConvenienceSettings: jest.fn().mockResolvedValue({
      platformFee: 0,
      platformFeeGstRate: 18,
      convenienceFee: 0,
      convenienceGstRate: 18,
      platformGstRate: 18,
      burnMode,
    }),
    putConvenienceSettings: jest.fn(),
  };
}

describe('assertDiscountBelowCommission', () => {
  it('rejects discount equal to commission (Case 5)', () => {
    expect(() => assertDiscountBelowCommission(20, 20)).toThrow(PricingAdminError);
  });

  it('rejects discount greater than commission (Case 6)', () => {
    expect(() => assertDiscountBelowCommission(21, 20)).toThrow(PricingAdminError);
  });

  it('accepts discount strictly below commission (Case 7)', () => {
    expect(() => assertDiscountBelowCommission(15, 20)).not.toThrow();
  });

  it('allows discount above commission when burn mode is on', () => {
    expect(() => assertDiscountBelowCommission(25, 0, true)).not.toThrow();
    expect(() => assertDiscountBelowCommission(25, 20, true)).not.toThrow();
  });
});

describe('WarmpawzPayPricingService', () => {
  const sampleRow: PricingRowWithMerchant = {
    id: 'pricing-1',
    vendorId: 'vendor-1',
    catalogueId: 'cat-1',
    tierId: TIER_BOTH,
    tierName: 'both',
    tierDisplayName: 'Both',
    commissionRate: 20,
    discountType: PRICING_DISCOUNT_TYPE.PERCENTAGE,
    discountValue: 10,
    platformWithholdPercent: 5,
    status: PRICING_STATUS.ACTIVE,
    effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
    effectiveUntil: null,
    createdBy: 'admin-1',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-23T00:00:00.000Z'),
    businessName: 'Happy Paws',
    ownerName: 'Anjali',
    vendorType: null,
    roleName: null,
    isSoloProvider: false,
    legacyCategory: null,
    roleCategory: 'grooming',
    customerService: 'grooming',
    roleConfig: null,
  };

  const auditService = {
    logCreated: jest.fn().mockResolvedValue(undefined),
    logUpdated: jest.fn().mockResolvedValue(undefined),
    logEnabled: jest.fn().mockResolvedValue(undefined),
    logDisabled: jest.fn().mockResolvedValue(undefined),
    logDeleted: jest.fn().mockResolvedValue(undefined),
  } as unknown as PricingAuditService;

  function createInput(overrides: Partial<CreatePricingRequest> = {}): CreatePricingRequest {
    return {
      vendorId: 'vendor-1',
      tierId: TIER_BOTH,
      discountType: PRICING_DISCOUNT_TYPE.PERCENTAGE,
      discountValue: 15,
      status: PRICING_STATUS.ACTIVE,
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('returns pricing detail by merchant id with inherited commission and margin', async () => {
    const repository: IMerchantPricingRepository = {
      findByVendorId: jest.fn().mockResolvedValue(sampleRow),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService);
    const result = await service.getPricingByMerchantId('vendor-1');

    expect(result?.businessName).toBe('Happy Paws');
    expect(result?.discountValue).toBe(10);
    expect(result?.tierId).toBe(TIER_BOTH);
    expect(result?.tierName).toBe('Both');
    expect(result?.commissionRate).toBe(20);
    expect(result?.platformMargin).toBe(10);
    expect(result?.platformWithholdPercent).toBe(5);
  });

  it('rejects duplicate pricing on create', async () => {
    const repository: IMerchantPricingRepository = {
      assertCatalogueVendor: jest.fn().mockResolvedValue({ catalogueId: 'cat-1' }),
      findRowByVendorId: jest.fn().mockResolvedValue({ id: 'pricing-1' } as PricingRow),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService);

    await expect(service.createPricing(createInput(), 'admin-1')).rejects.toMatchObject({
      code: PricingErrorCode.DUPLICATE_PRICING,
    });
  });

  it('rejects invalid effective date range', async () => {
    const repository: IMerchantPricingRepository = {
      assertCatalogueVendor: jest.fn().mockResolvedValue({ catalogueId: 'cat-1' }),
      findRowByVendorId: jest.fn().mockResolvedValue(null),
      findWpayPublishTier: jest.fn().mockResolvedValue(bothTier),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService, settingsRepo());

    await expect(
      service.createPricing(
        createInput({
          effectiveFrom: '2026-08-01T00:00:00.000Z',
          effectiveUntil: '2026-07-01T00:00:00.000Z',
        }),
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(PricingAdminError);
  });

  it('rejects discount equal to commission on create (Case 5)', async () => {
    const repository: IMerchantPricingRepository = {
      assertCatalogueVendor: jest.fn().mockResolvedValue({ catalogueId: 'cat-1' }),
      findRowByVendorId: jest.fn().mockResolvedValue(null),
      findWpayPublishTier: jest.fn().mockResolvedValue(bothTier),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService, settingsRepo());

    await expect(service.createPricing(createInput({ discountValue: 20 }), 'admin-1')).rejects.toMatchObject({
      code: PricingErrorCode.VALIDATION_ERROR,
    });
  });

  it('rejects discount greater than commission on create (Case 6)', async () => {
    const repository: IMerchantPricingRepository = {
      assertCatalogueVendor: jest.fn().mockResolvedValue({ catalogueId: 'cat-1' }),
      findRowByVendorId: jest.fn().mockResolvedValue(null),
      findWpayPublishTier: jest.fn().mockResolvedValue(bothTier),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService, settingsRepo());

    await expect(service.createPricing(createInput({ discountValue: 21 }), 'admin-1')).rejects.toMatchObject({
      code: PricingErrorCode.VALIDATION_ERROR,
    });
  });

  it('accepts Both-tier publish when discount is below commission (Cases 7 + 12)', async () => {
    const inserted: PricingRow = {
      ...sampleRow,
      discountValue: 15,
      platformWithholdPercent: 0,
    };
    const repository: IMerchantPricingRepository = {
      assertCatalogueVendor: jest.fn().mockResolvedValue({ catalogueId: 'cat-1' }),
      findRowByVendorId: jest.fn().mockResolvedValue(null),
      findWpayPublishTier: jest.fn().mockResolvedValue(bothTier),
      hasActiveConfiguredPricing: jest.fn().mockResolvedValue(false),
      insert: jest.fn().mockResolvedValue(inserted),
      findByVendorId: jest.fn().mockResolvedValue({ ...sampleRow, discountValue: 15, platformWithholdPercent: 0 }),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService, settingsRepo());
    const result = await service.createPricing(createInput({ discountValue: 15 }), 'admin-1');

    expect(result.commissionRate).toBe(20);
    expect(result.discountValue).toBe(15);
    expect(result.platformMargin).toBe(5);
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tierId: TIER_BOTH,
        discountValue: 15,
        platformWithholdPercent: 0,
      }),
      'cat-1',
    );
  });

  it('rejects marketplace-only tier (Case 11)', async () => {
    const repository: IMerchantPricingRepository = {
      assertCatalogueVendor: jest.fn().mockResolvedValue({ catalogueId: 'cat-1' }),
      findRowByVendorId: jest.fn().mockResolvedValue(null),
      findWpayPublishTier: jest.fn().mockResolvedValue(marketplaceOnlyTier),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService);

    await expect(
      service.createPricing(createInput({ tierId: TIER_MARKETPLACE }), 'admin-1'),
    ).rejects.toMatchObject({
      code: PricingErrorCode.VALIDATION_ERROR,
    });
  });

  it('rejects inactive WPay tier (Case 10)', async () => {
    const repository: IMerchantPricingRepository = {
      assertCatalogueVendor: jest.fn().mockResolvedValue({ catalogueId: 'cat-1' }),
      findRowByVendorId: jest.fn().mockResolvedValue(null),
      findWpayPublishTier: jest.fn().mockResolvedValue(inactiveTier),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService);

    await expect(
      service.createPricing(createInput({ tierId: TIER_INACTIVE }), 'admin-1'),
    ).rejects.toMatchObject({
      code: PricingErrorCode.VALIDATION_ERROR,
    });
  });

  it('rejects 0% tier when burn mode is off', async () => {
    const repository: IMerchantPricingRepository = {
      assertCatalogueVendor: jest.fn().mockResolvedValue({ catalogueId: 'cat-1' }),
      findRowByVendorId: jest.fn().mockResolvedValue(null),
      findWpayPublishTier: jest.fn().mockResolvedValue(zeroCommissionTier),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService, settingsRepo(false));

    await expect(
      service.createPricing(createInput({ tierId: TIER_ZERO, discountValue: 25 }), 'admin-1'),
    ).rejects.toMatchObject({
      code: PricingErrorCode.VALIDATION_ERROR,
    });
  });

  it('accepts 0% tier and discount above commission when burn mode is on', async () => {
    const inserted: PricingRow = {
      ...sampleRow,
      tierId: TIER_ZERO,
      tierName: 'marketing-zero',
      discountValue: 25,
      platformWithholdPercent: 0,
    };
    const repository: IMerchantPricingRepository = {
      assertCatalogueVendor: jest.fn().mockResolvedValue({ catalogueId: 'cat-1' }),
      findRowByVendorId: jest.fn().mockResolvedValue(null),
      findWpayPublishTier: jest.fn().mockResolvedValue(zeroCommissionTier),
      hasActiveConfiguredPricing: jest.fn().mockResolvedValue(false),
      insert: jest.fn().mockResolvedValue(inserted),
      findByVendorId: jest.fn().mockResolvedValue({
        ...sampleRow,
        tierId: TIER_ZERO,
        tierName: 'marketing-zero',
        tierDisplayName: 'Marketing 0%',
        commissionRate: 0,
        discountValue: 25,
        platformWithholdPercent: 0,
      }),
    } as unknown as IMerchantPricingRepository;

    const service = new WarmpawzPayPricingService(repository, auditService, settingsRepo(true));
    const result = await service.createPricing(
      createInput({ tierId: TIER_ZERO, discountValue: 25 }),
      'admin-1',
    );

    expect(result.commissionRate).toBe(0);
    expect(result.discountValue).toBe(25);
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tierId: TIER_ZERO,
        discountValue: 25,
        platformWithholdPercent: 0,
      }),
      'cat-1',
    );
  });
});
