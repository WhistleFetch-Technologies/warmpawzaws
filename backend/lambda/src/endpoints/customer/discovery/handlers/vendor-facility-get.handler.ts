import type { Context } from 'hono';
import { executevendorFacilityGet } from '../services/vendor-facility-get.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorFacilityGetHandler(c: Context) {
  return executevendorFacilityGet(c);
}
