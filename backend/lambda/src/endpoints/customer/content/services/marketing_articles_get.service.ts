import type { Context } from 'hono';
import { executecustomerArticlesGet } from './customer_articles_get.service';

/** Alias: /marketing/articles → same handler as /customer/articles */
export async function executemarketingArticlesGet(c: Context) {
  return executecustomerArticlesGet(c);
}
