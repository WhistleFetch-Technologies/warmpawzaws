import type { Hono } from 'hono';
import { customerContentPagesGetHandler } from '../handlers/customer_content_pages_get.handler';

export function registerCustomerContentPagesGetRoute(app: Hono) {
  app.get("/customer/content/pages", customerContentPagesGetHandler);
}
