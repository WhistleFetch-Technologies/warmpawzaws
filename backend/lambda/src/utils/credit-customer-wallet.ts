import type { PoolClient } from 'pg';
import { withTransaction } from '../database/rds-connection';

async function walletTransactionsColumnSet(client: PoolClient): Promise<Set<string>> {
  const r = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'wallet_transactions'`
  );
  return new Set(r.rows.map((x) => x.column_name));
}

async function customerWalletsColumnSet(client: PoolClient): Promise<Set<string>> {
  const r = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'customer_wallets'`
  );
  return new Set(r.rows.map((x) => x.column_name));
}

/**
 * Credits the canonical customer wallet (`customer_wallets`) and appends a ledger row
 * (`wallet_transactions`). Bumps `customers.wallet_balance` for legacy readers.
 *
 * - Runs in a single DB transaction with row-level lock on the wallet.
 * - Idempotent: if a `booking_refund` credit already exists for this booking, returns current balance (no double credit).
 *
 * Supports both `wallet_transactions` shapes: `wallet_id`-only (legacy) and `customer_id` (+ optional `booking_id`).
 */
export async function creditCustomerWalletForBookingRefund(params: {
  customerId: string;
  bookingId: string;
  refundAmount: number;
  refundPercentage: number;
  /** e.g. "booking" vs "appointment" — only affects description text */
  label?: 'booking' | 'appointment';
}): Promise<{ newBalance: number; alreadyCredited?: boolean }> {
  const { customerId, bookingId, refundAmount, refundPercentage } = params;
  const label = params.label ?? 'booking';
  if (!customerId || !bookingId || !Number.isFinite(refundAmount) || refundAmount <= 0) {
    throw new Error('creditCustomerWalletForBookingRefund: invalid parameters');
  }

  const description =
    label === 'appointment'
      ? `Refund for cancelled appointment (${refundPercentage}%)`
      : `Refund for cancelled booking (${refundPercentage}%)`;

  return withTransaction(async (client) => {
    const cols = await walletTransactionsColumnSet(client);
    const hasCustomerId = cols.has('customer_id');
    const hasBookingId = cols.has('booking_id');
    const hasWalletId = cols.has('wallet_id');
    const hasReferenceType = cols.has('reference_type');
    const hasReferenceId = cols.has('reference_id');

    const cwCols = await customerWalletsColumnSet(client);
    const cwHasCurrency = cwCols.has('currency');
    const cwHasUpdatedAt = cwCols.has('updated_at');

    const upsertCols = ['customer_id', 'balance'];
    const upsertVals: unknown[] = [customerId, 0];
    if (cwHasCurrency) {
      upsertCols.push('currency');
      upsertVals.push('INR');
    }
    const upsertPh = upsertVals.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO customer_wallets (${upsertCols.join(', ')})
       VALUES (${upsertPh})
       ON CONFLICT (customer_id) DO NOTHING`,
      upsertVals as any[]
    );

    await client.query(`SELECT id FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`, [customerId]);

    const walletRowQ = await client.query<{ id: string }>(
      `SELECT id::text AS id FROM customer_wallets WHERE customer_id = $1::uuid LIMIT 1`,
      [customerId]
    );
    const walletId = walletRowQ.rows[0]?.id;
    if (!walletId) throw new Error(`customer_wallets row not found for customer ${customerId}`);

    let dup: { rows: unknown[] };
    if (hasCustomerId && hasBookingId) {
      dup = await client.query(
        `SELECT id, balance_after::text
         FROM wallet_transactions
         WHERE customer_id = $1::uuid
           AND booking_id = $2::uuid
           AND transaction_type = 'credit'
           AND COALESCE(reference_type, '') = 'booking_refund'
         LIMIT 1`,
        [customerId, bookingId]
      );
    } else if (hasWalletId) {
      const refClause = hasReferenceType
        ? `AND COALESCE(reference_type, '') = 'booking_refund'`
        : '';
      dup = await client.query(
        `SELECT id, balance_after::text
         FROM wallet_transactions
         WHERE wallet_id = $1::uuid
           AND transaction_type = 'credit'
           ${refClause}
           AND description = $2
         LIMIT 1`,
        [walletId, description]
      );
    } else if (hasCustomerId) {
      dup = await client.query(
        `SELECT id, balance_after::text
         FROM wallet_transactions
         WHERE customer_id = $1::uuid
           AND transaction_type = 'credit'
           AND COALESCE(reference_type, '') = 'booking_refund'
           AND description = $2
         LIMIT 1`,
        [customerId, description]
      );
    } else {
      dup = { rows: [] };
    }

    if (dup.rows.length > 0) {
      const bal = await client.query(`SELECT balance::text FROM customer_wallets WHERE customer_id = $1::uuid`, [
        customerId,
      ]);
      const newBalance = parseFloat(String(bal.rows?.[0]?.balance ?? '0')) || 0;
      console.info('[wallet-refund] idempotent skip — already credited', { customerId, bookingId });
      return { newBalance, alreadyCredited: true };
    }

    const setBal = cwHasUpdatedAt
      ? 'SET balance = balance + $1::numeric, updated_at = NOW()'
      : 'SET balance = balance + $1::numeric';
    const upsert = await client.query(
      `UPDATE customer_wallets
       ${setBal}
       WHERE customer_id = $2::uuid
       RETURNING balance::text`,
      [refundAmount, customerId]
    );

    const balanceAfter = parseFloat(String(upsert.rows?.[0]?.balance ?? '0')) || 0;

    const insertCols: string[] = [];
    const insertParams: unknown[] = [];

    if (hasWalletId) {
      insertCols.push('wallet_id');
      insertParams.push(walletId);
    }
    if (hasCustomerId) {
      insertCols.push('customer_id');
      insertParams.push(customerId);
    }
    insertCols.push('transaction_type');
    insertParams.push('credit');
    insertCols.push('amount');
    insertParams.push(refundAmount);
    insertCols.push('balance_after');
    insertParams.push(balanceAfter);
    if (hasBookingId) {
      insertCols.push('booking_id');
      insertParams.push(bookingId);
    }
    if (hasReferenceType && hasReferenceId) {
      insertCols.push('reference_type');
      insertParams.push('booking_refund');
      insertCols.push('reference_id');
      insertParams.push(bookingId);
    } else if (hasReferenceType) {
      insertCols.push('reference_type');
      insertParams.push('booking_refund');
    }
    insertCols.push('description');
    insertParams.push(description);

    const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO wallet_transactions (${insertCols.join(', ')}) VALUES (${placeholders})`,
      insertParams as any[]
    );

    await client.query('SAVEPOINT sp_sync_customer_wallet_balance');
    try {
      await client.query(
        `UPDATE customers SET wallet_balance = COALESCE(wallet_balance, 0) + $1::numeric WHERE id = $2::uuid`,
        [refundAmount, customerId]
      );
      await client.query('RELEASE SAVEPOINT sp_sync_customer_wallet_balance');
    } catch {
      await client.query('ROLLBACK TO SAVEPOINT sp_sync_customer_wallet_balance');
    }

    console.info('[wallet-refund] credited', {
      customerId,
      bookingId,
      refundAmount,
      refundPercentage,
      newBalance: balanceAfter,
    });

    return { newBalance: balanceAfter };
  });
}
