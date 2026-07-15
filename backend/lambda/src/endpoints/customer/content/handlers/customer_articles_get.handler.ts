import type { Context } from 'hono';
import { executecustomerArticlesGet } from '../services/customer_articles_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerArticlesGetHandler(c: Context) {
  return executecustomerArticlesGet(c);
}
