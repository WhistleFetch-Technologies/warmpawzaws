import type { Hono } from 'hono';
import { customerArticlesSlugGetHandler } from '../handlers/customer_articles_slug_get.handler';

export function registerCustomerArticlesSlugGetRoute(app: Hono) {
  app.get('/customer/articles/:slug', customerArticlesSlugGetHandler);
}
