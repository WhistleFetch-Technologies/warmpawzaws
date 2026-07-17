import type { Hono } from 'hono';
import { clinicVendorServicesHandler } from '../handlers/clinic-vendor-services.handler';

export function registerClinicVendorServicesRoute(app: Hono) {
  app.get("/customer/clinic/:vendorId/services", clinicVendorServicesHandler);
}
