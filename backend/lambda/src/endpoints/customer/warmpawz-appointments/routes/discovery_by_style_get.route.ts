import type { Hono } from 'hono';
import { discoveryByStyleGetHandler } from '../handlers/discovery_by_style_get.handler';

export function registerDiscoveryByStyleGetRoute(app: Hono) {
  app.get(
    '/customer/warmpawz-appointments/discovery/by-style',
    discoveryByStyleGetHandler
  );
}
