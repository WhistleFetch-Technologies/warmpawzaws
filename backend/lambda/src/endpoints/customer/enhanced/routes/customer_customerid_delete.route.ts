import type { Hono } from 'hono';
import { customerCustomeridDeleteHandler } from '../handlers/customer_customerid_delete.handler';

export function registerCustomerCustomeridDeleteRoute(app: Hono) {
  app.delete('/customer/:customerId', customerCustomeridDeleteHandler);
}
