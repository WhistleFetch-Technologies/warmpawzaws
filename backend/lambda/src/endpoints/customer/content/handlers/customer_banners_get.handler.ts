import type { Context } from 'hono';
import { executecustomerBannersGet } from '../services/customer_banners_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerBannersGetHandler(c: Context) {
  return executecustomerBannersGet(c);
}
