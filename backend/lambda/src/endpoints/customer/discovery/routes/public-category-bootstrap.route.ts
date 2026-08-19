import type { Hono } from 'hono';
import { categoryBootstrapHandler } from '../handlers/category-bootstrap.handler';

/** Guest-safe alias — same handler as GET /customer/discovery/category-bootstrap (JWT not required via /public/). */
export function registerPublicCategoryBootstrapRoute(app: Hono) {
  app.get('/public/discovery/category-bootstrap', categoryBootstrapHandler);
}
