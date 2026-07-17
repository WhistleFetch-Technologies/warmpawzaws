import type { Hono } from 'hono';
import { marketingArticlesGetHandler } from '../handlers/marketing_articles_get.handler';

export function registerMarketingArticlesGetRoute(app: Hono) {
  app.get("/marketing/articles", marketingArticlesGetHandler);
}
