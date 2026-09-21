/**
 * Idempotent promo-scoped wallet debit for shop / tele / Pay Bill.
 * Honors cashback redeem_scope on the way out (same rules as credit).
 */
import type { PoolClient } from 'pg';
import { withTransaction } from '../../../database/rds-connection';
import {
  computeSpendableWalletBalance,
  consumePromoCashbackForDebit,
} from './wallet-redeem-scope.service';

export type DebitScopedWalletParams = {
  customerId: string;
  amount: number;
  serviceCategory?: string | null;
  vendorId?: string | null;
  categoryId?: string | null;
  channel?: 'tele' | 'appointment' | 'paybill' | 'ecommerce' | null;
  ecommerceCategoryId?: string | null;
  referenceType: string;
  referenceId: string;
  description: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function debitScopedWalletInTransaction(
  client: PoolClient,
  params: DebitScopedWalletParams,
): Promise<{ reused: boolean; debited: number; balanceAfter: number }> {
  const amount = round2(params.amount);
  if (!params.customerId || !params.referenceId || amount <= 0) {
    return { reused: false, debited: 0, balanceAfter: 0 };
  }

  const lock = await client.query(
    `SELECT id, balance::text AS balance
     FROM customer_wallets
     WHERE customer_id = $1::uuid
     FOR UPDATE`,
    [params.customerId],
  );
  if (!lock.rows.length) {
    throw new Error('Wallet not found');
  }
  const walletId = String(lock.rows[0].id);
  const balance = round2(parseFloat(String(lock.rows[0].balance ?? '0')) || 0);

  const existing = await client.query(
    `SELECT amount::text AS amount, balance_after::text AS balance_after
     FROM wallet_transactions
     WHERE wallet_id = $1
       AND transaction_type = 'debit'
       AND reference_type = $2
       AND reference_id::text = $3
     LIMIT 1`,
    [walletId, params.referenceType, String(params.referenceId)],
  );
  if (existing.rows.length) {
    return {
      reused: true,
      debited: round2(parseFloat(String(existing.rows[0].amount ?? amount)) || amount),
      balanceAfter:
        round2(parseFloat(String(existing.rows[0].balance_after ?? balance)) || balance),
    };
  }

  const scoped = await computeSpendableWalletBalance(params.customerId, params.serviceCategory, {
    serviceCategory: params.serviceCategory,
    vendorId: params.vendorId,
    categoryId: params.categoryId,
    channel: params.channel,
    ecommerceCategoryId: params.ecommerceCategoryId,
  });
  if (amount > scoped.spendable + 0.009) {
    throw new Error(
      `Insufficient spendable wallet (spendable ₹${scoped.spendable.toFixed(2)}, locked ₹${scoped.lockedPromoCashback.toFixed(2)})`,
    );
  }
  if (balance + 0.009 < amount) {
    throw new Error(`Insufficient wallet balance. Available: ₹${balance.toFixed(2)}`);
  }

  const upd = await client.query(
    `UPDATE customer_wallets
     SET balance = GREATEST(0, balance - $1::numeric), updated_at = NOW()
     WHERE customer_id = $2::uuid AND balance >= $1::numeric
     RETURNING balance::text`,
    [amount, params.customerId],
  );
  if (!upd.rows.length) {
    throw new Error('Insufficient wallet balance (race)');
  }
  const balanceAfter = round2(parseFloat(String(upd.rows[0].balance ?? '0')) || 0);

  await client.query(
    `INSERT INTO wallet_transactions
       (wallet_id, transaction_type, amount, balance_after, description, reference_type, reference_id, created_at)
     VALUES ($1, 'debit', $2, $3, $4, $5, $6::uuid, NOW())`,
    [
      walletId,
      amount,
      balanceAfter,
      params.description,
      params.referenceType,
      params.referenceId,
    ],
  );

  await consumePromoCashbackForDebit(client, {
    customerId: params.customerId,
    amount,
    serviceCategory: params.serviceCategory,
    vendorId: params.vendorId,
    categoryId: params.categoryId,
    channel: params.channel,
    ecommerceCategoryId: params.ecommerceCategoryId,
  });

  return { reused: false, debited: amount, balanceAfter };
}

export async function debitScopedWallet(
  params: DebitScopedWalletParams,
): Promise<
  | { ok: true; reused: boolean; debited: number; balanceAfter: number }
  | { ok: false; error: string }
> {
  try {
    const result = await withTransaction((client) =>
      debitScopedWalletInTransaction(client, params),
    );
    return {
      ok: true,
      reused: result.reused,
      debited: result.debited,
      balanceAfter: result.balanceAfter,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Wallet debit failed' };
  }
}
