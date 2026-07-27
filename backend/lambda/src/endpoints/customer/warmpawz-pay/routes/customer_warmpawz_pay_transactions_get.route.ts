import type { Hono } from 'hono';
import { customerWarmpawzPayTransactionsGetHandler } from '../handlers/customer_warmpawz_pay_transactions_get.handler';

export function registerCustomerWarmpawzPayTransactionsGetRoute(app: Hono): void {
  app.get('/customer/warmpawz-pay/transactions', customerWarmpawzPayTransactionsGetHandler);
}
