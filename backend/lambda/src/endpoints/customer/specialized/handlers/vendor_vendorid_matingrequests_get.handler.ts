import type { Context } from 'hono';
import { executevendorVendoridMatingrequestsGet } from '../services/vendor_vendorid_matingrequests_get.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorVendoridMatingrequestsGetHandler(c: Context) {
  return executevendorVendoridMatingrequestsGet(c);
}
