import type { BenefitCapNotice } from '../../../../discount-engine/promo-engine/benefit-cap/gate';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StoredWpayEvaluation = {
  evaluationId: string;
  engineDiscount: number;
  pendingCashback: number;
  /** Set when the stored quote was already capped by the global benefit cap. */
  benefitCap: BenefitCapNotice | null;
};

function parseResultJson(raw: unknown): {
  summary?: { discount?: number; cashback?: number };
  benefit_cap?: unknown;
} | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as { summary?: { discount?: number; cashback?: number } };
    } catch {
      return null;
    }
  }
  return raw as { summary?: { discount?: number; cashback?: number }; benefit_cap?: unknown };
}

/** Use the Get Discount preview evaluation so Razorpay matches what the customer saw. */
export async function loadOwnedWpayEvaluation(
  evaluationId: string,
  customerId: string,
): Promise<StoredWpayEvaluation | null> {
  if (!UUID_RE.test(evaluationId)) return null;
  const { dbGetEvaluation } = await import(
    '../../../../discount-engine/promo-engine/repos/promo-engine.repo'
  );
  const row = await dbGetEvaluation(evaluationId);
  if (!row || String(row.user_id) !== customerId) return null;
  const parsed = parseResultJson(row.result_json);
  const engineDiscount = Math.max(0, Number(parsed?.summary?.discount) || 0);
  const pendingCashback = Math.max(0, Number(parsed?.summary?.cashback) || 0);
  const { storedQuoteBlockedByBenefitCap } = await import(
    '../../../../discount-engine/promo-engine/services/owned-evaluation'
  );
  if (
    await storedQuoteBlockedByBenefitCap({
      userId: customerId,
      discount: engineDiscount,
      cashback: pendingCashback,
      alreadyCapped: Boolean(parsed?.benefit_cap),
    })
  ) {
    return null;
  }
  const benefitCap =
    parsed?.benefit_cap && typeof parsed.benefit_cap === 'object'
      ? (parsed.benefit_cap as BenefitCapNotice)
      : null;
  return { evaluationId, engineDiscount, pendingCashback, benefitCap };
}
