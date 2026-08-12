import type { Hono } from 'hono';
import { vendorAvailableSlotsHandler } from '../handlers/vendor-available-slots.handler';

/** Guest-safe alias — same handler as GET /customer/vendor/:vendorId/available-slots. */
export function registerPublicVendorAvailableSlotsRoute(app: Hono) {
  app.get('/public/vendor/:vendorId/available-slots', vendorAvailableSlotsHandler);
}
