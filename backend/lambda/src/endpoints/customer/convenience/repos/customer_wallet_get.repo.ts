import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerWalletGet0(customerId) {
  return await query(
          `SELECT * FROM customer_wallets WHERE customer_id = $1 LIMIT 1`,
          [customerId]
        );
}

export async function dbCustomerWalletGet1(customerId) {
  return await query(
              `INSERT INTO customer_wallets (customer_id, balance, currency)
               VALUES ($1, 0, 'INR')
               ON CONFLICT (customer_id) DO NOTHING`,
              [customerId]
            );
}

export async function dbCustomerWalletGet2(customerId) {
  return await query(
            `SELECT * FROM customer_wallets WHERE customer_id = $1 LIMIT 1`,
            [customerId]
          );
}

