import type { Hono } from 'hono';
import { publicVendorProfileHandler } from '../handlers/public-vendor-profile.handler';

export function registerPublicVendorProfileRoute(app: Hono) {
  app.get('/public/vendor/:vendorId/profile', publicVendorProfileHandler);
}
