import { selectEcommercePromotionWinner } from '../ecommerce-promo-policy-winner';
import { loadRuntimePolicy } from '../../discount-engine/policy/runtime-policy-loader';

jest.mock('../../discount-engine/policy/runtime-policy-loader', () => ({
  loadRuntimePolicy: jest.fn(),
}));

jest.mock('../../discount-engine/policy/policy-persistence', () => ({
  loadPublishedPolicyFromDb: jest.fn().mockResolvedValue(null),
}));

const mockLoadRuntimePolicy = loadRuntimePolicy as jest.MockedFunction<typeof loadRuntimePolicy>;

function policyWithStack(allowPlatformWithVendor: boolean) {
  return {
    stack: {
      global: { allowPlatformWithVendor },
    },
  } as ReturnType<typeof loadRuntimePolicy>;
}

describe('selectEcommercePromotionWinner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Best Offer (no stack): picks higher discount', () => {
    mockLoadRuntimePolicy.mockReturnValue(policyWithStack(false));
    const result = selectEcommercePromotionWinner({
      vendorDiscount: 10,
      adminDiscount: 25,
    });
    expect(result.discountAmount).toBe(25);
    expect(result.promotionSource).toBe('admin');
    expect(result.stacked).toBe(false);
    expect(result.vendorApplied).toBe(0);
    expect(result.adminApplied).toBe(25);
  });

  it('Best Offer: vendor wins when higher', () => {
    mockLoadRuntimePolicy.mockReturnValue(policyWithStack(false));
    const result = selectEcommercePromotionWinner({
      vendorDiscount: 30,
      adminDiscount: 12,
    });
    expect(result.discountAmount).toBe(30);
    expect(result.promotionSource).toBe('vendor');
    expect(result.stacked).toBe(false);
  });

  it('Best Offer: tie prefers vendor by default', () => {
    mockLoadRuntimePolicy.mockReturnValue(policyWithStack(false));
    const result = selectEcommercePromotionWinner({
      vendorDiscount: 15,
      adminDiscount: 15,
    });
    expect(result.discountAmount).toBe(15);
    expect(result.promotionSource).toBe('vendor');
  });

  it('stack allowed: sums both and primary is larger funder', () => {
    mockLoadRuntimePolicy.mockReturnValue(policyWithStack(true));
    const result = selectEcommercePromotionWinner({
      vendorDiscount: 10,
      adminDiscount: 25,
    });
    expect(result.discountAmount).toBe(35);
    expect(result.promotionSource).toBe('admin');
    expect(result.stacked).toBe(true);
    expect(result.vendorApplied).toBe(10);
    expect(result.adminApplied).toBe(25);
  });

  it('stack allowed but only one side: no stack flag', () => {
    mockLoadRuntimePolicy.mockReturnValue(policyWithStack(true));
    const result = selectEcommercePromotionWinner({
      vendorDiscount: 0,
      adminDiscount: 20,
    });
    expect(result.discountAmount).toBe(20);
    expect(result.promotionSource).toBe('admin');
    expect(result.stacked).toBe(false);
  });

  it('returns null source when both zero', () => {
    mockLoadRuntimePolicy.mockReturnValue(policyWithStack(false));
    const result = selectEcommercePromotionWinner({
      vendorDiscount: 0,
      adminDiscount: 0,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.promotionSource).toBeNull();
  });
});
