import { calculateBenefits } from '../../benefits/calculate-benefits';
import { resolveStack } from '../../stacking/resolve-stack';

describe('promo-engine benefits + stacking', () => {
  it('caps percentage discount at max_amount', () => {
    const benefits = calculateBenefits({
      promotionId: 'P1',
      ruleId: 'R1',
      orderAmount: 1500,
      benefits: [
        {
          type: 'DISCOUNT',
          value_type: 'PERCENTAGE',
          value: 20,
          max_amount: 300,
        },
        {
          type: 'CASHBACK',
          mode: 'FIXED',
          value: 150,
          expiryDays: 30,
          redeemScope: ['VET', 'TRAINING'],
        },
      ],
    });
    expect(benefits.find((b) => b.benefit_type === 'DISCOUNT')?.amount).toBe(300);
    expect(benefits.find((b) => b.benefit_type === 'CASHBACK')?.amount).toBe(150);
  });

  it('keeps one discount by priority but allows cashback with DISCOUNT_WITH_CASHBACK', () => {
    const selected = resolveStack({
      candidates: [
        {
          promotion_id: 'LOW',
          priority: 20,
          stacking_policy: 'DISCOUNT_WITH_CASHBACK',
          benefits: [
            {
              promotion_id: 'LOW',
              rule_id: 'r',
              benefit_type: 'DISCOUNT',
              amount: 100,
              benefit_index: 0,
            },
          ],
        },
        {
          promotion_id: 'HIGH',
          priority: 80,
          stacking_policy: 'DISCOUNT_WITH_CASHBACK',
          benefits: [
            {
              promotion_id: 'HIGH',
              rule_id: 'r',
              benefit_type: 'DISCOUNT',
              amount: 300,
              benefit_index: 0,
            },
            {
              promotion_id: 'HIGH',
              rule_id: 'r',
              benefit_type: 'CASHBACK',
              amount: 150,
              benefit_index: 1,
            },
          ],
        },
      ],
    });
    const discounts = selected.filter((b) => b.benefit_type === 'DISCOUNT');
    const cashbacks = selected.filter((b) => b.benefit_type === 'CASHBACK');
    expect(discounts).toHaveLength(1);
    expect(discounts[0].amount).toBe(300);
    expect(cashbacks).toHaveLength(1);
  });
});
