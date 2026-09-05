import type { Hono } from 'hono';
import { customerWarmpawzPayReconcilePostHandler } from '../handlers/customer_warmpawz_pay_reconcile_post.handler';

export function registerCustomerWarmpawzPayReconcilePostRoute(app: Hono): void {
  app.post('/customer/warmpawz-pay/reconcile', customerWarmpawzPayReconcilePostHandler);
}
