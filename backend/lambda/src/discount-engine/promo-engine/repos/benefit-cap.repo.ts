import { query } from '../../../database/rds-connection';

export async function dbGetBenefitCapSettings(): Promise<{
  benefit_cap: unknown;
  updated_by: string | null;
  updated_at: string | null;
} | null> {
  const res = await query(
    `SELECT benefit_cap, updated_by, updated_at FROM promo_engine_settings WHERE id = 1 LIMIT 1`,
    [],
  );
  const r = res.rows?.[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    benefit_cap: r.benefit_cap,
    updated_by: r.updated_by != null ? String(r.updated_by) : null,
    updated_at: r.updated_at != null ? String(r.updated_at) : null,
  };
}

export async function dbSaveBenefitCapSettings(benefitCap: unknown, updatedBy: string | null): Promise<void> {
  await query(
    `INSERT INTO promo_engine_settings (id, benefit_cap, updated_by, updated_at)
     VALUES (1, $1::jsonb, $2, NOW())
     ON CONFLICT (id) DO UPDATE
       SET benefit_cap = EXCLUDED.benefit_cap,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
    [JSON.stringify(benefitCap), updatedBy],
  );
}

/**
 * Benefit payments for one customer since `since`, one row per payment (oldest first).
 * A payment counts when it committed a promo discount/cashback (not reversed) or spent wallet.
 * Pay Bill / booking / shop use the same id for the usage row and the wallet debit, so a
 * payment with both is counted once.
 */
export async function dbListBenefitPaymentsSince(opts: {
  userId: string;
  since: Date;
  excludeTransactionId?: string | null;
}): Promise<Array<{ ref: string; at: Date }>> {
  const res = await query(
    `SELECT ref, MIN(at) AS at
     FROM (
       SELECT u.transaction_id AS ref, u.created_at AS at
       FROM promo_engine_usage u
       WHERE u.user_id = $1::text
         AND u.created_at >= $2::timestamptz
         AND u.reversed_at IS NULL
         AND (COALESCE(u.discount_amount, 0) > 0 OR COALESCE(u.cashback_amount, 0) > 0)
       UNION ALL
       SELECT wt.reference_id::text AS ref, wt.created_at AS at
       FROM wallet_transactions wt
       JOIN customer_wallets cw ON cw.id = wt.wallet_id
       WHERE cw.customer_id::text = $1::text
         AND wt.transaction_type = 'debit'
         AND wt.created_at >= $2::timestamptz
         AND wt.reference_id IS NOT NULL
         AND COALESCE(wt.amount, 0) > 0
         AND COALESCE(wt.source, '') <> 'PROMOTION'
         AND COALESCE(wt.reference_type, '') <> 'PROMOTION_REVERSE'
     ) x
     WHERE ref IS NOT NULL AND ref <> COALESCE($3::text, '')
     GROUP BY ref
     ORDER BY MIN(at) ASC
     LIMIT 500`,
    [opts.userId, opts.since.toISOString(), opts.excludeTransactionId || null],
  );
  return ((res.rows || []) as Array<Record<string, unknown>>).map((r) => ({
    ref: String(r.ref),
    at: r.at instanceof Date ? r.at : new Date(String(r.at)),
  }));
}

export async function dbTransactionHasUsage(transactionId: string): Promise<boolean> {
  const res = await query(
    `SELECT 1 FROM promo_engine_usage WHERE transaction_id = $1::text LIMIT 1`,
    [transactionId],
  );
  return (res.rows || []).length > 0;
}
