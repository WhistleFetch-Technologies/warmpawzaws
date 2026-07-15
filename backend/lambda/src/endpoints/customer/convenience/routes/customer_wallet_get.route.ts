import type { Hono } from 'hono';
import { customerWalletGetHandler } from '../handlers/customer_wallet_get.handler';

export function registerCustomerWalletGetRoute(app: Hono) {
  app.get("/customer/wallet", customerWalletGetHandler);
}
