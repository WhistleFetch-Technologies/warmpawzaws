/**
 * Resolve request vendorId (may be identity id) to vendor id from vendors table.
 * Used so vendor dashboard and bookings work when app sends identity id.
 */
import { select } from '../database/rds-connection';

export async function resolveVendorId(paramVendorId: string): Promise<string> {
  const existingVendor = await select('vendors', { id: paramVendorId });
  if (existingVendor.length > 0) return paramVendorId;
  const identities = await select('vendor_identity', { id: paramVendorId });
  if (identities.length === 0) return paramVendorId;
  const identity = identities[0];
  if (identity.onboarding_status !== 'APPROVED' && identity.onboarding_status !== 'ACTIVATED') return paramVendorId;
  const vendorByPhone = await select('vendors', { phone: identity.phone });
  if (vendorByPhone.length > 0) {
    console.log(`[VendorResolve] Resolved vendorId ${paramVendorId} to vendor ${vendorByPhone[0].id} (by phone)`);
    return vendorByPhone[0].id;
  }
  return paramVendorId;
}
