import type { Context } from 'hono';
import { executecustomerFeaturedpackagesGet } from '../services/customer_featuredpackages_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerFeaturedpackagesGetHandler(c: Context) {
  return executecustomerFeaturedpackagesGet(c);
}
