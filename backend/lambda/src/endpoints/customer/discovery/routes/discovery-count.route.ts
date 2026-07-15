import type { Hono } from 'hono';
import { discoveryCountHandler } from '../handlers/discovery-count.handler';

export function registerDiscoveryCountRoute(app: Hono) {
  app.get('/customer/discovery/count', discoveryCountHandler);
}
