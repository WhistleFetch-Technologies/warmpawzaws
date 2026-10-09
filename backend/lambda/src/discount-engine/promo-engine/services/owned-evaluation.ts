import { resolveBenefitCapNotice } from './benefit-cap.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OwnedEvaluationDiscount = {
  evaluationId: string;
  discount: number;
  cashback: number;
  eligible: boolean;
};

function parseResult(
  raw: unknown,
): { summary?: { discount?: number; cashback?: number }; benefit_cap?: unknown } | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as { summary?: { discount?: number; cashback?: number } };
    } catch {
      return null;
    }
  }
  return raw as { summary?: { discount?: number; cashback?: number } };
}

/**
 * A stored quote that still carries benefits is only reused while the customer is under the
 * benefit cap; otherwise the caller re-evaluates and gets the capped result.
 */
export async function storedQuoteBlockedByBenefitCap(opts: {
  userId: string;
  discount: number;
  cashback: number;
  alreadyCapped: boolean;
}): Promise<boolean> {
  if (opts.alreadyCapped || (opts.discount <= 0 && opts.cashback <= 0)) return false;
  const notice = await resolveBenefitCapNotice({ userId: opts.userId });
  if (!notice) return false;
  return (
    (opts.discount > 0 && notice.blocked.discount) || (opts.cashback > 0 && notice.blocked.cashback)
  );
}

export async function loadOwnedEvaluationDiscount(
  evaluationId: string,
  userId: string,
): Promise<OwnedEvaluationDiscount | null> {
  if (!UUID_RE.test(evaluationId)) return null;
  const { dbGetEvaluation } = await import('../repos/promo-engine.repo');
  const row = await dbGetEvaluation(evaluationId);
  if (!row || String(row.user_id) !== userId) return null;
  const parsed = parseResult(row.result_json);
  const discount = Math.max(0, Number(parsed?.summary?.discount) || 0);
  const cashback = Math.max(0, Number(parsed?.summary?.cashback) || 0);
  if (
    await storedQuoteBlockedByBenefitCap({
      userId,
      discount,
      cashback,
      alreadyCapped: Boolean(parsed?.benefit_cap),
    })
  ) {
    return null;
  }
  return {
    evaluationId,
    discount,
    cashback,
    eligible: discount > 0 || cashback > 0,
  };
}
