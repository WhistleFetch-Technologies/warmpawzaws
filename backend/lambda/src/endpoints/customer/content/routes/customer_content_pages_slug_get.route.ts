import type { Hono } from 'hono';
import { customerContentPagesSlugGetHandler } from '../handlers/customer_content_pages_slug_get.handler';

export function registerCustomerContentPagesSlugGetRoute(app: Hono) {
  app.get("/customer/content/pages/:slug", customerContentPagesSlugGetHandler);
}
