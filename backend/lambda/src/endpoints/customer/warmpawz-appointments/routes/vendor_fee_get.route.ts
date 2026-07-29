import type { Hono } from 'hono';
import { vendorFeeGetHandler } from '../handlers/vendor_fee_get.handler';

export function registerVendorFeeGetRoute(app: Hono) {
  app.get('/customer/warmpawz-appointments/vendors/:vendorId/fee', vendorFeeGetHandler);
}
