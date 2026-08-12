import type { Hono } from 'hono';
import { vendorServicesHandler } from '../handlers/vendor-services.handler';

/** Guest-safe alias — same handler as GET /customer/vendor/:vendorId/services. */
export function registerPublicVendorServicesRoute(app: Hono) {
  app.get('/public/vendor/:vendorId/services', vendorServicesHandler);
}
