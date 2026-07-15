import type { Hono } from 'hono';
import { customerOrdersIdReturnPostHandler } from '../handlers/customer_orders_id_return_post.handler';

export function registerCustomerOrdersIdReturnPostRoute(app: Hono) {
  app.post('/customer/orders/:id/return', customerOrdersIdReturnPostHandler);
}
