/**
 * Idempotent wallet credit for a PBE cashback entitlement.
 * Evaluation must never call this. Payment flows must not call this in Phase 4 —
 * no authoritative cashback activation policy exists yet.
 */
import type { PoolClient } from 'pg';
import { withTransaction } from '../../database/rds-connection';
import { buildPbeCashbackIdempotencyKey } from './cashback';

export type PbeCashbackCommitInput = {
  customerId: string;
  amount: number;
  promotionId: string;
  referenceType: 'booking' | 'order' | 'pay_bill' | 'appointment';
  referenceId: string;
};

export type PbeCashbackCommitResult = {
  status: 'CASHBACK_WALLET_CREDITED' | 'CASHBACK_DUPLICATE_IGNORED' | 'CASHBACK_WALLET_CREDIT_FAILED';
  credited: boolean;
  alreadyCredited: boolean;
  idempotencyKey: string;
  newBalance?: number;
  error?: string;
};

async function walletTransactionsColumnSet(client: PoolClient): Promise<Set<string>> {
  const r = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'wallet_transactions'`
  );
  return new Set(r.rows.map((x) => x.column_name));
}

/**
 * Credits customer_wallets once per (reference, promotion). Never throws to the caller
 * for duplicate rows — returns DUPLICATE_IGNORED. Does not roll back payments.
 */
export async function commitPbeCashbackWalletCredit(
  input: PbeCashbackCommitInput
): Promise<PbeCashbackCommitResult> {
  const idempotencyKey = buildPbeCashbackIdempotencyKey({
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    promotionId: input.promotionId,
  });
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!input.customerId || !input.referenceId || !input.promotionId || !(amount > 0)) {
    return {
      status: 'CASHBACK_WALLET_CREDIT_FAILED',
      credited: false,
      alreadyCredited: false,
      idempotencyKey,
      error: 'invalid_cashback_commit_input',
    };
  }

  try {
    return await withTransaction(async (client) => {
      const cols = await walletTransactionsColumnSet(client);
      const hasDescription = cols.has('description');
      const existing = hasDescription
        ? await client.query<{ id: string }>(
            `SELECT id::text AS id FROM wallet_transactions
             WHERE description = $1
             LIMIT 1`,
            [idempotencyKey]
          )
        : { rows: [] as Array<{ id: string }> };
      if (existing.rows[0]?.id) {
        console.info('[pbe-cashback]', {
          status: 'CASHBACK_DUPLICATE_IGNORED',
          idempotencyKey,
        });
        return {
          status: 'CASHBACK_DUPLICATE_IGNORED' as const,
          credited: false,
          alreadyCredited: true,
          idempotencyKey,
        };
      }

      await client.query(
        `INSERT INTO customer_wallets (customer_id, balance)
         VALUES ($1::uuid, 0)
         ON CONFLICT (customer_id) DO NOTHING`,
        [input.customerId]
      );
      await client.query(
        `SELECT id FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`,
        [input.customerId]
      );
      const updated = await client.query<{ balance: string }>(
        `UPDATE customer_wallets
         SET balance = COALESCE(balance, 0) + $2
         WHERE customer_id = $1::uuid
         RETURNING balance::text AS balance`,
        [input.customerId, amount]
      );
      const insertCols = ['amount', 'type'];
      const insertVals: unknown[] = [amount, 'cashback'];
      if (cols.has('customer_id')) {
        insertCols.push('customer_id');
        insertVals.push(input.customerId);
      }
      if (cols.has('description')) {
        insertCols.push('description');
        insertVals.push(idempotencyKey);
      }
      if (cols.has('reference_type')) {
        insertCols.push('reference_type');
        insertVals.push(input.referenceType);
      }
      if (cols.has('reference_id')) {
        insertCols.push('reference_id');
        insertVals.push(input.referenceId);
      }
      const ph = insertVals.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO wallet_transactions (${insertCols.join(', ')}) VALUES (${ph})`,
        insertVals
      );
      const newBalance = Number(updated.rows[0]?.balance ?? 0);
      console.info('[pbe-cashback]', {
        status: 'CASHBACK_WALLET_CREDITED',
        idempotencyKey,
      });
      return {
        status: 'CASHBACK_WALLET_CREDITED' as const,
        credited: true,
        alreadyCredited: false,
        idempotencyKey,
        newBalance,
      };
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn('[pbe-cashback]', {
      status: 'CASHBACK_WALLET_CREDIT_FAILED',
      idempotencyKey,
      error,
    });
    return {
      status: 'CASHBACK_WALLET_CREDIT_FAILED',
      credited: false,
      alreadyCredited: false,
      idempotencyKey,
      error,
    };
  }
}
