import type { Hono } from 'hono';
import { registerDiscoveryByStyleGetRoute } from './routes/discovery_by_style_get.route';
import { registerVendorFeeGetRoute } from './routes/vendor_fee_get.route';

export function registerCustomerWarmpawzAppointmentsEndpoints(app: Hono) {
  registerDiscoveryByStyleGetRoute(app);
  registerVendorFeeGetRoute(app);
}
