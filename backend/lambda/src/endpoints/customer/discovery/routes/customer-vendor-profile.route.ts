import type { Hono } from 'hono';
import { customerVendorProfileHandler } from '../handlers/customer-vendor-profile.handler';

export function registerCustomerVendorProfileRoute(app: Hono) {
  app.get("/customer/vendor/:vendorId", customerVendorProfileHandler);
}
