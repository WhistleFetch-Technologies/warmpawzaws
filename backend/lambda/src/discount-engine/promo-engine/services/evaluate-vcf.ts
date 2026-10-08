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
import { checkRangeLimits, isRangedRule, pickAmountRange } from '../vcf/amount-range';

export type VcfScoreResult = {
  winnerBenefits: AppliedBenefit[];
  winnerId: string | null;
  /** Bill-amount range (rule row) that produced the winner's benefits. */
  winnerRule: PromoEngineRuleRow | null;
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
  /** Usage counts per range (rule_id); missing = no range usage yet. */
  usageByRule?: Map<string, PromoUsageCounts>;
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
  const ruleByPromo = new Map<string, PromoEngineRuleRow>();
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

    const activeRules = (opts.rulesByPromo.get(promo.id) || []).filter(
      (r) => r.is_active && !r.archived_at
    );
    if (!activeRules.length) {
      rejected.push({ promotion_id: promo.id, reason: 'VISIT_FAIL' });
      continue;
    }
    const rule = pickAmountRange(activeRules, pay.amount);
    if (!rule) {
      rejected.push({ promotion_id: promo.id, reason: 'AMOUNT_OUT_OF_RANGE' });
      continue;
    }
    const rangeCheck = checkRangeLimits(rule, opts.usageByRule?.get(rule.id));
    if (!rangeCheck.ok) {
      rejected.push({ promotion_id: promo.id, reason: rangeCheck.reason || 'RANGE_LIMIT' });
      continue;
    }

    const ranged = isRangedRule(rule);
    const benefits = calculateBenefits({
      promotionId: promo.id,
      ruleId: rule.id,
      benefits: rule.benefit_json || [],
      orderAmount: pay.amount,
      benefitMode: rule.benefit_mode || vcf.benefitMode,
    });
    if (!benefits.length) {
      rejected.push({ promotion_id: promo.id, reason: 'VISIT_FAIL' });
      continue;
    }

    const withRedeem = attachRedeem(benefits, vcf.redeem);
    const expiry = vcf.expiryDays;
    // A range's own cashback expiry wins; pre-range promos keep the promo-level expiry.
    const stamped = withRedeem.map((b) => {
      if (b.benefit_type !== 'CASHBACK') return b;
      const days = ranged ? (b.expiry_days ?? expiry) : (expiry ?? b.expiry_days);
      return days != null ? { ...b, expiry_days: days } : b;
    });
    benefitsByPromo.set(promo.id, stamped);
    ruleByPromo.set(promo.id, rule);
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

  const empty = {
    winnerBenefits: [],
    winnerId: null,
    winnerRule: null,
    matched: [],
    rejected,
  };
  if (!hadVcfCandidates) {
    return { ...empty, hadVcfCandidates: false };
  }

  const ranked = rankEligible(eligible);
  for (const fb of ranked.fallbacks) {
    rejected.push({ promotion_id: fb.promotionId, reason: fb.reason as FallbackReason });
  }

  if (!ranked.winner) {
    return { ...empty, hadVcfCandidates: true };
  }

  const vcf = vcfById.get(ranked.winner.promotionId);
  const winnerRule = ruleByPromo.get(ranked.winner.promotionId) || null;
  let winnerBenefits = benefitsByPromo.get(ranked.winner.promotionId) || [];
  // Ranges cap their discount via the range's own max; the promo-level cap is for pre-range promos.
  if (vcf?.benefitMode === 'both' && !(winnerRule && isRangedRule(winnerRule))) {
    winnerBenefits = capWinnerDiscount(winnerBenefits, vcf.maxDiscount, pay.amount);
  }

  return {
    winnerBenefits,
    winnerId: ranked.winner.promotionId,
    winnerRule,
    matched: [ranked.winner.promotionId],
    rejected,
    hadVcfCandidates: true,
  };
}
