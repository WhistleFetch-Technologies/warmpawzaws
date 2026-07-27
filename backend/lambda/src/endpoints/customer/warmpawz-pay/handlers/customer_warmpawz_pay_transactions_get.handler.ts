import type { Context } from 'hono';
import { executeCustomerWarmpawzPayTransactionsGet } from '../services/customer_warmpawz_pay_transactions_get.service';

export async function customerWarmpawzPayTransactionsGetHandler(c: Context) {
  return executeCustomerWarmpawzPayTransactionsGet(c);
}
