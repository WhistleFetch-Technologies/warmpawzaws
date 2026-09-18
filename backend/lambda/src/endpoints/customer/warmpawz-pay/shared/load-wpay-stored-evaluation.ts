const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StoredWpayEvaluation = {
  evaluationId: string;
  engineDiscount: number;
  pendingCashback: number;
};

function parseResultJson(raw: unknown): { summary?: { discount?: number; cashback?: number } } | null {
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
  return {
    evaluationId,
    engineDiscount: Math.max(0, Number(parsed?.summary?.discount) || 0),
    pendingCashback: Math.max(0, Number(parsed?.summary?.cashback) || 0),
  };
}
