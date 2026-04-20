import type { PoolClient } from 'pg';

const BOOKING_PAYMENT_DESC = 'Payment for booking';

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
 * Debit customer wallet for a booking payment inside an existing transaction.
 * Idempotent per (customer_id, booking_id, idempotency_key) when idempotencyKey is set.
 *
 * RDS schemas differ: some `wallet_transactions` rows use `customer_id` (+ optional `booking_id`);
 * others use only `wallet_id` (FK to `customer_wallets`). This path supports both.
 */
export async function debitCustomerWalletForBookingInTransaction(
  client: PoolClient,
  params: {
    customerId: string;
    bookingId: string;
    amount: number;
    idempotencyKey?: string | null;
  }
): Promise<{ debited: number; balanceAfter: number }> {
  const { customerId, bookingId, amount, idempotencyKey } = params;
  if (!customerId || !bookingId || !Number.isFinite(amount) || amount <= 0) {
    return { debited: 0, balanceAfter: 0 };
  }

  const cols = await walletTransactionsColumnSet(client);
  const hasCustomerId = cols.has('customer_id');
  const hasBookingId = cols.has('booking_id');
  const hasWalletId = cols.has('wallet_id');
  const hasReferenceType = cols.has('reference_type');
  const hasReferenceId = cols.has('reference_id');

  if (!hasWalletId && !hasCustomerId) {
    throw new Error('wallet_transactions has neither wallet_id nor customer_id');
  }

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

  const lockRes = await client.query(
    `SELECT id, balance::text FROM customer_wallets WHERE customer_id = $1::uuid FOR UPDATE`,
    [customerId]
  );
  if (lockRes.rows.length === 0) {
    throw new Error('Customer wallet row missing after upsert');
  }
  const walletRow = lockRes.rows[0] as { id: string; balance: string };

  const desc = idempotencyKey
    ? `${BOOKING_PAYMENT_DESC} ${idempotencyKey}`
    : `${BOOKING_PAYMENT_DESC} ${bookingId}`;

  if (idempotencyKey) {
    let existing: { rows: { balance_after?: string }[] };
    if (hasCustomerId && hasBookingId) {
      existing = await client.query(
        `SELECT id, balance_after::text
         FROM wallet_transactions
         WHERE customer_id = $1::uuid
           AND booking_id = $2::uuid
           AND transaction_type = 'debit'
           AND description = $3
         LIMIT 1`,
        [customerId, bookingId, desc]
      );
    } else if (hasWalletId) {
      existing = await client.query(
        `SELECT id, balance_after::text
         FROM wallet_transactions
         WHERE wallet_id = $1::uuid
           AND transaction_type = 'debit'
           AND description = $2
         LIMIT 1`,
        [walletRow.id, desc]
      );
    } else if (hasCustomerId) {
      existing = await client.query(
        `SELECT id, balance_after::text
         FROM wallet_transactions
         WHERE customer_id = $1::uuid
           AND transaction_type = 'debit'
           AND description = $2
         LIMIT 1`,
        [customerId, desc]
      );
    } else {
      existing = { rows: [] };
    }
    if (existing.rows.length > 0) {
      return {
        debited: amount,
        balanceAfter: parseFloat(String(existing.rows[0].balance_after ?? '0')) || 0,
      };
    }
  }

  const balanceBefore = parseFloat(String(walletRow.balance ?? '0')) || 0;

  if (balanceBefore + 1e-9 < amount) {
    throw new Error('Insufficient wallet balance');
  }

  const setBalance = cwHasUpdatedAt
    ? 'SET balance = balance - $1::numeric, updated_at = NOW()'
    : 'SET balance = balance - $1::numeric';
  const upd = await client.query(
    `UPDATE customer_wallets
     ${setBalance}
     WHERE customer_id = $2::uuid AND balance >= $1::numeric
     RETURNING balance::text`,
    [amount, customerId]
  );
  if (upd.rows.length === 0) {
    throw new Error('Insufficient wallet balance (race)');
  }
  const balanceAfter = parseFloat(String(upd.rows[0]?.balance ?? '0')) || 0;

  const insertCols: string[] = [];
  const insertParams: unknown[] = [];

  if (hasWalletId) {
    insertCols.push('wallet_id');
    insertParams.push(walletRow.id);
  }
  if (hasCustomerId) {
    insertCols.push('customer_id');
    insertParams.push(customerId);
  }
  insertCols.push('transaction_type');
  insertParams.push('debit');
  insertCols.push('amount');
  insertParams.push(amount);
  insertCols.push('balance_after');
  insertParams.push(balanceAfter);
  if (hasBookingId) {
    insertCols.push('booking_id');
    insertParams.push(bookingId);
  }
  if (hasReferenceType && hasReferenceId) {
    insertCols.push('reference_type');
    insertParams.push('booking_payment');
    insertCols.push('reference_id');
    insertParams.push(bookingId);
  }
  insertCols.push('description');
  insertParams.push(desc);

  const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
  await client.query(
    `INSERT INTO wallet_transactions (${insertCols.join(', ')}) VALUES (${placeholders})`,
    insertParams as any[]
  );

  // Optional denormalized mirror on `customers` — must not abort the booking txn if column/table drifts.
  await client.query('SAVEPOINT sp_sync_customer_wallet_balance');
  try {
    await client.query(
      `UPDATE customers SET wallet_balance = GREATEST(0, COALESCE(wallet_balance, 0) - $1::numeric) WHERE id = $2::uuid`,
      [amount, customerId]
    );
    await client.query('RELEASE SAVEPOINT sp_sync_customer_wallet_balance');
  } catch {
    await client.query('ROLLBACK TO SAVEPOINT sp_sync_customer_wallet_balance');
  }

  return { debited: amount, balanceAfter };
}
