import type { Hono } from 'hono';
import { registerCustomerWarmpawzPayVendorsGetRoute } from './routes/customer_warmpawz_pay_vendors_get.route';
import { registerCustomerWarmpawzPayVendorGetRoute } from './routes/customer_warmpawz_pay_vendor_get.route';

export function registerCustomerWarmpawzPayEndpoints(app: Hono) {
  registerCustomerWarmpawzPayVendorsGetRoute(app);
  registerCustomerWarmpawzPayVendorGetRoute(app);
}
