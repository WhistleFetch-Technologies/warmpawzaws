import type { Context } from 'hono';
import { executemarketingArticlesGet } from '../services/marketing_articles_get.service';

/** HTTP adapter — delegates to service layer. */
export async function marketingArticlesGetHandler(c: Context) {
  return executemarketingArticlesGet(c);
}
