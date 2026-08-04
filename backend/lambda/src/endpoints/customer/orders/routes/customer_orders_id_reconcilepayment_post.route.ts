import type { Hono } from 'hono';
import { customerOrdersIdReconcilepaymentPostHandler } from '../handlers/customer_orders_id_reconcilepayment_post.handler';

export function registerCustomerOrdersIdReconcilepaymentPostRoute(app: Hono) {
  app.post('/customer/orders/:id/reconcile-payment', customerOrdersIdReconcilepaymentPostHandler);
}
