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
  const {
    safeCommitPromotion,
    safeEvaluatePromotions,
    loadServerPaymentContext,
    safeRecordVcfVisitFromPayBill,
  } = await import('../../../../discount-engine/promo-engine');
  const ctx = await loadServerPaymentContext({
    surface: 'paybill',
    vendorId: opts.vendorId,
    bookingCategoryId:
      typeof meta.categoryId === 'string'
        ? meta.categoryId
        : typeof meta.bookingCategoryId === 'string'
          ? meta.bookingCategoryId
          : null,
  });
  if (!evalId) {
    const ev = await safeEvaluatePromotions({
      user_id: opts.customerId,
      transaction: {
        type: 'WPAY',
        channel: 'paybill',
        vendor_id: ctx.vendorId || opts.vendorId || undefined,
        vendorId: ctx.vendorId || opts.vendorId || undefined,
        categoryId: ctx.categoryId || undefined,
        amount: opts.originalAmount,
      },
    });
    evalId = ev?.evaluation_id ? String(ev.evaluation_id) : '';
  }
  if (evalId) {
    await safeCommitPromotion({
      evaluationId: evalId,
      transactionId: opts.paymentId,
      paymentId: opts.razorpayPaymentId || null,
      userId: opts.customerId,
    });
  }
  await safeRecordVcfVisitFromPayBill({
    paymentId: opts.paymentId,
    customerId: opts.customerId,
    vendorId: ctx.vendorId || opts.vendorId,
    bookingCategoryId: ctx.categoryId,
  });
}
