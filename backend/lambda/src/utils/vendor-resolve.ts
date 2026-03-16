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
import { extractProfilePhotoFromApplication, extractPincodeFromPayload } from './extract-profile-photo';

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
    
    // ✅ FIX: Extract profile photo and pincode from application
    const profilePhotoUrl = extractProfilePhotoFromApplication(application, payload);
    const pincodeValue = extractPincodeFromPayload(payload);
    
    // ✅ FIX: Extract service_radius from payload
    let serviceRadius: number | null = null;
    const radiusFields = ['service_radius', 'serviceRadius', 'serviceRadiusKm', 'radius', 'radiusKm', 'service_radius_km'];
    for (const field of radiusFields) {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        const radiusValue = typeof payload[field] === 'string' ? parseFloat(payload[field]) : Number(payload[field]);
        if (!isNaN(radiusValue) && radiusValue > 0) {
          serviceRadius = radiusValue;
          break;
        }
      }
    }

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
      pincode: pincodeValue, // ✅ FIX: Use enhanced pincode extraction
      profile_photo_url: profilePhotoUrl, // ✅ FIX: Save profile photo from onboarding
      service_radius: serviceRadius, // ✅ FIX: Save service_radius from onboarding
      status: 'active',
      is_active: true,
      is_deleted: false, // ✅ CRITICAL FIX: Always set to false for new vendors
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
