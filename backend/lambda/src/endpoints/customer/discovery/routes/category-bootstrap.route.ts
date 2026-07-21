import type { Hono } from 'hono';
import { categoryBootstrapHandler } from '../handlers/category-bootstrap.handler';

export function registerCategoryBootstrapRoute(app: Hono) {
  app.get('/customer/discovery/category-bootstrap', categoryBootstrapHandler);
}
