import { resolveEcommerceEngineDiscount } from '../resolve-ecommerce-engine-discount';

jest.mock('../../../../discount-engine/promo-engine/services/owned-evaluation', () => ({
  loadOwnedEvaluationDiscount: jest.fn(),
}));

jest.mock('../../../../discount-engine/promo-engine', () => ({
  safeEvaluatePromotions: jest.fn(),
}));

const { loadOwnedEvaluationDiscount } = jest.requireMock(
  '../../../../discount-engine/promo-engine/services/owned-evaluation',
) as { loadOwnedEvaluationDiscount: jest.Mock };
const { safeEvaluatePromotions } = jest.requireMock(
  '../../../../discount-engine/promo-engine',
) as { safeEvaluatePromotions: jest.Mock };

describe('resolveEcommerceEngineDiscount', () => {
  beforeEach(() => {
    loadOwnedEvaluationDiscount.mockReset();
    safeEvaluatePromotions.mockReset();
  });

  it('uses the stored preview evaluation so place-order matches cart', async () => {
    loadOwnedEvaluationDiscount.mockResolvedValue({
      evaluationId: '11111111-1111-4111-8111-111111111111',
      discount: 90,
      cashback: 50,
      eligible: true,
    });
    const result = await resolveEcommerceEngineDiscount({
      customerId: 'cust-1',
      evaluationId: '11111111-1111-4111-8111-111111111111',
      amount: 600,
    });
    expect(result.discount).toBe(90);
    expect(result.evaluationId).toBe('11111111-1111-4111-8111-111111111111');
    expect(safeEvaluatePromotions).not.toHaveBeenCalled();
  });
});
