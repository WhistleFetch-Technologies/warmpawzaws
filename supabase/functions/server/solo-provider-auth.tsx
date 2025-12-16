import { normalizePhone, phonesMatch } from "./phone-utils.tsx";

/**
 * SOLO PROVIDER AUTHENTICATION HELPERS
 * 
 * Smart login routing for solo providers:
 * - Same phone number for vendor, center, and staff
 * - Returns unified session with all IDs
 * - Determines default dashboard mode
 */

/**
 * Check if a phone belongs to a solo provider
 */
export async function isSoloProvider(phone: string, kv: any): Promise<boolean> {
  try {
    const cleanPhone = normalizePhone(phone);
    const phoneIndex = await kv.get(`vendor:phone:${cleanPhone}`);
    return phoneIndex?.isSoloProvider === true;
  } catch (error) {
    console.error('Error checking solo provider:', error);
    return false;
  }
}

/**
 * Get solo provider session data
 * Returns: { vendorId, centerId, staffId, vendor, center, staff, isSoloProvider: true }
 */
export async function getSoloProviderSession(phone: string, kv: any) {
  try {
    const cleanPhone = normalizePhone(phone);
    
    console.log(`🔍 [SOLO AUTH] Fetching solo provider data for: ${cleanPhone}`);
    
    // Get phone index
    const phoneIndex = await kv.get(`vendor:phone:${cleanPhone}`);
    
    if (!phoneIndex) {
      console.log(`❌ [SOLO AUTH] No phone index found`);
      return null;
    }
    
    if (!phoneIndex.isSoloProvider) {
      console.log(`❌ [SOLO AUTH] Phone exists but not a solo provider`);
      return null;
    }
    
    const { vendorId, centerId, staffId } = phoneIndex;
    
    console.log(`✅ [SOLO AUTH] Found solo provider:`, { vendorId, centerId, staffId });
    
    // Fetch all entities
    const vendor = await kv.get(`vendor:${vendorId}`);
    const center = await kv.get(`center:${centerId}`);
    const staff = await kv.get(`staff:${staffId}`);
    
    if (!vendor) {
      console.error(`❌ [SOLO AUTH] Vendor not found: ${vendorId}`);
      return null;
    }
    
    console.log(`✅ [SOLO AUTH] Loaded all entities`);
    console.log(`   Vendor status: ${vendor.status}`);
    console.log(`   Center status: ${center?.status}`);
    console.log(`   Staff status: ${staff?.status}`);
    
    return {
      vendorId,
      centerId,
      staffId,
      vendor,
      center,
      staff,
      isSoloProvider: true,
      ownerName: vendor.ownerName,
      businessName: vendor.businessName,
      roleName: vendor.roleName,
      status: vendor.status,
      isActive: vendor.isActive,
      setupCompleted: vendor.setupCompleted,
      defaultMode: 'CENTER' // Start in center mode by default
    };
    
  } catch (error) {
    console.error('❌ [SOLO AUTH] Error fetching solo provider session:', error);
    return null;
  }
}

/**
 * Get regular multi-staff vendor session data
 */
export async function getMultiStaffVendorSession(phone: string, kv: any) {
  try {
    const cleanPhone = normalizePhone(phone);
    
    console.log(`🔍 [VENDOR AUTH] Fetching multi-staff vendor for: ${cleanPhone}`);
    
    // Find vendor by phone
    const allVendors = await kv.getByPrefix('vendor:vendor_');
    const vendor = allVendors.find((v: any) => {
      if (!v || !v.phone) return false;
      return phonesMatch(normalizePhone(v.phone), cleanPhone);
    });
    
    if (!vendor) {
      console.log(`❌ [VENDOR AUTH] No vendor found`);
      return null;
    }
    
    if (vendor.isSoloProvider) {
      console.log(`ℹ️ [VENDOR AUTH] Vendor is solo provider, use getSoloProviderSession instead`);
      return null;
    }
    
    console.log(`✅ [VENDOR AUTH] Found multi-staff vendor: ${vendor.id}`);
    
    // Get center
    const centerId = vendor.centerId || (await kv.get(`vendor:${vendor.id}:center`));
    const center = centerId ? await kv.get(`center:${centerId}`) : null;
    
    return {
      vendorId: vendor.id,
      centerId,
      vendor,
      center,
      isSoloProvider: false,
      status: vendor.status,
      isActive: vendor.isActive,
      setupCompleted: vendor.setupCompleted
    };
    
  } catch (error) {
    console.error('❌ [VENDOR AUTH] Error:', error);
    return null;
  }
}

/**
 * Get staff session data (for staff portal login)
 */
export async function getStaffSession(phone: string, kv: any) {
  try {
    const cleanPhone = normalizePhone(phone);
    
    console.log(`🔍 [STAFF AUTH] Fetching staff for: ${cleanPhone}`);
    
    // Check if solo provider first
    const soloSession = await getSoloProviderSession(phone, kv);
    if (soloSession) {
      console.log(`✅ [STAFF AUTH] Solo provider found, returning as staff`);
      return {
        ...soloSession,
        isStaffLogin: true
      };
    }
    
    // Find staff by phone
    const allStaff = await kv.getByPrefix('staff:staff_');
    const staff = allStaff.find((s: any) => {
      if (!s || !s.phone) return false;
      return phonesMatch(normalizePhone(s.phone), cleanPhone);
    });
    
    if (!staff) {
      console.log(`❌ [STAFF AUTH] No staff found`);
      return null;
    }
    
    console.log(`✅ [STAFF AUTH] Found staff: ${staff.id}`);
    
    // Get center
    const center = staff.centerId ? await kv.get(`center:${staff.centerId}`) : null;
    
    return {
      staffId: staff.id,
      centerId: staff.centerId,
      vendorId: staff.vendorId,
      staff,
      center,
      isSoloProvider: false,
      isStaffLogin: true,
      status: staff.status,
      isActive: staff.isActive
    };
    
  } catch (error) {
    console.error('❌ [STAFF AUTH] Error:', error);
    return null;
  }
}

/**
 * Universal vendor/staff login resolver
 * Returns appropriate session based on phone type
 */
export async function resolveVendorLogin(phone: string, kv: any) {
  try {
    const cleanPhone = normalizePhone(phone);
    
    console.log(`🔐 [AUTH RESOLVER] Resolving login for: ${cleanPhone}`);
    
    // 1. Check if solo provider
    const soloSession = await getSoloProviderSession(phone, kv);
    if (soloSession) {
      console.log(`✅ [AUTH RESOLVER] Solo provider login`);
      return {
        ...soloSession,
        loginType: 'SOLO_PROVIDER'
      };
    }
    
    // 2. Check if multi-staff vendor
    const vendorSession = await getMultiStaffVendorSession(phone, kv);
    if (vendorSession) {
      console.log(`✅ [AUTH RESOLVER] Multi-staff vendor login`);
      return {
        ...vendorSession,
        loginType: 'MULTI_STAFF_VENDOR'
      };
    }
    
    // 3. Check if regular staff
    const staffSession = await getStaffSession(phone, kv);
    if (staffSession) {
      console.log(`✅ [AUTH RESOLVER] Staff login`);
      return {
        ...staffSession,
        loginType: 'STAFF'
      };
    }
    
    console.log(`❌ [AUTH RESOLVER] No vendor/staff found`);
    return null;
    
  } catch (error) {
    console.error('❌ [AUTH RESOLVER] Error:', error);
    return null;
  }
}

/**
 * Determine vendor state for onboarding flow
 */
export function determineVendorState(session: any): string {
  if (!session) return 'new';
  
  const { vendor } = session;
  
  if (!vendor) return 'new';
  
  // Pending approval
  if (vendor.status === 'pending') {
    return 'pending_approval';
  }
  
  // Rejected
  if (vendor.status === 'rejected') {
    return 'rejected';
  }
  
  // Approved but setup not complete
  if (vendor.status === 'approved' && !vendor.setupCompleted) {
    return 'approved_setup_pending';
  }
  
  // Active and setup complete
  if (vendor.status === 'approved' && vendor.setupCompleted && vendor.isActive) {
    return 'active';
  }
  
  // Inactive
  if (vendor.status === 'approved' && !vendor.isActive) {
    return 'inactive';
  }
  
  return 'unknown';
}
