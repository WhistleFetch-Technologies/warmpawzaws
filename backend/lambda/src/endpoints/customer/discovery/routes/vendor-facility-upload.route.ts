import type { Hono } from 'hono';
import { vendorFacilityUploadHandler } from '../handlers/vendor-facility-upload.handler';

export function registerVendorFacilityUploadRoute(app: Hono) {
  app.post("/vendor/facility/:vendorId/upload-photos", vendorFacilityUploadHandler);
}
