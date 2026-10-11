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
    ecommerce: { count: 0, lastAt: null },
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

  it('lets an explicit zero vendor promo beat a paying platform promo', () => {
    const zeroVendor = promo({
      ...vendor,
      id: 'vendor-zero',
      metadata: {
        vcf: {
          visitSource: { letter: 'V', vendorId: 'v1', width: 'general' },
          visitLoop: { kind: 'every' },
          benefitMode: 'both',
          publish: { letter: 'V', vendorId: 'v1' },
        },
      },
    });
    const result = scoreVcfCandidates({
      candidates: [zeroVendor, platform],
      rulesByPromo: new Map([
        [
          zeroVendor.id,
          [
            {
              ...rule(zeroVendor.id, 0),
              benefit_json: [
                { type: 'DISCOUNT', mode: 'PERCENT', value: 0 },
                { type: 'CASHBACK', mode: 'PERCENT', value: 0 },
              ],
            },
          ],
        ],
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
    expect(result.winnerId).toBe('vendor-zero');
    expect(result.winnerBenefits.every((b) => b.amount === 0)).toBe(true);
    expect(result.rejected).toContainEqual({
      promotion_id: 'platform-promo',
      reason: 'LOST_TO_MORE_SPECIFIC',
    });
  });

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

  it('skips a promo whose publish channels exclude the payment channel', () => {
    const shopOnly = promo({
      id: 'shop-only',
      priority: 1,
      updated_at: '2026-01-01T00:00:00Z',
      metadata: {
        vcf: {
          visitSource: { letter: 'F', width: 'general' },
          visitLoop: { kind: 'every' },
          benefitMode: 'discount',
          publish: { letter: 'F', channels: ['ecommerce'] },
        },
      },
    });
    const rules = new Map([[shopOnly.id, [rule(shopOnly.id, 40)]]]);
    const base = {
      candidates: [shopOnly],
      rulesByPromo: rules,
      limitsByPromo: new Map(),
      usageByPromo: new Map(),
      behaviour: { user_id: 'u1', overall: {}, services: { vcf: visitProfile } as never },
    };
    expect(
      scoreVcfCandidates({
        ...base,
        req: { user_id: 'u1', transaction: { amount: 500, vendorId: 'v1', channel: 'paybill' } },
      }).winnerId
    ).toBeNull();
    expect(
      scoreVcfCandidates({
        ...base,
        req: { user_id: 'u1', transaction: { amount: 500, vendorId: 'v1', channel: 'ecommerce' } },
      }).winnerId
    ).toBe('shop-only');
  });
});

describe('scoreVcfCandidates max discount with cashback', () => {
  const vetVisit2 = promo({
    id: 'vet-visit-2',
    metadata: {
      vcf: {
        visitSource: { letter: 'C', categoryId: 'cat-vet', width: 'general' },
        visitLoop: { kind: 'visit_number', n: 2 },
        benefitMode: 'both',
        maxDiscount: 200,
        expiryDays: 30,
        publish: { letter: 'C', categoryId: 'cat-vet' },
        redeem: { letter: 'C', categoryId: 'cat-vet', channels: ['paybill'] },
      },
    },
  });
  const rules = new Map<string, PromoEngineRuleRow[]>([
    [
      vetVisit2.id,
      [
        {
          ...rule(vetVisit2.id),
          benefit_json: [
            { type: 'DISCOUNT', value_type: 'PERCENTAGE', value: 45 },
            { type: 'CASHBACK', mode: 'FIXED', value: 50 },
          ],
        },
      ],
    ],
  ]);
  const profile = emptyVisitProfile();
  profile.categories['cat-vet'] = {
    tele: { count: 0, lastAt: null },
    appointment: { count: 0, lastAt: null },
    paybill: { count: 1, lastAt: null },
    ecommerce: { count: 0, lastAt: null },
  };

  function run(amount: number) {
    return scoreVcfCandidates({
      candidates: [vetVisit2],
      rulesByPromo: rules,
      limitsByPromo: new Map(),
      usageByPromo: new Map(),
      behaviour: { user_id: 'u1', overall: {}, services: { vcf: profile } as never },
      req: { user_id: 'u1', transaction: { amount, vendorId: 'v1', categoryId: 'cat-vet', channel: 'paybill' } },
    });
  }

  function amounts(result: ReturnType<typeof run>) {
    const sum = (type: string) =>
      result.winnerBenefits.filter((b) => b.benefit_type === type).reduce((s, b) => s + b.amount, 0);
    return { discount: sum('DISCOUNT'), cashback: sum('CASHBACK') };
  }

  it('caps the discount at max discount and still pays the full cashback', () => {
    const result = run(1000);
    expect(result.winnerId).toBe('vet-visit-2');
    expect(amounts(result)).toEqual({ discount: 200, cashback: 50 });
  });

  it('pays full cashback when discount + cashback exceeds the cap but discount does not', () => {
    expect(amounts(run(400))).toEqual({ discount: 180, cashback: 50 });
  });
});

describe('scoreVcfCandidates pooled multi-category first visit', () => {
  const group = ['cat-vet', 'cat-groom', 'cat-train'];
  const welcome = promo({
    id: 'welcome-group',
    metadata: {
      vcf: {
        visitSource: { letter: 'C', categoryIds: group, width: 'general' },
        visitLoop: { kind: 'visit_number', n: 1 },
        benefitMode: 'discount',
        publish: { letter: 'C', categoryIds: group },
      },
    },
  });
  const rules = new Map([[welcome.id, [rule(welcome.id, 100)]]]);

  function profileWith(categoryId?: string) {
    const p = emptyVisitProfile();
    if (categoryId) {
      p.categories[categoryId] = {
        tele: { count: 0, lastAt: null },
        appointment: { count: 1, lastAt: null },
        paybill: { count: 0, lastAt: null },
        ecommerce: { count: 0, lastAt: null },
      };
    }
    return p;
  }

  function run(categoryId: string, history?: string) {
    return scoreVcfCandidates({
      candidates: [welcome],
      rulesByPromo: rules,
      limitsByPromo: new Map(),
      usageByPromo: new Map(),
      behaviour: { user_id: 'u1', overall: {}, services: { vcf: profileWith(history) } as never },
      req: { user_id: 'u1', transaction: { amount: 500, vendorId: 'v9', categoryId, channel: 'paybill' } },
    });
  }

  it('applies to a brand-new customer paying for training', () => {
    expect(run('cat-train').winnerId).toBe('welcome-group');
  });

  it('stops applying at grooming and vet once training was used', () => {
    for (const cat of ['cat-groom', 'cat-vet', 'cat-train']) {
      const result = run(cat, 'cat-train');
      expect(result.winnerId).toBeNull();
      expect(result.rejected).toContainEqual({ promotion_id: 'welcome-group', reason: 'VISIT_FAIL' });
    }
  });

  it('still treats a customer with only boarding history as new to the group', () => {
    expect(run('cat-groom', 'cat-boarding').winnerId).toBe('welcome-group');
  });

  it('does not publish on a category outside the list', () => {
    const result = run('cat-boarding');
    expect(result.winnerId).toBeNull();
    expect(result.rejected).toEqual([]);
  });

  it('lets a single-category promo beat the group promo for that category', () => {
    const trainingOnly = promo({
      id: 'training-only',
      priority: 0,
      metadata: {
        vcf: {
          visitSource: { letter: 'C', categoryId: 'cat-train', width: 'general' },
          visitLoop: { kind: 'visit_number', n: 1 },
          benefitMode: 'discount',
          publish: { letter: 'C', categoryId: 'cat-train' },
        },
      },
    });
    const result = scoreVcfCandidates({
      candidates: [{ ...welcome, priority: 99 }, trainingOnly],
      rulesByPromo: new Map([
        [welcome.id, [rule(welcome.id, 100)]],
        [trainingOnly.id, [rule(trainingOnly.id, 40)]],
      ]),
      limitsByPromo: new Map(),
      usageByPromo: new Map(),
      behaviour: { user_id: 'u1', overall: {}, services: { vcf: profileWith() } as never },
      req: { user_id: 'u1', transaction: { amount: 500, vendorId: 'v9', categoryId: 'cat-train', channel: 'paybill' } },
    });
    expect(result.winnerId).toBe('training-only');
    expect(result.rejected).toContainEqual({ promotion_id: 'welcome-group', reason: 'LOST_TO_MORE_SPECIFIC' });
  });
});
