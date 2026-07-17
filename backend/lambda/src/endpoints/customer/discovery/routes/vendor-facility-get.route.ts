import type { Hono } from 'hono';
import { vendorFacilityGetHandler } from '../handlers/vendor-facility-get.handler';

export function registerVendorFacilityGetRoute(app: Hono) {
  app.get("/vendor/:vendorId/facility", vendorFacilityGetHandler);
}
