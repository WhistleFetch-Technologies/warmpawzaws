import type { Hono } from 'hono';
import { registerEventRoutes } from './routes/events.route';

export function registerEventEndpoints(app: Hono) {
  registerEventRoutes(app);
}
