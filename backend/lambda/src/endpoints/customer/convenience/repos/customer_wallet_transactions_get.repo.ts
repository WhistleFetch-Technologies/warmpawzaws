import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerWalletTransactionsGet0(transactionQuery, params) {
  return await query(transactionQuery, params);
}

