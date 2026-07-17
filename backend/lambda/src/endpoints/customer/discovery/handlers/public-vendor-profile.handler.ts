import type { Context } from 'hono';
import { executepublicVendorProfile } from '../services/public-vendor-profile.service';

/** HTTP adapter — delegates to service layer. */
export async function publicVendorProfileHandler(c: Context) {
  return executepublicVendorProfile(c);
}
