/**
 * Promo cashback redeem_scope gating for wallet spend.
 * V/C/F letter + spend channel when present; otherwise legacy category strings.
 */
import { query } from '../../../database/rds-connection';
import type { PoolClient } from 'pg';
import { redeemAllows, type RedeemPayment } from '../vcf/redeem-allows';
import type { SpendChannel } from '../vcf/types';

export type WalletRedeemPayment = RedeemPayment & {
  serviceCategory?: string | null;
  channel?: SpendChannel | null;
};

export async function computeSpendableWalletBalance(
  customerId: string,
  serviceCategory?: string | null,
  payment?: WalletRedeemPayment
): Promise<{
  balance: number;
  spendable: number;
  lockedPromoCashback: number;
}> {
  const balRes = await query(
    `SELECT COALESCE(balance, 0)::text AS balance
     FROM customer_wallets
     WHERE customer_id::text = $1
     LIMIT 1`,
    [customerId]
  );
  const balance = Math.round((parseFloat(String(balRes.rows[0]?.balance ?? '0')) || 0) * 100) / 100;
  const ctx: WalletRedeemPayment = {
    serviceCategory: payment?.serviceCategory ?? serviceCategory,
    vendorId: payment?.vendorId,
    categoryId: payment?.categoryId,
    channel: payment?.channel,
    ecommerceCategoryId: payment?.ecommerceCategoryId,
  };
  const hasContext = Boolean(ctx.channel || ctx.serviceCategory || ctx.vendorId || ctx.categoryId);
  if (!hasContext) {
    return { balance, spendable: balance, lockedPromoCashback: 0 };
  }

  const promoRes = await query(
    `SELECT wt.remaining_amount::text AS remaining, wt.redeem_scope
     FROM wallet_transactions wt
     JOIN customer_wallets cw ON cw.id = wt.wallet_id
     WHERE cw.customer_id::text = $1
       AND wt.source = 'PROMOTION'
       AND wt.cashback_status IN ('AVAILABLE', 'PARTIALLY_USED')
       AND COALESCE(wt.remaining_amount, 0) > 0`,
    [customerId]
  ).catch(() => ({ rows: [] as Array<{ remaining?: string; redeem_scope?: unknown }> }));

  let locked = 0;
  for (const row of promoRes.rows || []) {
    const rem = Math.round((parseFloat(String(row.remaining ?? '0')) || 0) * 100) / 100;
    if (rem <= 0) continue;
    if (!redeemAllows(row.redeem_scope, ctx)) {
      locked += rem;
    }
  }
  locked = Math.round(locked * 100) / 100;
  const spendable = Math.max(0, Math.round((balance - locked) * 100) / 100);
  return { balance, spendable, lockedPromoCashback: locked };
}

/** FIFO reduce remaining_amount on matching promo credits after a successful debit. */
export async function consumePromoCashbackForDebit(
  client: PoolClient,
  opts: {
    customerId: string;
    amount: number;
    serviceCategory?: string | null;
    vendorId?: string | null;
    categoryId?: string | null;
    channel?: SpendChannel | null;
    ecommerceCategoryId?: string | null;
  }
): Promise<void> {
  const amount = Math.round((opts.amount || 0) * 100) / 100;
  if (amount <= 0) return;
  const ctx: WalletRedeemPayment = {
    serviceCategory: opts.serviceCategory,
    vendorId: opts.vendorId,
    categoryId: opts.categoryId,
    channel: opts.channel,
    ecommerceCategoryId: opts.ecommerceCategoryId,
  };

  const rows = await client.query(
    `SELECT wt.id, wt.remaining_amount::text AS remaining, wt.redeem_scope
     FROM wallet_transactions wt
     JOIN customer_wallets cw ON cw.id = wt.wallet_id
     WHERE cw.customer_id::text = $1
       AND wt.source = 'PROMOTION'
       AND wt.cashback_status IN ('AVAILABLE', 'PARTIALLY_USED')
       AND COALESCE(wt.remaining_amount, 0) > 0
     ORDER BY wt.earned_at ASC NULLS LAST, wt.created_at ASC
     FOR UPDATE`,
    [opts.customerId]
  );

  let left = amount;
  for (const row of rows.rows as Array<{
    id: string;
    remaining: string;
    redeem_scope?: unknown;
  }>) {
    if (left <= 0.009) break;
    if (!redeemAllows(row.redeem_scope, ctx)) continue;
    const rem = Math.round((parseFloat(String(row.remaining ?? '0')) || 0) * 100) / 100;
    if (rem <= 0) continue;
    const take = Math.min(rem, left);
    const nextRem = Math.round((rem - take) * 100) / 100;
    const status = nextRem <= 0.009 ? 'FULLY_USED' : 'PARTIALLY_USED';
    await client.query(
      `UPDATE wallet_transactions
       SET remaining_amount = $1,
           cashback_status = $2
       WHERE id = $3`,
      [nextRem <= 0.009 ? 0 : nextRem, status, row.id]
    );
    left = Math.round((left - take) * 100) / 100;
  }
}
