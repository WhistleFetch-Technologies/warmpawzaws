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

function parseJson<T>(raw: unknown): T | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return raw as T;
}

type StoredRequest = { transaction?: { amount?: unknown; vendorId?: unknown; vendor_id?: unknown } };
type StoredResult = { summary?: { discount?: number; cashback?: number }; benefit_cap?: unknown };

/**
 * A stored quote is only reused for the same bill amount and vendor: promo ranges make the
 * benefit depend on the amount, so a quote for another amount must be re-evaluated.
 */
function quoteMatchesPayment(
  requestJson: unknown,
  expected: { amount: number; vendorId: string },
): boolean {
  const tx = parseJson<StoredRequest>(requestJson)?.transaction;
  if (!tx) return false;
  const amount = Number(tx.amount);
  if (!Number.isFinite(amount) || Math.abs(amount - expected.amount) > 0.005) return false;
  const vendor = String(tx.vendorId ?? tx.vendor_id ?? '').trim();
  return vendor === expected.vendorId;
}

/** Use the Get Discount preview evaluation so Razorpay matches what the customer saw. */
export async function loadOwnedWpayEvaluation(
  evaluationId: string,
  customerId: string,
  expected: { amount: number; vendorId: string },
): Promise<StoredWpayEvaluation | null> {
  if (!UUID_RE.test(evaluationId)) return null;
  const { dbGetEvaluation } = await import(
    '../../../../discount-engine/promo-engine/repos/promo-engine.repo'
  );
  const row = await dbGetEvaluation(evaluationId);
  if (!row || String(row.user_id) !== customerId) return null;
  if (!quoteMatchesPayment(row.request_json, expected)) return null;
  const parsed = parseJson<StoredResult>(row.result_json);
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
