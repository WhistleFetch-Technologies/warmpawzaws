import type { Context } from 'hono';
import { executecustomerContentPagesGet } from '../services/customer_content_pages_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerContentPagesGetHandler(c: Context) {
  return executecustomerContentPagesGet(c);
}
