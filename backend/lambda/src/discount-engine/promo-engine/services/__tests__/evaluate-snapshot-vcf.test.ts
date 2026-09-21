import { evaluateAgainstSnapshot } from '../evaluate-snapshot';
import type { PromoEnginePromotionRow, PromoEngineRuleRow } from '../../types';

jest.mock('../../../../database/rds-connection', () => ({
  query: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
}));

jest.mock('../../repos/promo-engine.repo', () => ({
  dbFindActiveCandidates: jest.fn(),
  dbGetLimitsForPromotions: jest.fn(),
  dbListRulesForPromotions: jest.fn(),
  dbCountUsageBatch: jest.fn(),
}));

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
    service_categories: ['grooming'],
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

describe('evaluateAgainstSnapshot VCF vs legacy', () => {
  const vcfFail = promo({
    id: 'vcf-miss',
    metadata: {
      vcf: {
        visitSource: { letter: 'V', vendorId: 'v1', width: 'general' },
        visitLoop: { kind: 'visit_number', n: 9 },
        benefitMode: 'discount',
        publish: { letter: 'V', vendorId: 'v1' },
      },
    },
  });
  const legacy = promo({
    id: 'legacy-slug',
    priority: 99,
  });
  const legacyRule: PromoEngineRuleRow = {
    id: 'r-legacy',
    promotion_id: 'legacy-slug',
    priority: 1,
    condition_json: { operator: 'AND', conditions: [] },
    benefit_json: [{ type: 'DISCOUNT', mode: 'PERCENT', value: 15 }],
    rule_type: 'GENERIC',
    is_active: true,
  };

  it('does not apply a slug legacy discount when any VCF candidate exists', () => {
    const body = evaluateAgainstSnapshot(
      {
        candidates: [vcfFail, legacy],
        rulesByPromo: new Map([
          ['vcf-miss', []],
          ['legacy-slug', [legacyRule]],
        ]),
        limitsByPromo: new Map(),
        usageByPromo: new Map(),
        behaviour: { user_id: 'u1', overall: {}, services: {} },
      },
      {
        user_id: 'u1',
        transaction: { amount: 1000, vendorId: 'v1', channel: 'paybill' },
      },
    );
    expect(body.winner_promotion_id).toBeNull();
    expect(body.summary.discount).toBe(0);
    expect(body.explain.rejected_promotions.some((r) => r.reason === 'VISIT_FAIL')).toBe(true);
  });

  it('still scores legacy rows when no VCF config is present', () => {
    const body = evaluateAgainstSnapshot(
      {
        candidates: [legacy],
        rulesByPromo: new Map([['legacy-slug', [legacyRule]]]),
        limitsByPromo: new Map(),
        usageByPromo: new Map(),
        behaviour: { user_id: 'u1', overall: {}, services: {} },
      },
      {
        user_id: 'u1',
        transaction: { amount: 1000, service_category: 'grooming' },
      },
    );
    expect(body.summary.discount).toBe(150);
    expect(body.winner_promotion_id).toBe('legacy-slug');
  });
});
