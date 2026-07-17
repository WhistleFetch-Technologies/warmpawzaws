import type { Context } from 'hono';
import { executecustomerFeaturedvendorsGet } from '../services/customer_featuredvendors_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerFeaturedvendorsGetHandler(c: Context) {
  return executecustomerFeaturedvendorsGet(c);
}
