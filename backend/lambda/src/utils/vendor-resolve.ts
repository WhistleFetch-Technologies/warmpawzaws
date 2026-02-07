/**
 * Resolve request vendorId (may be identity id) to vendor id from vendors table.
 * Used so vendor dashboard and bookings work when app sends identity id.
 *
 * DYNAMIC FIX: When param is an APPROVED/ACTIVATED vendor_identity id and no
 * vendors row exists (new vendor), we auto-create the vendors row so dashboard,
 * services, availability, earnings, etc. all work without "Vendor not found".
 * Idempotent: safe to call on every request; creates at most once per identity.
 */
import { select, insert } from '../database/rds-connection';

export async function resolveVendorId(paramVendorId: string): Promise<string> {
  const trimmed = (paramVendorId || '').trim();
  if (!trimmed) return paramVendorId;

  const existingVendor = await select('vendors', { id: trimmed });
  if (existingVendor.length > 0) return trimmed;

  const identities = await select('vendor_identity', { id: trimmed });
  if (identities.length === 0) return trimmed;

  const identity = identities[0];
  if (identity.onboarding_status !== 'APPROVED' && identity.onboarding_status !== 'ACTIVATED') return trimmed;

  const vendorByPhone = await select('vendors', { phone: identity.phone });
  if (vendorByPhone.length > 0) {
    console.log(`[VendorResolve] Resolved vendorId ${trimmed} to vendor ${vendorByPhone[0].id} (by phone)`);
    return vendorByPhone[0].id;
  }

  // New vendor: identity approved but no vendors row — create one so all APIs work.
  try {
    const applications = await select('vendor_onboarding_applications', { vendor_identity_id: identity.id });
    const application = applications.length > 0 ? applications[0] : null;
    const payload = (application as any)?.application_payload || {};

    const newVendor = await insert('vendors', {
      id: identity.id,
      phone: identity.phone,
      email: payload.email || payload.businessEmail || `vendor-${identity.phone}@warmpawz.app`,
      business_name: payload.businessName || payload.business_name || `Vendor ${identity.phone}`,
      owner_name: payload.contactPersonName || payload.ownerName || 'Vendor Owner',
      role_id: identity.selected_role_id,
      vendor_type: (identity as any).vendor_type || payload.vendorType || payload.vendor_type || 'business',
      category: 'general',
      address: payload.address || 'Not specified',
      city: payload.city || 'Not specified',
      state: payload.state || 'Not specified',
      pincode: payload.pin || payload.pincode || '',
      status: 'active',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (newVendor?.length > 0) {
      console.log(`[VendorResolve] Auto-created vendors row for identity ${identity.id} (new vendor)`);
      return identity.id;
    }
  } catch (err: any) {
    if (err?.message?.includes('duplicate key') || err?.code === '23505') {
      return identity.id;
    }
    console.warn('[VendorResolve] Auto-create vendor failed:', err?.message);
  }
  return trimmed;
}
