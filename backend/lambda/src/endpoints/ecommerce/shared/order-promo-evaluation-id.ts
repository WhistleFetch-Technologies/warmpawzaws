/**
 * Evaluation id the shop order was priced with (written at order create). This is the only
 * evaluation that matches the order's discount, so Razorpay create-order / verify must commit it
 * rather than a client-supplied or freshly re-evaluated one.
 */
export function readOrderPromoEvaluationId(metadata: unknown): string | null {
  let parsed: unknown = metadata;
  if (typeof metadata === 'string') {
    try {
      parsed = JSON.parse(metadata);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const meta = parsed as Record<string, unknown>;
  const engine =
    meta.promoEngine && typeof meta.promoEngine === 'object'
      ? (meta.promoEngine as Record<string, unknown>)
      : null;
  const id = meta.evaluationId ?? engine?.evaluationId ?? null;
  const s = id == null ? '' : String(id).trim();
  return s || null;
}
