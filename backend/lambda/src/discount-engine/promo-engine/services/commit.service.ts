import {
  dbAdjustBudgetConsumed,
  dbAdjustRuleBudgetConsumed,
  dbCountRuleUsageBatch,
  dbCountUsageBatch,
  dbGetEvaluation,
  dbGetLimits,
  dbGetRule,
  dbGetUsageByIdempotencyKey,
  dbInsertAudit,
  dbInsertUsage,
  dbSetUsageCashback,
} from '../repos/promo-engine.repo';
import { creditPromoCashback, pickCashbackBenefits } from './wallet-cashback.service';
import { notifyPromoCashbackCredited } from './cashback-notification.service';
import {
  cashbackAllowedWithinBudget,
  countLimitExceededAfterInsert,
  istDayStart,
  type PromoLimitReason,
} from './promo-limits';
import { rangeCountLimitExceededAfterInsert, type RangeLimitReason } from '../vcf/amount-range';
import { parseCustomerCopy } from '../customer-copy';
import { cashbackAfterWalletSpend } from '../benefits/cashback-after-wallet';
import type { AppliedBenefit, CommitRequest } from '../types';

function parseJson(v: unknown): Record<string, unknown> {
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Decide how much cashback this commit may credit after the usage row landed.
 * Discount is already inside the captured payment; only cashback can be withheld when a
 * concurrent payment pushed the promotion past a count limit or its budget.
 */
async function resolveAllowedCashbackAfterInsert(opts: {
  promotionId: string;
  ruleId: string | null;
  userId: string;
  discount: number;
  cashback: number;
}): Promise<{ allowed: number; reason: PromoLimitReason | RangeLimitReason | null }> {
  const since = istDayStart(new Date());
  const spend = opts.discount + opts.cashback;
  const [limits, usageMap, budget, rule, rangeBudget] = await Promise.all([
    dbGetLimits(opts.promotionId),
    dbCountUsageBatch({ promotionIds: [opts.promotionId], userId: opts.userId, since }),
    dbAdjustBudgetConsumed(opts.promotionId, spend),
    opts.ruleId ? dbGetRule(opts.ruleId) : Promise.resolve(null),
    opts.ruleId ? dbAdjustRuleBudgetConsumed(opts.ruleId, spend) : Promise.resolve(null),
  ]);

  let rangeCountReason: RangeLimitReason | null = null;
  if (
    rule &&
    (rule.per_user_limit != null || rule.daily_limit != null || rule.campaign_limit != null)
  ) {
    const ruleUsage = await dbCountRuleUsageBatch({ ruleIds: [rule.id], userId: opts.userId, since });
    rangeCountReason = rangeCountLimitExceededAfterInsert(rule, ruleUsage.get(rule.id));
  }

  const countReason =
    countLimitExceededAfterInsert(limits, usageMap.get(opts.promotionId)) ?? rangeCountReason;
  const budgetCap = limits?.budget_limit ?? budget?.budget_limit ?? null;
  let allowed = countReason ? 0 : opts.cashback;
  let reason: PromoLimitReason | RangeLimitReason | null = countReason;
  if (!countReason && budget) {
    allowed = cashbackAllowedWithinBudget({
      budgetCap,
      consumedAfter: budget.budget_consumed,
      cashback: opts.cashback,
    });
    if (allowed < opts.cashback) reason = 'BUDGET_EXHAUSTED';
  }
  if (!countReason && rangeBudget) {
    const rangeAllowed = cashbackAllowedWithinBudget({
      budgetCap: rangeBudget.budget_limit,
      consumedAfter: rangeBudget.budget_consumed,
      cashback: opts.cashback,
    });
    if (rangeAllowed < allowed) {
      allowed = rangeAllowed;
      reason = 'RANGE_BUDGET_EXHAUSTED';
    }
  }
  const withheld = round2(opts.cashback - allowed);
  if (withheld > 0) {
    await dbAdjustBudgetConsumed(opts.promotionId, -withheld);
    if (opts.ruleId) await dbAdjustRuleBudgetConsumed(opts.ruleId, -withheld);
  }
  return { allowed: round2(allowed), reason };
}

/** Quoted cashback was on the full invoice. Wallet spent on this payment does not earn again. */
function scaleCashbackForWalletSpend(
  benefits: AppliedBenefit[],
  invoice: number | undefined,
  walletUsed: number | undefined,
): AppliedBenefit[] {
  if (invoice == null || walletUsed == null) return benefits;
  return benefits.map((b) => {
    if (b.benefit_type !== 'CASHBACK') return b;
    return { ...b, amount: cashbackAfterWalletSpend(b.amount, invoice, walletUsed) };
  });
}

function ruleIdOf(benefits: AppliedBenefit[]): string | null {
  const id = benefits.find((b) => b.rule_id)?.rule_id;
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/**
 * Commit after payment. Idempotent per promotion_id + transaction_id.
 * Credits cashback only here — never on evaluate.
 */
export async function commitPromotion(req: CommitRequest): Promise<{
  success: boolean;
  already_committed?: boolean;
  usage_ids: string[];
  cashback_credited: number;
  error?: string;
}> {
  const evalRow = await dbGetEvaluation(req.evaluation_id);
  if (!evalRow) {
    return { success: false, usage_ids: [], cashback_credited: 0, error: 'EVALUATION_NOT_FOUND' };
  }

  const userId = req.user_id || String(evalRow.user_id);
  const result = parseJson(evalRow.result_json);
  const benefits = scaleCashbackForWalletSpend(
    (Array.isArray(result.benefits) ? result.benefits : []) as AppliedBenefit[],
    req.invoice_amount,
    req.wallet_used,
  );
  const customerCopy = parseCustomerCopy({ customerCopy: result.customer_copy });

  if (!benefits.length) {
    await dbInsertAudit({
      evaluation_id: req.evaluation_id,
      event_type: 'COMMITTED',
      payload: { empty: true, transaction_id: req.transaction_id },
    });
    return { success: true, usage_ids: [], cashback_credited: 0 };
  }

  const byPromo = new Map<string, AppliedBenefit[]>();
  for (const b of benefits) {
    const list = byPromo.get(b.promotion_id) || [];
    list.push(b);
    byPromo.set(b.promotion_id, list);
  }

  /** Cashback this transaction holds in the wallet (new or from an earlier attempt). */
  let cashbackCredited = 0;
  let anyInserted = false;
  let anyNewCredit = false;

  for (const [promotionId, promoBenefits] of byPromo) {
    const discount = promoBenefits
      .filter((b) => b.benefit_type === 'DISCOUNT')
      .reduce((s, b) => s + b.amount, 0);
    const cashback = promoBenefits
      .filter((b) => b.benefit_type === 'CASHBACK')
      .reduce((s, b) => s + b.amount, 0);

    // One usage row per promotion+transaction; idempotency covers retries
    const idempotencyKey = `${promotionId}:${req.transaction_id}:all`;
    const ruleId = ruleIdOf(promoBenefits);
    const { inserted } = await dbInsertUsage({
      promotion_id: promotionId,
      rule_id: ruleId,
      user_id: userId,
      transaction_id: req.transaction_id,
      transaction_type: 'BOOKING',
      evaluation_id: req.evaluation_id,
      discount_amount: discount,
      cashback_amount: cashback,
      idempotency_key: idempotencyKey,
    });

    let allowedCashback = cashback;
    if (inserted) {
      anyInserted = true;
      const decision = await resolveAllowedCashbackAfterInsert({
        promotionId,
        ruleId,
        userId,
        discount,
        cashback,
      });
      allowedCashback = decision.allowed;
      if (allowedCashback < cashback) {
        await dbSetUsageCashback(idempotencyKey, allowedCashback);
        await dbInsertAudit({
          promotion_id: promotionId,
          evaluation_id: req.evaluation_id,
          event_type: 'LIMIT_EXCEEDED_AT_COMMIT',
          payload: {
            transaction_id: req.transaction_id,
            rule_id: ruleId,
            reason: decision.reason,
            cashback_quoted: cashback,
            cashback_allowed: allowedCashback,
          },
        });
      }
    } else {
      // Retry: honour whatever the first commit decided (it may have withheld cashback).
      const existing = await dbGetUsageByIdempotencyKey(idempotencyKey);
      allowedCashback = existing?.reversed_at ? 0 : existing ? existing.cashback_amount : cashback;
    }

    const cashbackRows = pickCashbackBenefits(promoBenefits);
    const scale = cashback > 0 ? Math.max(0, Math.min(1, allowedCashback / cashback)) : 0;
    for (const cb of cashbackRows) {
      const amount = round2(cb.amount * scale);
      if (amount <= 0) continue;
      const credit = await creditPromoCashback({
        userId,
        amount,
        promotionId,
        referenceId: req.transaction_id,
        evaluationId: req.evaluation_id,
        expiryDays: cb.expiry_days,
        redeemScope: cb.redeem || cb.redeem_scope,
      });
      // credited=false means this transaction's wallet credit already exists (retry).
      cashbackCredited += amount;
      if (!credit.credited) continue;
      anyNewCredit = true;
      await notifyPromoCashbackCredited({
        userId,
        amount,
        walletTransactionId: credit.walletTransactionId,
        promotionId,
        transactionId: req.transaction_id,
        expiresAt: credit.expiresAt ?? null,
        expiryDays: cb.expiry_days ?? null,
        copy: customerCopy,
      });
    }

    if (inserted) {
      await dbInsertAudit({
        promotion_id: promotionId,
        evaluation_id: req.evaluation_id,
        event_type: 'COMMITTED',
        payload: {
          transaction_id: req.transaction_id,
          payment_id: req.payment_id,
          rule_id: ruleId,
          discount,
          cashback: allowedCashback,
        },
      });
    }
  }

  if (!anyInserted && !anyNewCredit) {
    return {
      success: true,
      already_committed: true,
      usage_ids: [],
      cashback_credited: round2(cashbackCredited),
    };
  }

  return {
    success: true,
    usage_ids: [],
    cashback_credited: round2(cashbackCredited),
  };
}
