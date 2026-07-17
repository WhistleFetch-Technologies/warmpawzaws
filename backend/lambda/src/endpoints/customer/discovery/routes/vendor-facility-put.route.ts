import type { Hono } from 'hono';
import { vendorFacilityPutHandler } from '../handlers/vendor-facility-put.handler';

export function registerVendorFacilityPutRoute(app: Hono) {
  app.put("/vendor/facility/:vendorId", vendorFacilityPutHandler);
}
