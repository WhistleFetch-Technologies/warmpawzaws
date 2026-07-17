import type { Hono } from 'hono';
import { customerArticlesGetHandler } from '../handlers/customer_articles_get.handler';

export function registerCustomerArticlesGetRoute(app: Hono) {
  app.get("/customer/articles", customerArticlesGetHandler);
}
