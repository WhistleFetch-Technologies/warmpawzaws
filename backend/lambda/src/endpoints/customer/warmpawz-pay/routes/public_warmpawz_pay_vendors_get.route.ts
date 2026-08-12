import type { Hono } from 'hono';
import { customerWarmpawzPayVendorsGetHandler } from '../handlers/customer_warmpawz_pay_vendors_get.handler';

/** Guest-safe alias for nearby/list WPay vendors (read-only). */
export function registerPublicWarmpawzPayVendorsGetRoute(app: Hono) {
  app.get('/public/warmpawz-pay/vendors', customerWarmpawzPayVendorsGetHandler);
}
