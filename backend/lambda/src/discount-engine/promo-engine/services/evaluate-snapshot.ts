import { normalizePromoCategory } from '../dsl/category-aliases';
import { buildEvalContext, evaluateConditionGroup } from '../dsl/evaluate-conditions';
import { calculateBenefits } from '../benefits/calculate-benefits';
import { resolveStack, type StackCandidate } from '../stacking/resolve-stack';
import {
  dbFindActiveCandidates,
  dbGetLimitsForPromotions,
  dbListRulesForPromotions,
  dbCountUsageBatch,
  type PromoUsageCounts,
} from '../repos/promo-engine.repo';
import type {
  AppliedBenefit,
  CustomerBehaviourProfile,
  EvaluateRequest,
  EvaluateResult,
  PromoEngineLimitsRow,
  PromoEnginePromotionRow,
  PromoEngineRuleRow,
  StackingPolicy,
} from '../types';
import { scoreVcfCandidates } from './evaluate-vcf';
import { parseVcfConfig } from '../vcf/parse-config';

export type EvaluateSnapshot = {
  candidates: PromoEnginePromotionRow[];
  rulesByPromo: Map<string, PromoEngineRuleRow[]>;
  limitsByPromo: Map<string, PromoEngineLimitsRow>;
  usageByPromo: Map<string, PromoUsageCounts>;
  behaviour: CustomerBehaviourProfile;
};

export async function loadEvaluateSnapshot(opts: {
  userId: string;
  now: Date;
  serviceCategory?: string;
  vendorId?: string;
  categoryId?: string;
  behaviour: CustomerBehaviourProfile;
}): Promise<EvaluateSnapshot> {
  const behaviour = opts.behaviour;
  const candidates = await dbFindActiveCandidates({
    now: opts.now,
    serviceCategory: opts.serviceCategory,
    vendorId: opts.vendorId,
    categoryId: opts.categoryId,
  });
  const ids = candidates.map((c) => c.id);
  const dayStart = new Date(opts.now);
  dayStart.setHours(0, 0, 0, 0);
  const [rulesByPromo, limitsByPromo, usageByPromo] = await Promise.all([
    dbListRulesForPromotions(ids),
    dbGetLimitsForPromotions(ids),
    dbCountUsageBatch({ promotionIds: ids, userId: opts.userId, since: dayStart }),
  ]);
  return { candidates, rulesByPromo, limitsByPromo, usageByPromo, behaviour };
}

function passesLimits(opts: {
  promo: PromoEnginePromotionRow;
  limits: PromoEngineLimitsRow | undefined;
  usage: PromoUsageCounts | undefined;
}): { ok: boolean; reason?: string } {
  const budgetCap = opts.limits?.budget_limit ?? opts.promo.budget_limit;
  if (budgetCap != null && opts.promo.budget_consumed >= Number(budgetCap)) {
    return { ok: false, reason: 'BUDGET_EXHAUSTED' };
  }
  if (opts.limits?.per_user != null && (opts.usage?.user ?? 0) >= opts.limits.per_user) {
    return { ok: false, reason: 'PER_USER_LIMIT' };
  }
  if (opts.limits?.campaign_limit != null && (opts.usage?.campaign ?? 0) >= opts.limits.campaign_limit) {
    return { ok: false, reason: 'CAMPAIGN_LIMIT' };
  }
  if (opts.limits?.daily_limit != null && (opts.usage?.daily ?? 0) >= opts.limits.daily_limit) {
    return { ok: false, reason: 'DAILY_LIMIT' };
  }
  if (opts.limits?.per_transaction != null && opts.limits.per_transaction <= 0) {
    return { ok: false, reason: 'PER_TRANSACTION_LIMIT' };
  }
  return { ok: true };
}

function collectLineBenefits(opts: {
  promo: PromoEnginePromotionRow;
  rules: PromoEngineRuleRow[];
  req: EvaluateRequest;
  behaviour: CustomerBehaviourProfile;
  now: Date;
}): { benefits: AppliedBenefit[]; anyRulePass: boolean; failures: EvaluateResult['explain']['failures'] } {
  const amount = Number(opts.req.transaction?.amount ?? 0) || 0;
  const serviceCategory = opts.req.transaction?.service_category
    ? normalizePromoCategory(opts.req.transaction.service_category) || undefined
    : undefined;
  const ctx = buildEvalContext({
    userId: opts.req.user_id,
    transaction: {
      ...opts.req.transaction,
      service_category: serviceCategory || opts.req.transaction?.service_category,
    },
    behaviour: opts.behaviour,
    now: opts.now,
  });
  const failures: EvaluateResult['explain']['failures'] = [];
  let promoBenefits: AppliedBenefit[] = [];
  let anyRulePass = false;
  for (const rule of opts.rules.filter((r) => r.is_active)) {
    const ev = evaluateConditionGroup(rule.condition_json, ctx);
    if (!ev.pass) {
      failures.push(...ev.failures);
      continue;
    }
    anyRulePass = true;
    promoBenefits = promoBenefits.concat(
      calculateBenefits({
        promotionId: opts.promo.id,
        ruleId: rule.id,
        benefits: rule.benefit_json || [],
        orderAmount: amount,
      }),
    );
  }
  return { benefits: promoBenefits, anyRulePass, failures };
}

/** In-memory evaluate against a preloaded snapshot. No SQL. Does not persist. */
export function evaluateAgainstSnapshot(
  snapshot: EvaluateSnapshot,
  req: EvaluateRequest,
  now = new Date(),
): Omit<EvaluateResult, 'evaluation_id'> {
  const amount = Number(req.transaction?.amount ?? 0) || 0;
  const stackInput: StackCandidate[] = [];
  const failures: EvaluateResult['explain']['failures'] = [];
  const matched: string[] = [];
  const rejected: EvaluateResult['explain']['rejected_promotions'] = [];
  const appliedCount = new Map<string, number>();

  const lines = Array.isArray(req.transaction?.lines) ? req.transaction.lines : [];
  const workItems: Array<{
    req: EvaluateRequest;
    groupKeyFor: (policy: StackingPolicy | null) => string;
    policies?: Array<StackingPolicy | null>;
  }> =
    lines.length > 0
      ? [
          {
            req,
            groupKeyFor: () => 'order',
            policies: ['NONE', 'ORDER_LEVEL', 'DISCOUNT_WITH_CASHBACK', 'FULL_STACKING', null],
          },
        ]
      : [{ req, groupKeyFor: () => 'order' }];
  if (lines.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      workItems.push({
        req: {
          ...req,
          transaction: {
            ...req.transaction,
            amount: Number(line.amount) || 0,
            service_category:
              line.service_category || req.transaction.service_category,
          },
        },
        groupKeyFor: (policy) => {
          if (policy === 'SERVICE_LEVEL') return String(line.id || `line-${i}`);
          if (policy === 'CATEGORY_LEVEL') {
            return (
              normalizePromoCategory(
                line.service_category || req.transaction.service_category,
              ) || 'category'
            );
          }
          return 'order';
        },
        policies: ['SERVICE_LEVEL', 'CATEGORY_LEVEL'],
      });
    }
  }

  const vcfScore = scoreVcfCandidates({
    candidates: snapshot.candidates,
    rulesByPromo: snapshot.rulesByPromo,
    limitsByPromo: snapshot.limitsByPromo,
    usageByPromo: snapshot.usageByPromo,
    behaviour: snapshot.behaviour,
    req,
  });

  if (vcfScore.winnerId) {
    const discount = vcfScore.winnerBenefits
      .filter((b) => b.benefit_type === 'DISCOUNT')
      .reduce((s, b) => s + b.amount, 0);
    const cashback = vcfScore.winnerBenefits
      .filter((b) => b.benefit_type === 'CASHBACK')
      .reduce((s, b) => s + b.amount, 0);
    return {
      eligible: vcfScore.winnerBenefits.length > 0,
      winner_promotion_id: vcfScore.winnerId,
      benefits: vcfScore.winnerBenefits,
      summary: {
        gross_amount: amount,
        discount: Math.round(discount * 100) / 100,
        payable: Math.round(Math.max(0, amount - discount) * 100) / 100,
        cashback: Math.round(cashback * 100) / 100,
      },
      explain: {
        failures,
        matched_promotions: vcfScore.matched,
        rejected_promotions: vcfScore.rejected,
      },
    };
  }
  rejected.push(...vcfScore.rejected);

  const legacyCandidates = snapshot.candidates.filter((p) => !parseVcfConfig(p.metadata));
  for (const promo of legacyCandidates) {
    const limitCheck = passesLimits({
      promo,
      limits: snapshot.limitsByPromo.get(promo.id),
      usage: snapshot.usageByPromo.get(promo.id),
    });
    if (!limitCheck.ok) {
      rejected.push({ promotion_id: promo.id, reason: limitCheck.reason || 'LIMIT' });
      continue;
    }

    const rules = snapshot.rulesByPromo.get(promo.id) || [];
    const perTxn = snapshot.limitsByPromo.get(promo.id)?.per_transaction;
    let promoMatched = false;

    for (const item of workItems) {
      if (item.policies && !item.policies.includes(promo.stacking_policy)) {
        continue;
      }
      if (perTxn != null && (appliedCount.get(promo.id) || 0) >= perTxn) {
        break;
      }
      const collected = collectLineBenefits({
        promo,
        rules,
        req: item.req,
        behaviour: snapshot.behaviour,
        now,
      });
      failures.push(...collected.failures);
      if (!collected.anyRulePass || !collected.benefits.length) continue;
      promoMatched = true;
      appliedCount.set(promo.id, (appliedCount.get(promo.id) || 0) + 1);
      stackInput.push({
        promotion_id: promo.id,
        priority: promo.priority,
        stacking_policy: promo.stacking_policy,
        benefits: collected.benefits,
        groupKey: item.groupKeyFor(promo.stacking_policy),
      });
    }

    if (!promoMatched) {
      rejected.push({ promotion_id: promo.id, reason: 'CONDITIONS_NOT_MET' });
      continue;
    }
    matched.push(promo.id);
  }

  const benefits = resolveStack({ candidates: stackInput });
  const discount = benefits
    .filter((b) => b.benefit_type === 'DISCOUNT')
    .reduce((s, b) => s + b.amount, 0);
  const cashback = benefits
    .filter((b) => b.benefit_type === 'CASHBACK')
    .reduce((s, b) => s + b.amount, 0);

  return {
    eligible: benefits.length > 0,
    winner_promotion_id: benefits[0]?.promotion_id || null,
    benefits,
    summary: {
      gross_amount: amount,
      discount: Math.round(discount * 100) / 100,
      payable: Math.round(Math.max(0, amount - discount) * 100) / 100,
      cashback: Math.round(cashback * 100) / 100,
    },
    explain: {
      failures,
      matched_promotions: matched,
      rejected_promotions: rejected,
    },
  };
}
