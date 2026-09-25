/**
 * Optimistic Pay Bill listing discount % from VCF publish ranking (V > C > F).
 * Display-only ("Upto X%") — checkout still runs full evaluate (visit/limits).
 */
import { mapWithConcurrency } from '../../../../services/image';
import { calculateBenefits } from '../../../../discount-engine/promo-engine/benefits/calculate-benefits';
import {
  dbFindActiveCandidates,
  dbListRulesForPromotions,
  dbLoadServiceCategories,
  dbLoadVendorRole,
} from '../../../../discount-engine/promo-engine/repos/promo-engine.repo';
import { matchesPublish, parseVcfConfig } from '../../../../discount-engine/promo-engine/vcf/parse-config';
import { rankEligible } from '../../../../discount-engine/promo-engine/vcf/rank-eligible';
import { resolvePaymentContext } from '../../../../discount-engine/promo-engine/vcf/payment-context';
import type { RankedPromo } from '../../../../discount-engine/promo-engine/vcf/types';
import type { PromoEngineBenefit } from '../../../../discount-engine/promo-engine/types';

const REF_AMOUNT = 1000;
const ROLE_CONCURRENCY = 6;

function benefitDiscountPercent(benefits: PromoEngineBenefit[]): number | null {
  for (const b of benefits) {
    if (String(b?.type || '').toUpperCase() !== 'DISCOUNT') continue;
    const raw = String(b.value_type || b.mode || '').toUpperCase();
    const isPercent = raw === 'PERCENTAGE' || raw === 'PERCENT';
    const v = Number(b.value) || 0;
    if (isPercent && v > 0) return Math.round(v * 100) / 100;
  }
  return null;
}

function percentFromDiscountAmount(discountAmount: number): number {
  if (!(discountAmount > 0)) return 0;
  return Math.round((discountAmount / REF_AMOUNT) * 10000) / 100;
}

export async function resolveWpayListingDiscountPercents(
  vendorIds: readonly string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(vendorIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (unique.length === 0) return out;

  const now = new Date();
  const catalogue = await dbLoadServiceCategories();

  const contexts = await mapWithConcurrency(unique, ROLE_CONCURRENCY, async (vendorId) => {
    const vendor = await dbLoadVendorRole(vendorId);
    const ctx = resolvePaymentContext({
      surface: 'paybill',
      vendorId,
      roleId: vendor?.roleId,
      roleName: vendor?.roleName,
      catalogue,
    });
    return { vendorId, categoryId: ctx.categoryId };
  });

  const candidateLists = await mapWithConcurrency(contexts, ROLE_CONCURRENCY, async (row) => {
    const candidates = await dbFindActiveCandidates({
      now,
      vendorId: row.vendorId,
      categoryId: row.categoryId || undefined,
    });
    return { vendorId: row.vendorId, categoryId: row.categoryId, candidates };
  });

  const allPromoIds = [
    ...new Set(candidateLists.flatMap((row) => row.candidates.map((c) => c.id))),
  ];
  const rulesByPromo = await dbListRulesForPromotions(allPromoIds);

  for (const row of candidateLists) {
    const eligible: RankedPromo[] = [];
    const displayPercentByPromo = new Map<string, number>();

    for (const promo of row.candidates) {
      const vcf = parseVcfConfig(promo.metadata);
      if (!vcf) continue;
      if (!matchesPublish(vcf.publish, { vendorId: row.vendorId, categoryId: row.categoryId })) {
        continue;
      }

      const rules = rulesByPromo.get(promo.id) || [];
      const rule = rules.find((r) => r.is_active !== false) || rules[0];
      if (!rule) continue;

      const stated = benefitDiscountPercent(rule.benefit_json || []);
      const applied = calculateBenefits({
        promotionId: promo.id,
        ruleId: rule.id,
        benefits: rule.benefit_json || [],
        orderAmount: REF_AMOUNT,
        combinedMax: vcf.maxDiscount,
        benefitMode: vcf.benefitMode,
      });
      const discount = applied
        .filter((b) => b.benefit_type === 'DISCOUNT')
        .reduce((s, b) => s + b.amount, 0);
      const cashback = applied
        .filter((b) => b.benefit_type === 'CASHBACK')
        .reduce((s, b) => s + b.amount, 0);
      if (discount <= 0 && cashback <= 0) continue;

      const displayPct =
        stated != null && stated > 0 ? stated : percentFromDiscountAmount(discount);
      if (displayPct > 0) displayPercentByPromo.set(promo.id, displayPct);

      eligible.push({
        promotionId: promo.id,
        publishLetter: vcf.publish.letter,
        priority: Number(promo.priority ?? 0),
        updatedAt: promo.updated_at,
        discount,
        cashback,
        rankingOverride: vcf.rankingOverride,
      });
    }

    const { winner } = rankEligible(eligible);
    if (!winner) continue;
    const pct = displayPercentByPromo.get(winner.promotionId) || 0;
    if (pct > 0) out.set(row.vendorId, pct);
  }

  return out;
}
