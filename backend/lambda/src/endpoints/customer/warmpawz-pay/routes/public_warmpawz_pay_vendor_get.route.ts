import type { Hono } from 'hono';
import { customerWarmpawzPayVendorGetHandler } from '../handlers/customer_warmpawz_pay_vendor_get.handler';

/** Guest-safe alias for GET /customer/warmpawz-pay/vendors/:vendorId. */
export function registerPublicWarmpawzPayVendorGetRoute(app: Hono) {
  app.get('/public/warmpawz-pay/vendors/:vendorId', customerWarmpawzPayVendorGetHandler);
}
