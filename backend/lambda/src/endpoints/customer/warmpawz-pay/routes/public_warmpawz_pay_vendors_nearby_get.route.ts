import type { Hono } from 'hono';
import { customerWarmpawzPayVendorsNearbyGetHandler } from '../handlers/customer_warmpawz_pay_vendors_nearby_get.handler';

/** Guest-safe alias for GET /customer/warmpawz-pay/vendors/nearby. */
export function registerPublicWarmpawzPayVendorsNearbyGetRoute(app: Hono) {
  app.get('/public/warmpawz-pay/vendors/nearby', customerWarmpawzPayVendorsNearbyGetHandler);
}
