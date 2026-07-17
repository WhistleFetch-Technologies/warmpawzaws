import type { Hono } from 'hono';
import { discoverServicesHandler } from '../handlers/discover-services.handler';

export function registerDiscoverServicesRoute(app: Hono) {
  app.get("/customer/discover-services", discoverServicesHandler);
}
