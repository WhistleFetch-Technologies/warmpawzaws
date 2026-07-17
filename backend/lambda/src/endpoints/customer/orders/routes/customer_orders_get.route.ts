import type { Hono } from 'hono';
import { customerOrdersGetHandler } from '../handlers/customer_orders_get.handler';

export function registerCustomerOrdersGetRoute(app: Hono) {
  app.get('/customer/orders', customerOrdersGetHandler);
}
