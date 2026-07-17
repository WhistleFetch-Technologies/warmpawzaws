import type { Context } from 'hono';
import { executemarketingBannersGet } from '../services/marketing_banners_get.service';

/** HTTP adapter — delegates to service layer. */
export async function marketingBannersGetHandler(c: Context) {
  return executemarketingBannersGet(c);
}
