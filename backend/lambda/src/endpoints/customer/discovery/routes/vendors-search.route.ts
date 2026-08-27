import type { Hono } from 'hono';
import { vendorsSearchHandler } from '../handlers/vendors-search.handler';

export function registerVendorsSearchRoute(app: Hono) {
  app.get("/customer/vendors/search", vendorsSearchHandler);
  /** Guest-safe alias — same handler (JWT not required via /public/). */
  app.get("/public/vendors/search", vendorsSearchHandler);
}
