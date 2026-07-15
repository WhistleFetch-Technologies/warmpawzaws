import type { Context } from 'hono';
import { executecustomerContentPagesSlugGet } from '../services/customer_content_pages_slug_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerContentPagesSlugGetHandler(c: Context) {
  return executecustomerContentPagesSlugGet(c);
}
