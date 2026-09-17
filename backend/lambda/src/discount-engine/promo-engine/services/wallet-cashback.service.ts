import { query, withTransaction } from '../../../database/rds-connection';
import type { AppliedBenefit, ServiceCategory } from '../types';

/**
 * Credit promo cashback on commit only. Sets 1113 ledger columns.
 * Aligns with wallet_id + customer_id insert patterns used by wallet.ts.
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
    let walletRes = await client.query(
      `SELECT id, customer_id, balance, currency
       FROM customer_wallets
       WHERE customer_id = $1::uuid
       LIMIT 1
       FOR UPDATE`,
      [opts.userId]
    );

    if (!walletRes.rows.length) {
      // Fallback: try text match if user_id is not uuid-shaped
      walletRes = await client.query(
        `SELECT id, customer_id, balance, currency
         FROM customer_wallets
         WHERE customer_id::text = $1
         LIMIT 1
         FOR UPDATE`,
        [opts.userId]
      );
    }

    if (!walletRes.rows.length) {
      try {
        await client.query(
          `INSERT INTO customer_wallets (customer_id, balance, currency)
           VALUES ($1::uuid, 0, 'INR')
           ON CONFLICT (customer_id) DO NOTHING`,
          [opts.userId]
        );
      } catch {
        // ignore create failure; try select again
      }
      walletRes = await client.query(
        `SELECT id, customer_id, balance, currency
         FROM customer_wallets
         WHERE customer_id::text = $1
         LIMIT 1
         FOR UPDATE`,
        [opts.userId]
      );
    }

    if (!walletRes.rows.length) {
      throw new Error(`Wallet not found for user ${opts.userId}`);
    }

    const wallet = walletRes.rows[0] as {
      id: string;
      customer_id: string;
      balance: string | number;
    };
    const newBalance = Number(wallet.balance || 0) + opts.amount;

    await client.query(
      `UPDATE customer_wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [newBalance, wallet.id]
    );

    const txn = await client.query(
      `INSERT INTO wallet_transactions (
         customer_id, wallet_id, transaction_type, amount, balance_after,
         reference_type, reference_id, description,
         promotion_id, source, remaining_amount, earned_at, expires_at,
         cashback_status, redeem_scope
       ) VALUES (
         $1, $2, 'credit', $3, $4,
         'PROMOTION', $5, $6,
         $7::uuid, 'PROMOTION', $3, $8, $9,
         'AVAILABLE', $10::jsonb
       )
       RETURNING id`,
      [
        wallet.customer_id,
        wallet.id,
        opts.amount,
        newBalance,
        opts.referenceId,
        `Promo cashback eval=${opts.evaluationId}`,
        opts.promotionId,
        earnedAt.toISOString(),
        expiresAt ? expiresAt.toISOString() : null,
        JSON.stringify({ services: opts.redeemScope || [] }),
      ]
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
    `SELECT id, amount, remaining_amount, cashback_status, wallet_id, customer_id
     FROM wallet_transactions
     WHERE source = 'PROMOTION'
       AND promotion_id = $1::uuid
       AND reference_id = $2
       AND cashback_status IN ('AVAILABLE', 'PARTIALLY_USED')
     ORDER BY created_at DESC
     LIMIT 1`,
    [opts.promotionId, opts.transactionId]
  );

  if (!existing.rows.length) return { reversed: false };
  const row = existing.rows[0] as Record<string, unknown>;
  const remaining = Number(row.remaining_amount ?? row.amount ?? 0);
  if (remaining <= 0) return { reversed: false };

  return withTransaction(async (client) => {
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

    await client.query(
      `INSERT INTO wallet_transactions (
         customer_id, wallet_id, transaction_type, amount, balance_after,
         reference_type, reference_id, description,
         promotion_id, source, remaining_amount, cashback_status
       )
       SELECT customer_id, wallet_id, 'debit', $1,
              (SELECT balance FROM customer_wallets WHERE id = $2),
              'PROMOTION_REVERSE', $3, 'Promo cashback reverse',
              $4::uuid, 'PROMOTION', 0, 'REVERSED'
       FROM wallet_transactions WHERE id = $5`,
      [remaining, row.wallet_id, opts.transactionId, opts.promotionId, row.id]
    );

    return { reversed: true };
  });
}

export function pickCashbackBenefits(benefits: AppliedBenefit[]): AppliedBenefit[] {
  return benefits.filter((b) => b.benefit_type === 'CASHBACK');
}
