import type { Hono } from 'hono';
import { customerWarmpawzPayVendorsGetHandler } from '../handlers/customer_warmpawz_pay_vendors_get.handler';

export function registerCustomerWarmpawzPayVendorsGetRoute(app: Hono) {
  app.get('/customer/warmpawz-pay/vendors', customerWarmpawzPayVendorsGetHandler);
}
