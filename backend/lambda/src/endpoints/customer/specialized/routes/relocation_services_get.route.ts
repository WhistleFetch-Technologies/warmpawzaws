import type { Hono } from 'hono';
import { relocationServicesGetHandler } from '../handlers/relocation_services_get.handler';

export function registerRelocationServicesGetRoute(app: Hono) {
  app.get("/relocation/services", relocationServicesGetHandler);
}
