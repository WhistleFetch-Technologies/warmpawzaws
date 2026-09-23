import { query } from '../../../../database/rds-connection';

/**
 * Commit Pay Bill promo-engine cashback after capture.
 * Idempotent — verify and reconcile both call this.
 * Writes awardedCashback onto payments.metadata (+ settlement_breakup) for admin recon.
 */
export async function commitWpayPromoEngine(opts: {
  paymentId: string;
  customerId: string;
  vendorId?: string | null;
  razorpayPaymentId?: string | null;
  originalAmount?: number;
  metadata?: Record<string, unknown> | null;
}): Promise<{ awardedCashback: number }> {
  const meta = opts.metadata && typeof opts.metadata === 'object' ? opts.metadata : {};
  const pe =
    meta.promoEngine && typeof meta.promoEngine === 'object'
      ? (meta.promoEngine as Record<string, unknown>)
      : {};
  const pendingFromMeta = Number(pe.pendingCashback ?? meta.pendingCashback ?? 0);
  const existingAwarded = Number(pe.awardedCashback ?? meta.awardedCashback ?? NaN);

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

  let awardedCashback = 0;
  if (evalId) {
    const commitResult = await safeCommitPromotion({
      evaluationId: evalId,
      transactionId: opts.paymentId,
      paymentId: opts.razorpayPaymentId || null,
      userId: opts.customerId,
    });
    if (commitResult.ok) {
      const credited = Number(commitResult.cashback ?? 0);
      if (Number.isFinite(credited) && credited > 0.009) {
        awardedCashback = Math.round(credited * 100) / 100;
      } else if (commitResult.already && Number.isFinite(existingAwarded) && existingAwarded >= 0) {
        awardedCashback = Math.round(existingAwarded * 100) / 100;
      } else if (
        commitResult.already &&
        Number.isFinite(pendingFromMeta) &&
        pendingFromMeta > 0.009
      ) {
        // First commit credited wallet; retry returns already with cashback=0 — use quote promise.
        awardedCashback = Math.round(pendingFromMeta * 100) / 100;
      } else {
        awardedCashback = 0;
      }
      await persistWpayAwardedCashback({
        paymentId: opts.paymentId,
        evaluationId: evalId,
        awardedCashback,
        pendingCashback: Number.isFinite(pendingFromMeta) ? pendingFromMeta : 0,
      });
    }
  }

  await safeRecordVcfVisitFromPayBill({
    paymentId: opts.paymentId,
    customerId: opts.customerId,
    vendorId: ctx.vendorId || opts.vendorId,
    bookingCategoryId: ctx.categoryId,
  });

  return { awardedCashback };
}

async function persistWpayAwardedCashback(opts: {
  paymentId: string;
  evaluationId: string;
  awardedCashback: number;
  pendingCashback: number;
}): Promise<void> {
  const patch = {
    awardedCashback: opts.awardedCashback,
    evaluationId: opts.evaluationId,
    promoEngine: {
      awardedCashback: opts.awardedCashback,
      pendingCashback: opts.pendingCashback,
      evaluationId: opts.evaluationId,
    },
  };

  try {
    await query(
      `UPDATE payments
       SET metadata = COALESCE(metadata, '{}'::jsonb)
         || $2::jsonb
         || jsonb_build_object(
              'promoEngine',
              COALESCE(metadata->'promoEngine', '{}'::jsonb)
                || ($2::jsonb->'promoEngine')
            ),
           updated_at = NOW()
       WHERE id = $1::uuid
         AND payment_source = 'warmpawz_pay'`,
      [opts.paymentId, JSON.stringify(patch)],
    );
  } catch (err) {
    console.warn(
      '[wpay-promo] awardedCashback payment metadata write failed',
      err instanceof Error ? err.message : err,
    );
  }

  try {
    await query(
      `UPDATE settlements
       SET settlement_breakup = COALESCE(settlement_breakup, '{}'::jsonb)
         || jsonb_build_object(
              'awardedCashback', $2::numeric,
              'evaluationId', $3::text,
              'pendingCashback', COALESCE(
                (settlement_breakup->>'pendingCashback')::numeric,
                $4::numeric
              )
            )
           || CASE
                WHEN settlement_breakup ? 'promoEngine'
                  THEN jsonb_build_object(
                    'promoEngine',
                    COALESCE(settlement_breakup->'promoEngine', '{}'::jsonb)
                      || jsonb_build_object(
                           'awardedCashback', $2::numeric,
                           'evaluationId', $3::text
                         )
                  )
                ELSE '{}'::jsonb
              END
       WHERE payment_id = $1::uuid
         AND order_type = 'warmpawz_pay'`,
      [opts.paymentId, opts.awardedCashback, opts.evaluationId, opts.pendingCashback],
    );
  } catch (err) {
    console.warn(
      '[wpay-promo] awardedCashback settlement_breakup write failed',
      err instanceof Error ? err.message : err,
    );
  }
}
