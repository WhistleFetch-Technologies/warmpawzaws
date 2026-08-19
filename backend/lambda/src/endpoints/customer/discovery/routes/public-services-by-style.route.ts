import type { Hono } from 'hono';
import { servicesByStyleHandler } from '../handlers/services-by-style.handler';

/** Guest-safe alias — same handler as GET /customer/services/by-style (JWT not required via /public/). */
export function registerPublicServicesByStyleRoute(app: Hono) {
  app.get('/public/services/by-style', servicesByStyleHandler);
}
