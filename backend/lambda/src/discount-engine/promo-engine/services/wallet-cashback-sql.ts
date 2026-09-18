/** Column-aware SQL for live wallets (001: wallet_id only, no currency). */

export function buildCustomerWalletCreateSql(cwCols: Set<string>): {
  sql: string;
  values: unknown[];
} {
  const cols = ['customer_id', 'balance'];
  const values: unknown[] = [null, 0]; // customer_id filled by caller
  if (cwCols.has('currency')) {
    cols.push('currency');
    values.push('INR');
  }
  const ph = cols.map((_, i) => (i === 0 ? '$1::uuid' : `$${i + 1}`)).join(', ');
  return {
    sql: `INSERT INTO customer_wallets (${cols.join(', ')})
          VALUES (${ph})
          ON CONFLICT (customer_id) DO NOTHING`,
    values,
  };
}

export function buildPromoLedgerInsert(opts: {
  wtCols: Set<string>;
  includeCustomerId: boolean;
}): { columns: string[]; placeholders: string[] } {
  const columns: string[] = [];
  if (opts.wtCols.has('wallet_id')) columns.push('wallet_id');
  if (opts.includeCustomerId && opts.wtCols.has('customer_id')) columns.push('customer_id');
  columns.push('transaction_type', 'amount', 'balance_after');
  if (opts.wtCols.has('reference_type')) columns.push('reference_type');
  if (opts.wtCols.has('reference_id')) columns.push('reference_id');
  if (opts.wtCols.has('description')) columns.push('description');
  if (opts.wtCols.has('promotion_id')) columns.push('promotion_id');
  if (opts.wtCols.has('source')) columns.push('source');
  if (opts.wtCols.has('remaining_amount')) columns.push('remaining_amount');
  if (opts.wtCols.has('earned_at')) columns.push('earned_at');
  if (opts.wtCols.has('expires_at')) columns.push('expires_at');
  if (opts.wtCols.has('cashback_status')) columns.push('cashback_status');
  if (opts.wtCols.has('redeem_scope')) columns.push('redeem_scope');
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  return { columns, placeholders };
}

export function promoCreditUsesLiveWalletIdOnly(wtCols: Set<string>): boolean {
  return wtCols.has('wallet_id') && !wtCols.has('customer_id');
}
