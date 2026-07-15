import type { Context } from 'hono';
import { executevendorServices } from '../services/vendor-services.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorServicesHandler(c: Context) {
  return executevendorServices(c);
}
