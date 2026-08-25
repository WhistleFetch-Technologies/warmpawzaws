import type { Hono } from 'hono';
import { customerArticlesGetHandler } from '../handlers/customer_articles_get.handler';

/** Guest-safe alias — same handler as GET /customer/articles (JWT not required via /public/). */
export function registerPublicArticlesGetRoute(app: Hono) {
  app.get('/public/articles', customerArticlesGetHandler);
}
