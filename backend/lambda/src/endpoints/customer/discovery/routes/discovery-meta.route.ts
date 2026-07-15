import type { Hono } from 'hono';
import { discoveryMetaHandler } from '../handlers/discovery-meta.handler';

export function registerDiscoveryMetaRoute(app: Hono) {
  app.get('/customer/discovery/meta', discoveryMetaHandler);
}
