import type { Context } from 'hono';
import { executecustomerArticlesSlugGet } from '../services/customer_articles_slug_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerArticlesSlugGetHandler(c: Context) {
  return executecustomerArticlesSlugGet(c);
}
