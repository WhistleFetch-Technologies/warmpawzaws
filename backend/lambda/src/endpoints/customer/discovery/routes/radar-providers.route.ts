import type { Hono } from 'hono';
import { radarProvidersHandler } from '../handlers/radar-providers.handler';

export function registerRadarProvidersRoute(app: Hono) {
  app.get("/customer/radar/providers", radarProvidersHandler);
}
