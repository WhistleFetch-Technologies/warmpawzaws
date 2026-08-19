import type { Hono } from 'hono';
import { discoveryByStyleGetHandler } from '../handlers/discovery_by_style_get.handler';

export function registerDiscoveryByStyleGetRoute(app: Hono) {
  app.get(
    '/customer/warmpawz-appointments/discovery/by-style',
    discoveryByStyleGetHandler
  );
  /** Guest-safe alias — same handler (JWT not required via /public/). */
  app.get(
    '/public/warmpawz-appointments/discovery/by-style',
    discoveryByStyleGetHandler
  );
}
