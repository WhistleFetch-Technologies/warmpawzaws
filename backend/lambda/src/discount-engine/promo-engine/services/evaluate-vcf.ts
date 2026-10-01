import { calculateBenefits } from '../benefits/calculate-benefits';
import { applyDiscountCap } from '../vcf/discount-cap';
import { matchesVisitLoop } from '../vcf/visit-loop';
import { visitCountForPromo } from '../vcf/visit-count';
import { rankEligible } from '../vcf/rank-eligible';
import { matchesPublish, parseVcfConfig, publishScopeSize } from '../vcf/parse-config';
import { parseVisitProfile } from '../vcf/visit-profile';
import { isSpendChannel } from '../vcf/channel';
import type { FallbackReason, RankedPromo, SpendChannel, VisitProfile } from '../vcf/types';
import type {
  AppliedBenefit,
  CustomerBehaviourProfile,
  EvaluateRequest,
  PromoEnginePromotionRow,
  PromoEngineRuleRow,
} from '../types';
import type { PromoUsageCounts } from '../repos/promo-engine.repo';
import type { PromoEngineLimitsRow } from '../types';
import { checkPromoLimits } from './promo-limits';

export type VcfScoreResult = {
  winnerBenefits: AppliedBenefit[];
  winnerId: string | null;
  matched: string[];
  rejected: Array<{ promotion_id: string; reason: string }>;
  hadVcfCandidates: boolean;
};

function paymentFromReq(req: EvaluateRequest): {
  vendorId: string | null;
  categoryId: string | null;
  channel: SpendChannel | null;
  amount: number;
} {
  const t = req.transaction || {};
  const rawChannel = String((t as { channel?: unknown }).channel || '').trim().toLowerCase();
  return {
    vendorId: t.vendorId ? String(t.vendorId) : t.vendor_id ? String(t.vendor_id) : null,
    categoryId: t.categoryId ? String(t.categoryId) : null,
    channel: isSpendChannel(rawChannel) ? rawChannel : null,
    amount: Number(t.amount ?? 0) || 0,
  };
}

function attachRedeem(benefits: AppliedBenefit[], redeem: AppliedBenefit['redeem']): AppliedBenefit[] {
  if (!redeem) return benefits;
  return benefits.map((b) =>
    b.benefit_type === 'CASHBACK' ? { ...b, redeem, expiry_days: b.expiry_days } : b
  );
}

function capWinnerDiscount(
  benefits: AppliedBenefit[],
  maxDiscount: number | undefined,
  bill: number
): AppliedBenefit[] {
  if (maxDiscount == null || !Number.isFinite(maxDiscount)) return benefits;
  const discount = benefits.filter((b) => b.benefit_type === 'DISCOUNT').reduce((s, b) => s + b.amount, 0);
  const capped = applyDiscountCap({ discount, cashback: 0, maxDiscount, billAmount: bill });
  const dScale = discount > 0 ? capped.discount / discount : 0;
  return benefits
    .map((b) =>
      b.benefit_type === 'DISCOUNT' ? { ...b, amount: Math.round(b.amount * dScale * 100) / 100 } : b
    )
    .filter((b) => b.amount > 0);
}

export function scoreVcfCandidates(opts: {
  candidates: PromoEnginePromotionRow[];
  rulesByPromo: Map<string, PromoEngineRuleRow[]>;
  limitsByPromo: Map<string, PromoEngineLimitsRow>;
  usageByPromo: Map<string, PromoUsageCounts>;
  behaviour: CustomerBehaviourProfile;
  req: EvaluateRequest;
}): VcfScoreResult {
  const pay = paymentFromReq(opts.req);
  const visitProfile: VisitProfile = parseVisitProfile(
    (opts.behaviour.services || {}) as Record<string, unknown>
  );
  const rejected: Array<{ promotion_id: string; reason: string }> = [];
  const eligible: RankedPromo[] = [];
  const benefitsByPromo = new Map<string, AppliedBenefit[]>();
  const vcfById = new Map<string, ReturnType<typeof parseVcfConfig>>();
  let hadVcfCandidates = false;

  for (const promo of opts.candidates) {
    const vcf = parseVcfConfig(promo.metadata);
    if (!vcf) continue;
    hadVcfCandidates = true;
    vcfById.set(promo.id, vcf);

    if (!matchesPublish(vcf.publish, pay)) {
      continue;
    }

    const limitCheck = checkPromoLimits({
      promo,
      limits: opts.limitsByPromo.get(promo.id),
      usage: opts.usageByPromo.get(promo.id),
    });
    if (!limitCheck.ok) {
      rejected.push({ promotion_id: promo.id, reason: 'LIMIT_FAIL' });
      continue;
    }

    const completed = visitCountForPromo(visitProfile, vcf.visitSource);
    if (!matchesVisitLoop(completed, vcf.visitLoop)) {
      rejected.push({ promotion_id: promo.id, reason: 'VISIT_FAIL' });
      continue;
    }

    const rules = (opts.rulesByPromo.get(promo.id) || []).filter((r) => r.is_active);
    let benefits: AppliedBenefit[] = [];
    for (const rule of rules) {
      benefits = benefits.concat(
        calculateBenefits({
          promotionId: promo.id,
          ruleId: rule.id,
          benefits: rule.benefit_json || [],
          orderAmount: pay.amount,
          benefitMode: vcf.benefitMode,
        })
      );
    }
    if (!benefits.length) {
      rejected.push({ promotion_id: promo.id, reason: 'VISIT_FAIL' });
      continue;
    }

    const withRedeem = attachRedeem(benefits, vcf.redeem);
    const expiry = vcf.expiryDays;
    const stamped = withRedeem.map((b) =>
      b.benefit_type === 'CASHBACK' && expiry != null ? { ...b, expiry_days: expiry } : b
    );
    benefitsByPromo.set(promo.id, stamped);
    eligible.push({
      promotionId: promo.id,
      publishLetter: vcf.publish.letter,
      publishScopeSize: publishScopeSize(vcf.publish),
      priority: promo.priority,
      updatedAt: promo.updated_at,
      discount: stamped.filter((b) => b.benefit_type === 'DISCOUNT').reduce((s, b) => s + b.amount, 0),
      cashback: stamped.filter((b) => b.benefit_type === 'CASHBACK').reduce((s, b) => s + b.amount, 0),
      rankingOverride: vcf.rankingOverride || null,
    });
  }

  if (!hadVcfCandidates) {
    return { winnerBenefits: [], winnerId: null, matched: [], rejected, hadVcfCandidates: false };
  }

  const ranked = rankEligible(eligible);
  for (const fb of ranked.fallbacks) {
    rejected.push({ promotion_id: fb.promotionId, reason: fb.reason as FallbackReason });
  }

  if (!ranked.winner) {
    return { winnerBenefits: [], winnerId: null, matched: [], rejected, hadVcfCandidates: true };
  }

  const vcf = vcfById.get(ranked.winner.promotionId);
  let winnerBenefits = benefitsByPromo.get(ranked.winner.promotionId) || [];
  if (vcf?.benefitMode === 'both') {
    winnerBenefits = capWinnerDiscount(winnerBenefits, vcf.maxDiscount, pay.amount);
  }

  return {
    winnerBenefits,
    winnerId: ranked.winner.promotionId,
    matched: [ranked.winner.promotionId],
    rejected,
    hadVcfCandidates: true,
  };
}
