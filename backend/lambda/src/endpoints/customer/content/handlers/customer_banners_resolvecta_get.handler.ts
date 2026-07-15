import type { Context } from 'hono';
import { executecustomerBannersResolvectaGet } from '../services/customer_banners_resolvecta_get.service';

/** HTTP adapter — delegates to service layer. */
export async function customerBannersResolvectaGetHandler(c: Context) {
  return executecustomerBannersResolvectaGet(c);
}
