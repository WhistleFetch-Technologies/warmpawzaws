/**
 * Safe lifecycle hooks for promo-engine commit/reverse across checkout surfaces.
 * Never throws to callers — logs and returns status (payment paths must not fail).
 */
import { commitPromotion } from './commit.service';
import { reversePromotion } from './reverse.service';
import { evaluatePromotions } from './evaluate.service';
import type { EvaluateRequest, EvaluateResult } from '../types';

export async function safeCommitPromotion(opts: {
  evaluationId?: string | null;
  transactionId: string;
  paymentId?: string | null;
  userId?: string | null;
}): Promise<{ ok: boolean; already?: boolean; cashback?: number; skipped?: boolean }> {
  if (!opts.evaluationId) {
    return { ok: true, skipped: true };
  }
  try {
    const result = await commitPromotion({
      evaluation_id: opts.evaluationId,
      transaction_id: opts.transactionId,
      payment_id: opts.paymentId || undefined,
      user_id: opts.userId || undefined,
    });
    return {
      ok: result.success,
      already: result.already_committed,
      cashback: result.cashback_credited,
    };
  } catch (err) {
    console.warn(
      '[promo-engine] safeCommit failed:',
      err instanceof Error ? err.message : err
    );
    return { ok: false };
  }
}

export async function safeReversePromotion(opts: {
  transactionId: string;
  evaluationId?: string | null;
  userId?: string | null;
  reason?: string;
}): Promise<{ ok: boolean; reversed?: number }> {
  try {
    const result = await reversePromotion({
      transaction_id: opts.transactionId,
      evaluation_id: opts.evaluationId || undefined,
      user_id: opts.userId || undefined,
      reason: opts.reason,
    });
    return { ok: result.success, reversed: result.reversed_cashback };
  } catch (err) {
    console.warn(
      '[promo-engine] safeReverse failed:',
      err instanceof Error ? err.message : err
    );
    return { ok: false };
  }
}

export async function safeEvaluatePromotions(
  req: EvaluateRequest
): Promise<EvaluateResult | null> {
  try {
    return await evaluatePromotions(req);
  } catch (err) {
    console.warn(
      '[promo-engine] safeEvaluate failed:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
