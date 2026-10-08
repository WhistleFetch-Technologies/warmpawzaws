/**
 * Optimistic Pay Bill listing offer from VCF publish ranking (V > C > F).
 * The list shows Instant Savings / Wallet Cashback, not a percent.
 * Checkout still runs full evaluate (visit/limits).
 */
import { mapWithConcurrency } from '../../../../services/image';
import { calculateBenefits } from '../../../../discount-engine/promo-engine/benefits/calculate-benefits';
import {
  dbFindActiveCandidates,
  dbListRulesForPromotions,
  dbLoadServiceCategories,
  dbLoadVendorRole,
} from '../../../../discount-engine/promo-engine/repos/promo-engine.repo';
import {
  matchesPublish,
  parseVcfConfig,
  publishScopeSize,
} from '../../../../discount-engine/promo-engine/vcf/parse-config';
import { rankEligible } from '../../../../discount-engine/promo-engine/vcf/rank-eligible';
import { resolvePaymentContext } from '../../../../discount-engine/promo-engine/vcf/payment-context';
import type { RankedPromo } from '../../../../discount-engine/promo-engine/vcf/types';
import type {
  PromoEngineBenefit,
  PromoEngineRuleRow,
} from '../../../../discount-engine/promo-engine/types';
import { isRangedRule } from '../../../../discount-engine/promo-engine/vcf/amount-range';

const REF_AMOUNT = 1000;
const ROLE_CONCURRENCY = 6;

export type WpayListingOffer = {
  discountPercent: number;
  hasCashback: boolean;
};

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

function percentFromDiscountAmount(discountAmount: number, billAmount: number): number {
  if (!(discountAmount > 0) || !(billAmount > 0)) return 0;
  return Math.round((discountAmount / billAmount) * 10000) / 100;
}

/** Reference bill for a range: ₹1,000 pulled inside the range's bounds. */
function referenceBill(rule: PromoEngineRuleRow): number {
  let ref = REF_AMOUNT;
  if (rule.min_amount != null) ref = Math.max(ref, rule.min_amount);
  if (rule.max_amount != null) ref = Math.min(ref, rule.max_amount);
  return ref;
}

type RangeQuote = { displayPct: number; discount: number; cashback: number };

/** Best display percent across a promo's live ranges; pre-range promos quote their single rule at ₹1,000. */
function bestRangeQuote(
  promoId: string,
  rules: PromoEngineRuleRow[],
  vcf: NonNullable<ReturnType<typeof parseVcfConfig>>,
): RangeQuote | null {
  let best: RangeQuote | null = null;
  for (const rule of rules) {
    if (rule.is_active === false || rule.archived_at) continue;
    const ranged = isRangedRule(rule);
    const bill = ranged ? referenceBill(rule) : REF_AMOUNT;
    const applied = calculateBenefits({
      promotionId: promoId,
      ruleId: rule.id,
      benefits: rule.benefit_json || [],
      orderAmount: bill,
      maxDiscount: ranged ? undefined : vcf.maxDiscount,
      benefitMode: rule.benefit_mode || vcf.benefitMode,
    });
    const discount = applied
      .filter((b) => b.benefit_type === 'DISCOUNT')
      .reduce((s, b) => s + b.amount, 0);
    const cashback = applied
      .filter((b) => b.benefit_type === 'CASHBACK')
      .reduce((s, b) => s + b.amount, 0);
    if (discount <= 0 && cashback <= 0) continue;
    const stated = benefitDiscountPercent(rule.benefit_json || []);
    const displayPct =
      stated != null && stated > 0 ? stated : percentFromDiscountAmount(discount, bill);
    const quote = { displayPct, discount, cashback };
    if (!best || quote.displayPct > best.displayPct) best = quote;
    if (!ranged) break;
  }
  return best;
}

export async function resolveWpayListingDiscountPercents(
  vendorIds: readonly string[],
): Promise<Map<string, WpayListingOffer>> {
  const out = new Map<string, WpayListingOffer>();
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
    let hasCashback = false;

    for (const promo of row.candidates) {
      const vcf = parseVcfConfig(promo.metadata);
      if (!vcf) continue;
      if (
        !matchesPublish(vcf.publish, {
          vendorId: row.vendorId,
          categoryId: row.categoryId,
          channel: 'paybill',
        })
      ) {
        continue;
      }

      const quote = bestRangeQuote(promo.id, rulesByPromo.get(promo.id) || [], vcf);
      if (!quote) continue;
      const { discount, cashback, displayPct } = quote;
      if (cashback > 0) hasCashback = true;
      if (displayPct > 0) displayPercentByPromo.set(promo.id, displayPct);

      eligible.push({
        promotionId: promo.id,
        publishLetter: vcf.publish.letter,
        publishScopeSize: publishScopeSize(vcf.publish),
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
    if (pct > 0 || hasCashback) out.set(row.vendorId, { discountPercent: pct, hasCashback });
  }

  return out;
}
