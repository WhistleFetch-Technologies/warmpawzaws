import type { Hono } from 'hono';
import { vendorsListHandler } from '../handlers/vendors-list.handler';

export function registerVendorsListRoute(app: Hono) {
  app.get("/vendors", vendorsListHandler);
}
