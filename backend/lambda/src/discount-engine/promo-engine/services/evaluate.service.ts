import { normalizePromoCategory } from '../dsl/category-aliases';
import { buildEvalContext, evaluateConditionGroup } from '../dsl/evaluate-conditions';
import { calculateBenefits } from '../benefits/calculate-benefits';
import { resolveStack } from '../stacking/resolve-stack';
import {
  dbFindActiveCandidates,
  dbGetBehaviour,
  dbGetLimits,
  dbCountUsage,
  dbInsertEvaluation,
  dbInsertAudit,
  dbListRules,
} from '../repos/promo-engine.repo';
import type {
  CustomerBehaviourProfile,
  EvaluateRequest,
  EvaluateResult,
  AppliedBenefit,
} from '../types';

function parseJsonField(v: unknown): Record<string, unknown> {
  if (v == null) return {};
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return v as Record<string, unknown>;
}

export async function loadBehaviourProfile(
  userId: string,
  override?: Partial<CustomerBehaviourProfile>
): Promise<CustomerBehaviourProfile> {
  if (override?.overall || override?.services) {
    return {
      user_id: userId,
      overall: (override.overall as CustomerBehaviourProfile['overall']) || {},
      services: (override.services as CustomerBehaviourProfile['services']) || {},
    };
  }
  const row = await dbGetBehaviour(userId);
  if (!row) {
    return { user_id: userId, overall: {}, services: {} };
  }
  return {
    user_id: userId,
    overall: parseJsonField(row.overall) as CustomerBehaviourProfile['overall'],
    services: parseJsonField(row.services) as CustomerBehaviourProfile['services'],
  };
}

async function passesLimits(opts: {
  promotionId: string;
  userId: string;
  budgetConsumed: number;
  budgetLimit: number | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const limits = await dbGetLimits(opts.promotionId);
  const budgetCap = limits?.budget_limit ?? opts.budgetLimit;
  if (budgetCap != null && opts.budgetConsumed >= Number(budgetCap)) {
    return { ok: false, reason: 'BUDGET_EXHAUSTED' };
  }
  if (limits?.per_user != null) {
    const n = await dbCountUsage({ promotionId: opts.promotionId, userId: opts.userId });
    if (n >= limits.per_user) return { ok: false, reason: 'PER_USER_LIMIT' };
  }
  if (limits?.campaign_limit != null) {
    const n = await dbCountUsage({ promotionId: opts.promotionId });
    if (n >= limits.campaign_limit) return { ok: false, reason: 'CAMPAIGN_LIMIT' };
  }
  if (limits?.daily_limit != null) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const n = await dbCountUsage({ promotionId: opts.promotionId, since });
    if (n >= limits.daily_limit) return { ok: false, reason: 'DAILY_LIMIT' };
  }
  return { ok: true };
}

/**
 * Evaluate promotions. Never writes wallet / cashback.
 */
export async function evaluatePromotions(req: EvaluateRequest): Promise<EvaluateResult> {
  const now = new Date();
  const amount = Number(req.transaction?.amount ?? 0) || 0;
  const serviceCategory = req.transaction?.service_category
    ? normalizePromoCategory(req.transaction.service_category) || undefined
    : undefined;

  const behaviour = await loadBehaviourProfile(req.user_id, req.behaviour_override);
  const ctx = buildEvalContext({
    userId: req.user_id,
    transaction: {
      ...req.transaction,
      service_category: serviceCategory || req.transaction?.service_category,
    },
    behaviour,
    now,
  });

  const candidates = await dbFindActiveCandidates({ now, serviceCategory });
  const stackInput: Array<{
    promotion_id: string;
    priority: number;
    stacking_policy: EvaluateResult extends never ? never : import('../types').StackingPolicy | null;
    benefits: AppliedBenefit[];
  }> = [];

  const failures: EvaluateResult['explain']['failures'] = [];
  const matched: string[] = [];
  const rejected: EvaluateResult['explain']['rejected_promotions'] = [];

  for (const promo of candidates) {
    const limitCheck = await passesLimits({
      promotionId: promo.id,
      userId: req.user_id,
      budgetConsumed: promo.budget_consumed,
      budgetLimit: promo.budget_limit,
    });
    if (!limitCheck.ok) {
      rejected.push({ promotion_id: promo.id, reason: limitCheck.reason || 'LIMIT' });
      continue;
    }

    const rules = await dbListRules(promo.id);
    let promoBenefits: AppliedBenefit[] = [];
    let anyRulePass = false;

    for (const rule of rules.filter((r) => r.is_active)) {
      const ev = evaluateConditionGroup(rule.condition_json, ctx);
      if (!ev.pass) {
        failures.push(...ev.failures);
        continue;
      }
      anyRulePass = true;
      promoBenefits = promoBenefits.concat(
        calculateBenefits({
          promotionId: promo.id,
          ruleId: rule.id,
          benefits: rule.benefit_json || [],
          orderAmount: amount,
        })
      );
    }

    if (!anyRulePass || !promoBenefits.length) {
      rejected.push({ promotion_id: promo.id, reason: 'CONDITIONS_NOT_MET' });
      continue;
    }

    matched.push(promo.id);
    stackInput.push({
      promotion_id: promo.id,
      priority: promo.priority,
      stacking_policy: promo.stacking_policy,
      benefits: promoBenefits,
    });
  }

  const benefits = resolveStack({ candidates: stackInput });
  const discount = benefits
    .filter((b) => b.benefit_type === 'DISCOUNT')
    .reduce((s, b) => s + b.amount, 0);
  const cashback = benefits
    .filter((b) => b.benefit_type === 'CASHBACK')
    .reduce((s, b) => s + b.amount, 0);

  const resultBody = {
    eligible: benefits.length > 0,
    benefits,
    summary: {
      gross_amount: amount,
      discount: Math.round(discount * 100) / 100,
      payable: Math.round(Math.max(0, amount - discount) * 100) / 100,
      cashback: Math.round(cashback * 100) / 100,
    },
  };

  const explain = {
    failures,
    matched_promotions: matched,
    rejected_promotions: rejected,
  };

  const expires = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const evaluation_id = await dbInsertEvaluation({
    user_id: req.user_id,
    request_json: req,
    result_json: resultBody,
    explain_json: explain,
    expires_at: expires.toISOString(),
  });

  await dbInsertAudit({
    evaluation_id,
    event_type: 'EVALUATED',
    payload: { eligible: resultBody.eligible, matched, benefit_count: benefits.length },
  });

  return {
    eligible: resultBody.eligible,
    evaluation_id,
    benefits,
    summary: resultBody.summary,
    explain,
  };
}
