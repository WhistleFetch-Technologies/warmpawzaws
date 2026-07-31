import type { Hono } from 'hono';
import { customerWarmpawzPayVendorsNearbyGetHandler } from '../handlers/customer_warmpawz_pay_vendors_nearby_get.handler';

export function registerCustomerWarmpawzPayVendorsNearbyGetRoute(app: Hono) {
  app.get('/customer/warmpawz-pay/vendors/nearby', customerWarmpawzPayVendorsNearbyGetHandler);
}
