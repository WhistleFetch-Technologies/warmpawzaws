import type { Hono } from 'hono';
import { registerCustomerWarmpawzPayVendorsGetRoute } from './routes/customer_warmpawz_pay_vendors_get.route';

export function registerCustomerWarmpawzPayEndpoints(app: Hono) {
  registerCustomerWarmpawzPayVendorsGetRoute(app);
}
