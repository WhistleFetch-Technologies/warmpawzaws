/**
 * Promo cashback redeem_scope gating for wallet spend.
 * V/C/F letter + spend channel when present; otherwise legacy category strings.
 */
import { query } from '../../../database/rds-connection';
import type { PoolClient } from 'pg';
import { redeemAllows } from '../vcf/redeem-allows';
import { categoryIdFromVendorRole } from '../vcf/category-from-role';
import { dbLoadServiceCategories, dbLoadVendorRole } from '../repos/promo-engine.repo';
import type { SpendChannel } from '../vcf/types';
import {
  parseWalletRedeemQuery,
  type WalletRedeemPayment,
} from '../vcf/parse-wallet-query';

export type { WalletRedeemPayment };
export { parseWalletRedeemQuery };

async function enrichWalletRedeemPayment(
  payment: WalletRedeemPayment
): Promise<WalletRedeemPayment> {
  const ctx: WalletRedeemPayment = { ...payment };
  if (ctx.vendorId && !ctx.categoryId) {
    try {
      const vendor = await dbLoadVendorRole(String(ctx.vendorId));
      if (vendor) {
        const catalogue = await dbLoadServiceCategories();
        ctx.categoryId = categoryIdFromVendorRole({
          roleId: vendor.roleId,
          roleName: vendor.roleName,
          categories: catalogue,
        });
      }
    } catch {
      // vendor/catalogue lookup is best-effort for letter C
    }
  }
  return ctx;
}

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
  const ctx = await enrichWalletRedeemPayment({
    serviceCategory: payment?.serviceCategory ?? serviceCategory,
    vendorId: payment?.vendorId,
    categoryId: payment?.categoryId,
    channel: payment?.channel,
    ecommerceCategoryId: payment?.ecommerceCategoryId,
  });
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
  const ctx = await enrichWalletRedeemPayment({
    serviceCategory: opts.serviceCategory,
    vendorId: opts.vendorId,
    categoryId: opts.categoryId,
    channel: opts.channel,
    ecommerceCategoryId: opts.ecommerceCategoryId,
  });

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
