import type { Context } from 'hono';
import { executecustomerWalletTransactionsGet } from '../services/customer_wallet_transactions_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerWalletTransactionsGetHandler(c: Context) {
  return executecustomerWalletTransactionsGet(c);
}
