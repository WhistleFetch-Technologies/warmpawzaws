import type { Hono } from 'hono';
import { customerWarmpawzPayVendorGetHandler } from '../handlers/customer_warmpawz_pay_vendor_get.handler';

export function registerCustomerWarmpawzPayVendorGetRoute(app: Hono) {
  app.get('/customer/warmpawz-pay/vendors/:vendorId', customerWarmpawzPayVendorGetHandler);
}
