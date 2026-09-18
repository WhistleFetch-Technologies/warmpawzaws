const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OwnedEvaluationDiscount = {
  evaluationId: string;
  discount: number;
  cashback: number;
  eligible: boolean;
};

function parseResult(raw: unknown): { summary?: { discount?: number; cashback?: number } } | null {
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
  return {
    evaluationId,
    discount,
    cashback,
    eligible: discount > 0 || cashback > 0,
  };
}
