import type { Context } from 'hono';
import { executecustomerBannersGet } from './customer_banners_get.service';

/** Alias: /marketing/banners → same handler as /customer/banners */
export async function executemarketingBannersGet(c: Context) {
  return executecustomerBannersGet(c);
}
