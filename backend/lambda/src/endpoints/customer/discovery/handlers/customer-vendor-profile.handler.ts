import type { Context } from 'hono';
import { executecustomerVendorProfile } from '../services/customer-vendor-profile.service';

/** HTTP adapter — delegates to service layer. */
export async function customerVendorProfileHandler(c: Context) {
  return executecustomerVendorProfile(c);
}
