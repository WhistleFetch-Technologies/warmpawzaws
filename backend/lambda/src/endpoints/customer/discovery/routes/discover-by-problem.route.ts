import type { Hono } from 'hono';
import { discoverByProblemHandler } from '../handlers/discover-by-problem.handler';

export function registerDiscoverByProblemRoute(app: Hono) {
  app.get("/customer/vendors/discover-by-problem", discoverByProblemHandler);
}
