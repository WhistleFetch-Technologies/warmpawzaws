/**
 * Promo cashback redeem_scope gating for wallet spend (Phase 4f / C8).
 * Locked CB = PROMOTION credits whose redeem_scope excludes the current category.
 */
import { query } from '../../../database/rds-connection';
import type { PoolClient } from 'pg';

function normalizeCategory(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '');
}

function scopeAllows(redeemScope: unknown, category: string): boolean {
  if (!category) return true;
  if (redeemScope == null) return true;
  let parsed: unknown = redeemScope;
  if (typeof redeemScope === 'string') {
    try {
      parsed = JSON.parse(redeemScope);
    } catch {
      return true;
    }
  }
  const services =
    Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { services?: unknown }).services)
        ? (parsed as { services: unknown[] }).services
        : [];
  if (!services.length) return true;
  const set = new Set(services.map((s) => normalizeCategory(String(s))));
  return set.has(category);
}

export async function computeSpendableWalletBalance(
  customerId: string,
  serviceCategory?: string | null
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
  const category = normalizeCategory(serviceCategory);
  if (!category) {
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
    if (!scopeAllows(row.redeem_scope, category)) {
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
  }
): Promise<void> {
  const amount = Math.round((opts.amount || 0) * 100) / 100;
  if (amount <= 0) return;
  const category = normalizeCategory(opts.serviceCategory);

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
    if (!scopeAllows(row.redeem_scope, category)) continue;
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
