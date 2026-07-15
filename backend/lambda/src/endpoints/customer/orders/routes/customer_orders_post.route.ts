import type { Hono } from 'hono';
import { customerOrdersPostHandler } from '../handlers/customer_orders_post.handler';

export function registerCustomerOrdersPostRoute(app: Hono) {
  app.post('/customer/orders', customerOrdersPostHandler);
}
