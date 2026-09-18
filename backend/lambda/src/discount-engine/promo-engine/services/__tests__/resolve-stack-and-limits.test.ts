import { resolveStack } from '../../stacking/resolve-stack';
import { evaluateAgainstSnapshot, type EvaluateSnapshot } from '../evaluate-snapshot';
import type { PromoEnginePromotionRow } from '../../types';

function promo(partial: Partial<PromoEnginePromotionRow> & { id: string }): PromoEnginePromotionRow {
  return {
    code: partial.id,
    name: partial.id,
    status: 'ACTIVE',
    priority: 50,
    start_at: null,
    end_at: null,
    stacking_policy: 'DISCOUNT_WITH_CASHBACK',
    funding_type: 'WARMPAWZ',
    funding_split: null,
    budget_limit: null,
    budget_consumed: 0,
    commercial_campaign_id: null,
    service_categories: ['ecommerce'],
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe('resolveStack grouping', () => {
  it('keeps one order discount and still allows cashback', () => {
    const selected = resolveStack({
      candidates: [
        {
          promotion_id: 'HIGH',
          priority: 90,
          stacking_policy: 'DISCOUNT_WITH_CASHBACK',
          benefits: [
            { promotion_id: 'HIGH', rule_id: 'r', benefit_type: 'DISCOUNT', amount: 150, benefit_index: 0 },
            { promotion_id: 'HIGH', rule_id: 'r', benefit_type: 'CASHBACK', amount: 50, benefit_index: 1 },
          ],
        },
        {
          promotion_id: 'LOW',
          priority: 20,
          stacking_policy: 'DISCOUNT_WITH_CASHBACK',
          benefits: [
            { promotion_id: 'LOW', rule_id: 'r', benefit_type: 'DISCOUNT', amount: 40, benefit_index: 0 },
          ],
        },
      ],
    });
    expect(selected.filter((b) => b.benefit_type === 'DISCOUNT')).toHaveLength(1);
    expect(selected.find((b) => b.benefit_type === 'DISCOUNT')?.amount).toBe(150);
    expect(selected.filter((b) => b.benefit_type === 'CASHBACK')).toHaveLength(1);
  });

  it('keeps one SERVICE_LEVEL discount per line', () => {
    const selected = resolveStack({
      candidates: [
        {
          promotion_id: 'L1',
          priority: 70,
          stacking_policy: 'SERVICE_LEVEL',
          groupKey: 'line-a',
          benefits: [
            { promotion_id: 'L1', rule_id: 'r', benefit_type: 'DISCOUNT', amount: 20, benefit_index: 0 },
          ],
        },
        {
          promotion_id: 'L2',
          priority: 70,
          stacking_policy: 'SERVICE_LEVEL',
          groupKey: 'line-b',
          benefits: [
            { promotion_id: 'L2', rule_id: 'r', benefit_type: 'DISCOUNT', amount: 30, benefit_index: 0 },
          ],
        },
      ],
    });
    const discounts = selected.filter((b) => b.benefit_type === 'DISCOUNT');
    expect(discounts).toHaveLength(2);
    expect(discounts.map((d) => d.amount).sort()).toEqual([20, 30]);
  });
});

describe('evaluateAgainstSnapshot per_transaction', () => {
  it('rejects when per_transaction is 0', () => {
    const snapshot: EvaluateSnapshot = {
      candidates: [promo({ id: 'p1', priority: 80 })],
      rulesByPromo: new Map([
        [
          'p1',
          [
            {
              id: 'r1',
              promotion_id: 'p1',
              priority: 100,
              is_active: true,
              rule_type: 'GENERIC',
              condition_json: { operator: 'AND', conditions: [] },
              benefit_json: [{ type: 'DISCOUNT', mode: 'FIXED', value: 50 }],
            },
          ],
        ],
      ]),
      limitsByPromo: new Map([
        [
          'p1',
          {
            promotion_id: 'p1',
            per_user: null,
            per_transaction: 0,
            daily_limit: null,
            campaign_limit: null,
            budget_limit: null,
          },
        ],
      ]),
      usageByPromo: new Map(),
      behaviour: { user_id: 'u1', overall: {}, services: {} },
    };
    const result = evaluateAgainstSnapshot(snapshot, {
      user_id: 'u1',
      persist: false,
      transaction: { type: 'ECOMMERCE', service_category: 'ecommerce', amount: 500 },
    });
    expect(result.eligible).toBe(false);
    expect(result.explain.rejected_promotions[0]?.reason).toBe('PER_TRANSACTION_LIMIT');
  });
});
