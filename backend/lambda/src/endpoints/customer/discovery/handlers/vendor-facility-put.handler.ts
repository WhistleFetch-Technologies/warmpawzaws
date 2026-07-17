import type { Context } from 'hono';
import { executevendorFacilityPut } from '../services/vendor-facility-put.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorFacilityPutHandler(c: Context) {
  return executevendorFacilityPut(c);
}
