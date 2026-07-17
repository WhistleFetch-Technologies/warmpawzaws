import type { Hono } from 'hono';
import { vendorServicesHandler } from '../handlers/vendor-services.handler';

export function registerVendorServicesRoute(app: Hono) {
  app.get("/customer/vendor/:vendorId/services", vendorServicesHandler);
}
