import type { Hono } from 'hono';
import { customerCustomeridGetHandler } from '../handlers/customer_customerid_get.handler';

export function registerCustomerCustomeridGetRoute(app: Hono) {
  app.get('/customer/:customerId', customerCustomeridGetHandler);
}
