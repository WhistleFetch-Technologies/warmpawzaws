import type { Context } from 'hono';
import { executevendorVendoridRelocationquotesGet } from '../services/vendor_vendorid_relocationquotes_get.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorVendoridRelocationquotesGetHandler(c: Context) {
  return executevendorVendoridRelocationquotesGet(c);
}
