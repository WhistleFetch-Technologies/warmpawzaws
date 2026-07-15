import type { Hono } from 'hono';
import { customerCustomeridPutHandler } from '../handlers/customer_customerid_put.handler';

export function registerCustomerCustomeridPutRoute(app: Hono) {
  app.put('/customer/:customerId', customerCustomeridPutHandler);
}
