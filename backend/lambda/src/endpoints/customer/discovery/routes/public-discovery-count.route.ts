import type { Hono } from 'hono';
import { discoveryCountHandler } from '../handlers/discovery-count.handler';

/** Guest-safe alias — same handler as GET /customer/discovery/count (JWT not required via /public/). */
export function registerPublicDiscoveryCountRoute(app: Hono) {
  app.get('/public/discovery/count', discoveryCountHandler);
}
