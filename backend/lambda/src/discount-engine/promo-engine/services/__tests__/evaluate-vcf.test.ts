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

function rule(promotionId: string, discount = 100): PromoEngineRuleRow {
  return {
    id: `r-${promotionId}`,
    promotion_id: promotionId,
    priority: 1,
    condition_json: { operator: 'AND', conditions: [] },
    benefit_json: [{ type: 'DISCOUNT', mode: 'FIXED', value: discount }],
    rule_type: 'CUSTOMER_JOURNEY',
    is_active: true,
  };
}

describe('scoreVcfCandidates', () => {
  const visitProfile = emptyVisitProfile();
  visitProfile.vendors.v1 = {
    categoryId: 'c1',
    roleId: 'r1',
    tele: { count: 0, lastAt: null },
    appointment: { count: 0, lastAt: null },
    paybill: { count: 0, lastAt: null },
  };

  const vendor = promo({
    id: 'vendor-promo',
    priority: 1,
    updated_at: '2026-01-01T00:00:00Z',
    metadata: {
      vcf: {
        visitSource: { letter: 'V', vendorId: 'v1', width: 'general' },
        visitLoop: { kind: 'visit_number', n: 1 },
        benefitMode: 'discount',
        publish: { letter: 'V', vendorId: 'v1' },
      },
    },
  });
  const platform = promo({
    id: 'platform-promo',
    priority: 99,
    updated_at: '2026-09-01T00:00:00Z',
    metadata: {
      vcf: {
        visitSource: { letter: 'F', width: 'general' },
        visitLoop: { kind: 'every' },
        benefitMode: 'discount',
        publish: { letter: 'F' },
      },
    },
  });

  const rulesByPromo = new Map([
    [vendor.id, [rule(vendor.id, 50)]],
    [platform.id, [rule(platform.id, 200)]],
  ]);

  it('lets a qualifying vendor beat a platform promo and lists LOST_TO_MORE_SPECIFIC', () => {
    const result = scoreVcfCandidates({
      candidates: [vendor, platform],
      rulesByPromo,
      limitsByPromo: new Map(),
      usageByPromo: new Map(),
      behaviour: { user_id: 'u1', overall: {}, services: { vcf: visitProfile } as never },
      req: {
        user_id: 'u1',
        transaction: { amount: 500, vendorId: 'v1', categoryId: 'c1', channel: 'paybill' },
      },
    });
    expect(result.winnerId).toBe('vendor-promo');
    expect(result.rejected.some((r) => r.reason === 'LOST_TO_MORE_SPECIFIC')).toBe(true);
  });

  it('records VISIT_FAIL and still lets the platform promo win', () => {
    const laterVendor = promo({
      ...vendor,
      metadata: {
        vcf: {
          visitSource: { letter: 'V', vendorId: 'v1', width: 'general' },
          visitLoop: { kind: 'visit_number', n: 5 },
          benefitMode: 'discount',
          publish: { letter: 'V', vendorId: 'v1' },
        },
      },
    });
    const result = scoreVcfCandidates({
      candidates: [laterVendor, platform],
      rulesByPromo: new Map([
        [laterVendor.id, [rule(laterVendor.id, 50)]],
        [platform.id, [rule(platform.id, 200)]],
      ]),
      limitsByPromo: new Map(),
      usageByPromo: new Map(),
      behaviour: { user_id: 'u1', overall: {}, services: { vcf: visitProfile } as never },
      req: {
        user_id: 'u1',
        transaction: { amount: 500, vendorId: 'v1', categoryId: 'c1', channel: 'paybill' },
      },
    });
    expect(result.winnerId).toBe('platform-promo');
    expect(result.rejected).toContainEqual({ promotion_id: 'vendor-promo', reason: 'VISIT_FAIL' });
  });
});
