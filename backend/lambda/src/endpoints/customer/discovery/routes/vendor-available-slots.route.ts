import type { Hono } from 'hono';
import { vendorAvailableSlotsHandler } from '../handlers/vendor-available-slots.handler';

export function registerVendorAvailableSlotsRoute(app: Hono) {
  app.get("/customer/vendor/:vendorId/available-slots", vendorAvailableSlotsHandler);
}
