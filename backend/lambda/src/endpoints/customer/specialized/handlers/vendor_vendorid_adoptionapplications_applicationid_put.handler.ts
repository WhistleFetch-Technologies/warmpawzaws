import type { Context } from 'hono';
import { executevendorVendoridAdoptionapplicationsApplicationidPut } from '../services/vendor_vendorid_adoptionapplications_applicationid_put.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorVendoridAdoptionapplicationsApplicationidPutHandler(c: Context) {
  return executevendorVendoridAdoptionapplicationsApplicationidPut(c);
}
