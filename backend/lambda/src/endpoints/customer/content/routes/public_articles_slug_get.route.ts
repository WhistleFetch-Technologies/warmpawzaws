import type { Hono } from 'hono';
import { customerArticlesSlugGetHandler } from '../handlers/customer_articles_slug_get.handler';

/** Guest-safe alias — same handler as GET /customer/articles/:slug (JWT not required via /public/). */
export function registerPublicArticlesSlugGetRoute(app: Hono) {
  app.get('/public/articles/:slug', customerArticlesSlugGetHandler);
}
