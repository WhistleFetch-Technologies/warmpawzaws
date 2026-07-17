import type { Hono } from 'hono';
import { customerByphoneGetHandler } from '../handlers/customer_byphone_get.handler';

export function registerCustomerByphoneGetRoute(app: Hono) {
  app.get('/customer/by-phone', customerByphoneGetHandler);
}
