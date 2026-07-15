import type { Hono } from 'hono';
import { servicesByStyleHandler } from '../handlers/services-by-style.handler';

export function registerServicesByStyleRoute(app: Hono) {
  app.get("/customer/services/by-style", servicesByStyleHandler);
}
