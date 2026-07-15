import type { Context } from 'hono';
import { executeclinicVendorServices } from '../services/clinic-vendor-services.service';

/** HTTP adapter — delegates to service layer. */
export async function clinicVendorServicesHandler(c: Context) {
  return executeclinicVendorServices(c);
}
