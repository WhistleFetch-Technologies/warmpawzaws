import { scoreVcfCandidates } from '../evaluate-vcf';
import type { PromoEnginePromotionRow, PromoEngineRuleRow } from '../../types';
import { emptyVisitProfile } from '../../vcf/types';

function promo(partial: Partial<PromoEnginePromotionRow> & { id: string }): PromoEnginePromotionRow {
  return {
    code: null,
    name: partial.id,
    status: 'ACTIVE',
    priority: 10,
    start_at: null,
    end_at: null,
    stacking_policy: 'DISCOUNT_WITH_CASHBACK',
    funding_type: 'WARMPAWZ',
    funding_split: {},
    budget_limit: null,
    budget_consumed: 0,
    commercial_campaign_id: null,
    service_categories: [],
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

function range(
  id: string,
  promotionId: string,
  min: number | null,
  max: number | null,
  discount: number,
  extra: Partial<PromoEngineRuleRow> = {},
): PromoEngineRuleRow {
  return {
    id,
    promotion_id: promotionId,
    priority: 100,
    condition_json: { operator: 'AND', conditions: [] },
    benefit_json: [
      { type: 'DISCOUNT', mode: 'FIXED', value: discount, maxAmount: discount },
      { type: 'CASHBACK', mode: 'FIXED', value: discount / 2, expiryDays: 15 },
    ],
    rule_type: 'CUSTOMER_JOURNEY',
    is_active: true,
    min_amount: min,
    max_amount: max,
    benefit_mode: 'both',
    budget_consumed: 0,
    ...extra,
  };
}

const vcf = {
  visitSource: { letter: 'F', width: 'general' },
  visitLoop: { kind: 'every' },
  benefitMode: 'discount',
  maxDiscount: 10,
  expiryDays: 30,
  publish: { letter: 'F' },
};

const ladder = promo({ id: 'ladder', priority: 50, metadata: { vcf } });
const floor = promo({ id: 'floor', priority: 10, metadata: { vcf } });

const ladderRanges = [
  range('r1', 'ladder', 1, 500, 55),
  range('r2', 'ladder', 500, 2000, 125),
  range('r3', 'ladder', 2000, null, 250),
];

function score(amount: number, overrides: Partial<Parameters<typeof scoreVcfCandidates>[0]> = {}) {
  return scoreVcfCandidates({
    candidates: [ladder],
    rulesByPromo: new Map([['ladder', ladderRanges]]),
    limitsByPromo: new Map(),
    usageByPromo: new Map(),
    behaviour: { user_id: 'u1', overall: {}, services: { vcf: emptyVisitProfile() } as never },
    req: { user_id: 'u1', transaction: { amount, channel: 'paybill', vendorId: 'v1' } },
    ...overrides,
  });
}

function amounts(result: ReturnType<typeof scoreVcfCandidates>) {
  const by = (t: string) =>
    result.winnerBenefits.filter((b) => b.benefit_type === t).reduce((s, b) => s + b.amount, 0);
  return { discount: by('DISCOUNT'), cashback: by('CASHBACK') };
}

describe('scoreVcfCandidates with bill-amount ranges', () => {
  it('uses only the matching range, with the range mode and caps (not the promo-level ones)', () => {
    const result = score(1200);
    expect(result.winnerRule?.id).toBe('r2');
    expect(amounts(result)).toEqual({ discount: 125, cashback: 62.5 });
    expect(result.winnerBenefits.every((b) => b.rule_id === 'r2')).toBe(true);
  });

  it('gives a bill exactly on a shared boundary to the lower range', () => {
    expect(score(500).winnerRule?.id).toBe('r1');
    expect(score(500.01).winnerRule?.id).toBe('r2');
    expect(score(2000).winnerRule?.id).toBe('r2');
    expect(score(2000.5).winnerRule?.id).toBe('r3');
  });

  it('keeps the range cashback expiry instead of the promo-level one', () => {
    const cb = score(3000).winnerBenefits.find((b) => b.benefit_type === 'CASHBACK');
    expect(cb?.expiry_days).toBe(15);
  });

  it('rejects the promo when no range covers the bill, so the next promo wins', () => {
    const result = scoreVcfCandidates({
      candidates: [ladder, floor],
      rulesByPromo: new Map([
        ['ladder', [range('r1', 'ladder', 100, 500, 55)]],
        ['floor', [range('f1', 'floor', null, null, 20)]],
      ]),
      limitsByPromo: new Map(),
      usageByPromo: new Map(),
      behaviour: { user_id: 'u1', overall: {}, services: { vcf: emptyVisitProfile() } as never },
      req: { user_id: 'u1', transaction: { amount: 50, channel: 'paybill', vendorId: 'v1' } },
    });
    expect(result.winnerId).toBe('floor');
    expect(result.rejected).toContainEqual({ promotion_id: 'ladder', reason: 'AMOUNT_OUT_OF_RANGE' });
  });

  it('rejects the promo when the matched range budget is used up', () => {
    const spent = [range('r1', 'ladder', null, null, 55, { budget_limit: 1000, budget_consumed: 1000 })];
    const result = score(300, { rulesByPromo: new Map([['ladder', spent]]) });
    expect(result.winnerId).toBeNull();
    expect(result.rejected).toContainEqual({ promotion_id: 'ladder', reason: 'RANGE_BUDGET_EXHAUSTED' });
  });

  it('rejects the promo when the customer used up the range per-user limit', () => {
    const limited = [range('r1', 'ladder', null, null, 55, { per_user_limit: 1 })];
    const result = score(300, {
      rulesByPromo: new Map([['ladder', limited]]),
      usageByRule: new Map([['r1', { user: 1, campaign: 1, daily: 1 }]]),
    });
    expect(result.rejected).toContainEqual({ promotion_id: 'ladder', reason: 'RANGE_PER_USER_LIMIT' });
  });

  it('skips switched-off and archived ranges', () => {
    const rules = [
      range('r1', 'ladder', null, 500, 55, { is_active: false }),
      range('r2', 'ladder', null, 500, 40, { archived_at: '2026-10-01T00:00:00Z' }),
      range('r3', 'ladder', null, 500, 30),
    ];
    expect(score(300, { rulesByPromo: new Map([['ladder', rules]]) }).winnerRule?.id).toBe('r3');
  });

  it('keeps pre-range promos unchanged: open rule, promo-level mode, cap and expiry', () => {
    const legacy: PromoEngineRuleRow = {
      id: 'legacy',
      promotion_id: 'ladder',
      priority: 100,
      condition_json: { operator: 'AND', conditions: [] },
      benefit_json: [
        { type: 'DISCOUNT', mode: 'FIXED', value: 100 },
        { type: 'CASHBACK', mode: 'FIXED', value: 50, expiryDays: 15 },
      ],
      rule_type: 'CUSTOMER_JOURNEY',
      is_active: true,
    };
    const both = promo({
      id: 'ladder',
      metadata: { vcf: { ...vcf, benefitMode: 'both', maxDiscount: 80 } },
    });
    const result = score(1000, {
      candidates: [both],
      rulesByPromo: new Map([['ladder', [legacy]]]),
    });
    expect(amounts(result)).toEqual({ discount: 80, cashback: 50 });
    const cb = result.winnerBenefits.find((b) => b.benefit_type === 'CASHBACK');
    expect(cb?.expiry_days).toBe(30);
  });
});
