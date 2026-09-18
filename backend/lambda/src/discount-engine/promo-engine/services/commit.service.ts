import {
  dbGetEvaluation,
  dbInsertAudit,
  dbInsertUsage,
  dbUpdatePromotion,
  dbGetPromotion,
} from '../repos/promo-engine.repo';
import { creditPromoCashback, pickCashbackBenefits } from './wallet-cashback.service';
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

/**
 * Commit after payment. Idempotent per promotion_id + transaction_id + benefit.
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
  const benefits = (Array.isArray(result.benefits) ? result.benefits : []) as AppliedBenefit[];
  const summary = (result.summary || {}) as {
    discount?: number;
    cashback?: number;
  };

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

  let cashbackCredited = 0;
  let anyInserted = false;
  let allDup = true;

  for (const [promotionId, promoBenefits] of byPromo) {
    const discount = promoBenefits
      .filter((b) => b.benefit_type === 'DISCOUNT')
      .reduce((s, b) => s + b.amount, 0);
    const cashback = promoBenefits
      .filter((b) => b.benefit_type === 'CASHBACK')
      .reduce((s, b) => s + b.amount, 0);

    // One usage row per promotion+transaction; idempotency covers retries
    const idempotencyKey = `${promotionId}:${req.transaction_id}:all`;
    const { inserted } = await dbInsertUsage({
      promotion_id: promotionId,
      user_id: userId,
      transaction_id: req.transaction_id,
      transaction_type: 'BOOKING',
      evaluation_id: req.evaluation_id,
      discount_amount: discount,
      cashback_amount: cashback,
      idempotency_key: idempotencyKey,
    });

    if (inserted) {
      allDup = false;
      anyInserted = true;
      const promo = await dbGetPromotion(promotionId);
      if (promo) {
        const add = discount + cashback;
        await dbUpdatePromotion(promotionId, {
          budget_consumed: Number(promo.budget_consumed || 0) + add,
        });
      }
    }

    for (const cb of pickCashbackBenefits(promoBenefits)) {
      const credit = await creditPromoCashback({
        userId,
        amount: cb.amount,
        promotionId,
        referenceId: req.transaction_id,
        evaluationId: req.evaluation_id,
        expiryDays: cb.expiry_days,
        redeemScope: cb.redeem_scope,
      });
      if (credit.credited) cashbackCredited += cb.amount;
    }

    if (inserted) {
      await dbInsertAudit({
        promotion_id: promotionId,
        evaluation_id: req.evaluation_id,
        event_type: 'COMMITTED',
        payload: {
          transaction_id: req.transaction_id,
          payment_id: req.payment_id,
          discount,
          cashback,
        },
      });
    }
  }

  if (!anyInserted && allDup && cashbackCredited <= 0) {
    return {
      success: true,
      already_committed: true,
      usage_ids: [],
      cashback_credited: 0,
    };
  }

  return {
    success: true,
    usage_ids: [],
    cashback_credited: cashbackCredited || Number(summary.cashback || 0),
  };
}
