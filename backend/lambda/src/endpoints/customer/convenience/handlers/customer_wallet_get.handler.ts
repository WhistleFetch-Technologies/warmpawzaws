import type { Context } from 'hono';
import { executecustomerWalletGet } from '../services/customer_wallet_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerWalletGetHandler(c: Context) {
  return executecustomerWalletGet(c);
}
