import { evaluateAgainstSnapshot } from '../evaluate-snapshot';
import type { EvaluateSnapshot } from '../evaluate-snapshot';
import type { PromoEnginePromotionRow, PromoEngineRuleRow } from '../../types';

function promo(id: string, letter: 'V' | 'F', vendorId?: string): PromoEnginePromotionRow {
  return {
    id,
    code: null,
    name: id,
    status: 'ACTIVE',
    priority: 10,
    start_at: null,
    end_at: null,
    stacking_policy: 'ORDER_LEVEL',
    funding_type: 'WARMPAWZ',
    funding_split: {},
    budget_limit: null,
    budget_consumed: 0,
    commercial_campaign_id: null,
    service_categories: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    metadata: {
      vcf: {
        visitSource: { letter: 'F', width: 'general' },
        visitLoop: { kind: 'every' },
        benefitMode: 'discount',
        publish:
          letter === 'V'
            ? { letter: 'V', vendorId, channels: ['ecommerce'] }
            : { letter: 'F', channels: ['ecommerce'] },
      },
    },
  };
}

function rule(promotionId: string, value: number): PromoEngineRuleRow {
  return {
    id: `r-${promotionId}`,
    promotion_id: promotionId,
    priority: 1,
    condition_json: { operator: 'AND', conditions: [] },
    benefit_json: [{ type: 'DISCOUNT', mode: 'FIXED', value }],
    rule_type: 'GENERIC',
    is_active: true,
    min_amount: null,
    max_amount: null,
    benefit_mode: 'discount',
  };
}

const snapshot: EvaluateSnapshot = {
  candidates: [promo('vendor-offer', 'V', 'vendor-a'), promo('platform-offer', 'F')],
  rulesByPromo: new Map([
    ['vendor-offer', [rule('vendor-offer', 70)]],
    ['platform-offer', [rule('platform-offer', 15)]],
  ]),
  limitsByPromo: new Map(),
  usageByPromo: new Map(),
  behaviour: { user_id: 'u1', overall: {}, services: {} },
};

describe('evaluateAgainstSnapshot publish_letters', () => {
  it('scores only the vendor promo when letter V is requested', () => {
    const out = evaluateAgainstSnapshot(snapshot, {
      user_id: 'u1',
      transaction: {
        amount: 444,
        channel: 'ecommerce',
        vendorId: 'vendor-a',
        publish_letters: ['V'],
      },
    });
    expect(out.summary.discount).toBe(70);
    expect(out.winner_promotion_id).toBe('vendor-offer');
  });

  it('scores only the platform promo when letter F is requested', () => {
    const out = evaluateAgainstSnapshot(snapshot, {
      user_id: 'u1',
      transaction: {
        amount: 500,
        channel: 'ecommerce',
        publish_letters: ['F'],
      },
    });
    expect(out.summary.discount).toBe(15);
    expect(out.winner_promotion_id).toBe('platform-offer');
  });
});
