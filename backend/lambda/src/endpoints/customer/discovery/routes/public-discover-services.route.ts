import type { Hono } from 'hono';
import { discoverServicesHandler } from '../handlers/discover-services.handler';

/** Guest-safe alias — same handler as GET /customer/discover-services (JWT not required via /public/). */
export function registerPublicDiscoverServicesRoute(app: Hono) {
  app.get('/public/discover-services', discoverServicesHandler);
}
