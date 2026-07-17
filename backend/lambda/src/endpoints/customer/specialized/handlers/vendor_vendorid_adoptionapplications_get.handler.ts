import type { Context } from 'hono';
import { executevendorVendoridAdoptionapplicationsGet } from '../services/vendor_vendorid_adoptionapplications_get.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorVendoridAdoptionapplicationsGetHandler(c: Context) {
  return executevendorVendoridAdoptionapplicationsGet(c);
}
