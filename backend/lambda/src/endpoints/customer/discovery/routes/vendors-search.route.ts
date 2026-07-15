import type { Hono } from 'hono';
import { vendorsSearchHandler } from '../handlers/vendors-search.handler';

export function registerVendorsSearchRoute(app: Hono) {
  app.get("/customer/vendors/search", vendorsSearchHandler);
}
