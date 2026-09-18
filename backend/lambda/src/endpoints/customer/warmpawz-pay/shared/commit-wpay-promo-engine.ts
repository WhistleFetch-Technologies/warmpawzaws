/**
 * Commit Pay Bill promo-engine cashback after capture.
 * Idempotent — verify and reconcile both call this.
 */
export async function commitWpayPromoEngine(opts: {
  paymentId: string;
  customerId: string;
  vendorId?: string | null;
  razorpayPaymentId?: string | null;
  originalAmount?: number;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const meta = opts.metadata && typeof opts.metadata === 'object' ? opts.metadata : {};
  const pe =
    meta.promoEngine && typeof meta.promoEngine === 'object'
      ? (meta.promoEngine as Record<string, unknown>)
      : {};
  let evalId =
    meta.evaluationId || meta.evaluation_id || pe.evaluationId || pe.evaluation_id
      ? String(meta.evaluationId || meta.evaluation_id || pe.evaluationId || pe.evaluation_id)
      : '';
  const { safeCommitPromotion, safeEvaluatePromotions } = await import(
    '../../../../discount-engine/promo-engine'
  );
  if (!evalId) {
    const ev = await safeEvaluatePromotions({
      user_id: opts.customerId,
      transaction: {
        type: 'WPAY',
        service_category:
          (typeof meta.serviceCategory === 'string' && meta.serviceCategory) || undefined,
        vendor_id: opts.vendorId || undefined,
        amount: opts.originalAmount,
      },
    });
    evalId = ev?.evaluation_id ? String(ev.evaluation_id) : '';
  }
  if (!evalId) return;
  await safeCommitPromotion({
    evaluationId: evalId,
    transactionId: opts.paymentId,
    paymentId: opts.razorpayPaymentId || null,
    userId: opts.customerId,
  });
}
