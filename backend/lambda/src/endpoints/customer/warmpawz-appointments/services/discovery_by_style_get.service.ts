import type { Context } from 'hono';
import { executeservicesByStyle } from '../../discovery/services/services-by-style.service';

/** Alias of GET /customer/services/by-style when WARMPAWZ_APPOINTMENTS_ENABLED. */
export async function executeDiscoveryByStyleGet(c: Context) {
  return executeservicesByStyle(c);
}
