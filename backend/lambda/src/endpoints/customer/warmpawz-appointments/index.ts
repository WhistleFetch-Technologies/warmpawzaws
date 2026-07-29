import type { Hono } from 'hono';
import { registerDiscoveryByCategoryGetRoute } from './routes/discovery_by_category_get.route';
import { registerVendorFeeGetRoute } from './routes/vendor_fee_get.route';

export function registerCustomerWarmpawzAppointmentsEndpoints(app: Hono) {
  registerDiscoveryByCategoryGetRoute(app);
  registerVendorFeeGetRoute(app);
}
