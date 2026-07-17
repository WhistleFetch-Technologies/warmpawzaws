import { query } from '../../../../database/rds-connection';

export async function dbCustomerWalletTransactionsGet0(transactionQuery: string, params: unknown[]) {
  return await query(transactionQuery, params);
}

/** Resolve wallet_transactions query for schemas with customer_id and/or wallet_id. */
export async function buildWalletTransactionsQuery(
  customerId: string,
  type: string | undefined,
  limit: number,
  offset: number
): Promise<{ sql: string; params: unknown[] }> {
  const tableCheck = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'wallet_transactions'
     AND column_name IN ('customer_id', 'wallet_id')`
  );

  const cols = tableCheck.rows.map((r: { column_name: string }) => r.column_name);
  const hasCustCol = cols.includes('customer_id');
  const hasWalletCol = cols.includes('wallet_id');

  const params: unknown[] = [customerId];
  let paramIndex = 2;
  let typeClause = '';

  if (type && type !== 'all') {
    typeClause = ` AND transaction_type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }

  const limitOffset = ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  if (hasCustCol && hasWalletCol) {
    return {
      sql: `SELECT * FROM wallet_transactions wt
            WHERE wt.customer_id = $1::uuid
               OR wt.wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = $1::uuid)${typeClause}${limitOffset}`,
      params,
    };
  }

  if (hasCustCol) {
    return {
      sql: `SELECT * FROM wallet_transactions WHERE customer_id = $1${typeClause}${limitOffset}`,
      params,
    };
  }

  if (hasWalletCol) {
    return {
      sql: `SELECT * FROM wallet_transactions
            WHERE wallet_id IN (SELECT id FROM customer_wallets WHERE customer_id = $1::uuid)${typeClause}${limitOffset}`,
      params,
    };
  }

  return {
    sql: `SELECT * FROM wallet_transactions WHERE customer_id = $1${typeClause}${limitOffset}`,
    params,
  };
}
