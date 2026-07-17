import type { Hono } from 'hono';
import { customerWalletTransactionsGetHandler } from '../handlers/customer_wallet_transactions_get.handler';

export function registerCustomerWalletTransactionsGetRoute(app: Hono) {
  app.get("/customer/wallet/transactions", customerWalletTransactionsGetHandler);
}
