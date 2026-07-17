import type { Hono } from 'hono';
import { customerOrdersIdGetHandler } from '../handlers/customer_orders_id_get.handler';

export function registerCustomerOrdersIdGetRoute(app: Hono) {
  app.get('/customer/orders/:id', customerOrdersIdGetHandler);
}
