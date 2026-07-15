import type { Context } from 'hono';
import { executevendorVendoridHolidaycustomrequestsGet } from '../services/vendor_vendorid_holidaycustomrequests_get.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorVendoridHolidaycustomrequestsGetHandler(c: Context) {
  return executevendorVendoridHolidaycustomrequestsGet(c);
}
