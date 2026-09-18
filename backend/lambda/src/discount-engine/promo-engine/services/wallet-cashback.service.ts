import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../../database/rds-connection';
import type { AppliedBenefit, ServiceCategory } from '../types';
import { buildCustomerWalletCreateSql, buildPromoLedgerInsert } from './wallet-cashback-sql';

async function columnSet(client: PoolClient, table: string): Promise<Set<string>> {
  const r = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set(r.rows.map((x) => x.column_name));
}

/**
 * Credit promo cashback on commit only.
 * Live RDS is 001-shaped: customer_wallets has no currency; wallet_transactions is wallet_id-only.
 */
export async function creditPromoCashback(opts: {
  userId: string;
  amount: number;
  promotionId: string;
  referenceId: string;
  evaluationId: string;
  expiryDays?: number;
  redeemScope?: ServiceCategory[];
}): Promise<{ walletTransactionId: string | null; credited: boolean }> {
  if (opts.amount <= 0) return { walletTransactionId: null, credited: false };

  const earnedAt = new Date();
  const expiresAt =
    opts.expiryDays != null
      ? new Date(earnedAt.getTime() + opts.expiryDays * 24 * 60 * 60 * 1000)
      : null;

  return withTransaction(async (client) => {
    const cwCols = await columnSet(client, 'customer_wallets');
    const wtCols = await columnSet(client, 'wallet_transactions');

    const create = buildCustomerWalletCreateSql(cwCols);
    create.values[0] = opts.userId;
    try {
      await client.query(create.sql, create.values);
    } catch {
      // race or missing optional col — select below is authoritative
    }

    const walletRes = await client.query(
      `SELECT id, customer_id, balance
       FROM customer_wallets
       WHERE customer_id::text = $1
       LIMIT 1
       FOR UPDATE`,
      [opts.userId]
    );

    if (!walletRes.rows.length) {
      throw new Error(`Wallet not found for user ${opts.userId}`);
    }

    const wallet = walletRes.rows[0] as {
      id: string;
      customer_id: string;
      balance: string | number;
    };

    if (wtCols.has('promotion_id') && wtCols.has('source')) {
      const dup = await client.query(
        `SELECT id::text AS id
         FROM wallet_transactions
         WHERE source = 'PROMOTION'
           AND promotion_id = $1::uuid
           AND reference_id::text = $2
         LIMIT 1`,
        [opts.promotionId, opts.referenceId]
      );
      if (dup.rows.length) {
        return { walletTransactionId: String(dup.rows[0].id), credited: false };
      }
    }

    const newBalance = Number(wallet.balance || 0) + opts.amount;
    const setParts = ['balance = $1'];
    const setVals: unknown[] = [newBalance, wallet.id];
    if (cwCols.has('updated_at')) setParts.push('updated_at = NOW()');
    if (cwCols.has('total_earned')) {
      setParts.push('total_earned = COALESCE(total_earned, 0) + $3');
      setVals.push(opts.amount);
    }
    await client.query(
      `UPDATE customer_wallets SET ${setParts.join(', ')} WHERE id = $2`,
      setVals
    );

    const { columns, placeholders } = buildPromoLedgerInsert({
      wtCols,
      includeCustomerId: true,
    });
    const valueByCol: Record<string, unknown> = {
      wallet_id: wallet.id,
      customer_id: wallet.customer_id,
      transaction_type: 'credit',
      amount: opts.amount,
      balance_after: newBalance,
      reference_type: 'PROMOTION',
      reference_id: opts.referenceId,
      description: `Promo cashback eval=${opts.evaluationId}`,
      promotion_id: opts.promotionId,
      source: 'PROMOTION',
      remaining_amount: opts.amount,
      earned_at: earnedAt.toISOString(),
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      cashback_status: 'AVAILABLE',
      redeem_scope: JSON.stringify({ services: opts.redeemScope || [] }),
    };
    const params = columns.map((c) => valueByCol[c]);
    const txn = await client.query(
      `INSERT INTO wallet_transactions (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING id`,
      params
    );

    return {
      walletTransactionId: String(txn.rows[0].id),
      credited: true,
    };
  });
}

export async function reversePromoCashbackForTransaction(opts: {
  transactionId: string;
  promotionId: string;
  userId: string;
}): Promise<{ reversed: boolean }> {
  const existing = await query(
    `SELECT wt.id, wt.amount, wt.remaining_amount, wt.cashback_status, wt.wallet_id
     FROM wallet_transactions wt
     LEFT JOIN customer_wallets cw ON cw.id = wt.wallet_id
     WHERE wt.source = 'PROMOTION'
       AND wt.promotion_id = $1::uuid
       AND wt.reference_id::text = $2
       AND wt.cashback_status IN ('AVAILABLE', 'PARTIALLY_USED')
       AND (cw.customer_id::text = $3 OR $3 IS NULL)
     ORDER BY wt.created_at DESC
     LIMIT 1`,
    [opts.promotionId, opts.transactionId, opts.userId]
  );

  if (!existing.rows.length) return { reversed: false };
  const row = existing.rows[0] as Record<string, unknown>;
  const remaining = Number(row.remaining_amount ?? row.amount ?? 0);
  if (remaining <= 0) return { reversed: false };

  return withTransaction(async (client) => {
    const wtCols = await columnSet(client, 'wallet_transactions');
    await client.query(
      `UPDATE wallet_transactions
       SET cashback_status = 'REVERSED', remaining_amount = 0
       WHERE id = $1`,
      [row.id]
    );

    if (row.wallet_id) {
      await client.query(
        `UPDATE customer_wallets
         SET balance = GREATEST(0, balance - $1), updated_at = NOW()
         WHERE id = $2`,
        [remaining, row.wallet_id]
      );
    }

    const { columns, placeholders } = buildPromoLedgerInsert({
      wtCols,
      includeCustomerId: false,
    });
    const newBalRes = row.wallet_id
      ? await client.query(`SELECT balance FROM customer_wallets WHERE id = $1`, [row.wallet_id])
      : { rows: [{ balance: 0 }] };
    const valueByCol: Record<string, unknown> = {
      wallet_id: row.wallet_id,
      transaction_type: 'debit',
      amount: remaining,
      balance_after: Number(newBalRes.rows[0]?.balance || 0),
      reference_type: 'PROMOTION_REVERSE',
      reference_id: opts.transactionId,
      description: 'Promo cashback reverse',
      promotion_id: opts.promotionId,
      source: 'PROMOTION',
      remaining_amount: 0,
      earned_at: null,
      expires_at: null,
      cashback_status: 'REVERSED',
      redeem_scope: null,
    };
    const params = columns.map((c) => valueByCol[c] ?? null);
    await client.query(
      `INSERT INTO wallet_transactions (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})`,
      params
    );

    return { reversed: true };
  });
}

export function pickCashbackBenefits(benefits: AppliedBenefit[]): AppliedBenefit[] {
  return benefits.filter((b) => b.benefit_type === 'CASHBACK');
}
