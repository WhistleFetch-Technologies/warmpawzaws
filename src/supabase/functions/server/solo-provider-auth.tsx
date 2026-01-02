// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { normalizePhone, phonesMatch } from "./phone-utils";
import { getDbClient } from '../../../supabase/lib/db';
import {
  getVendorsRepository,
  getStaffRepository
} from '../../../supabase/lib/repositories/index';

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
export async function isSoloProvider(phone: string): Promise<boolean> {
  try {
    const cleanPhone = normalizePhone(phone);
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findByPhone(cleanPhone);
    
    if (!vendor || !vendor.id) {
      return false;
    }
    
    // Check if vendor is solo provider (has only one staff member with same phone)
    const staffRepo = getStaffRepository();
    const staffList = await staffRepo.findByVendor(vendor.id);
    const matchingStaff = staffList.filter((s: any) => phonesMatch(normalizePhone(s.phone || ''), cleanPhone));
    
    return matchingStaff.length === 1 && matchingStaff[0].id === vendor.id;
  } catch (error) {
    console.error('Error checking solo provider:', error);
    return false;
  }
}

/**
 * Get solo provider session data
 * Returns: { vendorId, centerId, staffId, vendor, center, staff, isSoloProvider: true }
 */
export async function getSoloProviderSession(phone: string) {
  try {
    const cleanPhone = normalizePhone(phone);
    
    console.log(`🔍 [SOLO AUTH] Fetching solo provider data for: ${cleanPhone}`);
    
    // ✅ SQL: Find vendor by phone
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findByPhone(cleanPhone);
    
    if (!vendor || !vendor.id) {
      console.log(`❌ [SOLO AUTH] No vendor found for phone`);
      return null;
    }
    
    // ✅ SQL: Check if solo provider (has staff with same phone)
    const staffRepo = getStaffRepository();
    const staffList = await staffRepo.findByVendor(vendor.id);
    const matchingStaff = staffList.filter((s: any) => phonesMatch(normalizePhone(s.phone || ''), cleanPhone));
    
    if (matchingStaff.length !== 1) {
      console.log(`❌ [SOLO AUTH] Phone exists but not a solo provider (staff count: ${matchingStaff.length})`);
      return null;
    }
    
    const staff = matchingStaff[0];
    const vendorId = vendor.id;
    const staffId = staff.id;
    const centerId = vendor.center_id || staff.center_id;
    
    console.log(`✅ [SOLO AUTH] Found solo provider:`, { vendorId, centerId, staffId });
    
    // ✅ SQL: Get center if exists
    const db = getDbClient();
    let center = null;
    if (centerId) {
      const { data: centerData } = await db
        .from('centres')
        .select('*')
        .eq('id', centerId)
        .single();
      center = centerData;
    }
    
    console.log(`✅ [SOLO AUTH] Loaded all entities`);
    console.log(`   Vendor status: ${vendor.application_status || vendor.status}`);
    console.log(`   Center status: ${center?.status}`);
    console.log(`   Staff status: ${staff.status}`);
    
    return {
      vendorId,
      centerId,
      staffId,
      vendor,
      center,
      staff,
      isSoloProvider: true,
      ownerName: vendor.owner_name || vendor.ownerName,
      businessName: vendor.business_name || vendor.businessName,
      roleName: vendor.role_id || vendor.roleName,
      status: vendor.application_status || vendor.status,
      isActive: vendor.is_active !== false,
      setupCompleted: vendor.setup_completed || vendor.setupCompleted,
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
export async function getMultiStaffVendorSession(phone: string) {
  try {
    const cleanPhone = normalizePhone(phone);
    
    console.log(`🔍 [VENDOR AUTH] Fetching multi-staff vendor for: ${cleanPhone}`);
    
    // ✅ SQL: Find vendor by phone
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findByPhone(cleanPhone);
    
    if (!vendor || !vendor.id) {
      console.log(`❌ [VENDOR AUTH] No vendor found`);
      return null;
    }
    
    // Check if solo provider (has only one staff with same phone)
    const isSolo = await isSoloProvider(phone);
    if (isSolo) {
      console.log(`ℹ️ [VENDOR AUTH] Vendor is solo provider, use getSoloProviderSession instead`);
      return null;
    }
    
    console.log(`✅ [VENDOR AUTH] Found multi-staff vendor: ${vendor.id}`);
    
    // ✅ SQL: Get center if exists
    const db = getDbClient();
    const centerId = vendor.center_id;
    let center = null;
    if (centerId) {
      const { data: centerData } = await db
        .from('centres')
        .select('*')
        .eq('id', centerId)
        .single();
      center = centerData;
    }
    
    return {
      vendorId: vendor.id,
      centerId,
      vendor,
      center,
      isSoloProvider: false,
      status: vendor.application_status || vendor.status,
      isActive: vendor.is_active !== false,
      setupCompleted: vendor.setup_completed || vendor.setupCompleted
    };
    
  } catch (error) {
    console.error('❌ [VENDOR AUTH] Error:', error);
    return null;
  }
}

/**
 * Get staff session data (for staff portal login)
 */
export async function getStaffSession(phone: string) {
  try {
    const cleanPhone = normalizePhone(phone);
    
    console.log(`🔍 [STAFF AUTH] Fetching staff for: ${cleanPhone}`);
    
    // Check if solo provider first
    const soloSession = await getSoloProviderSession(phone);
    if (soloSession) {
      console.log(`✅ [STAFF AUTH] Solo provider found, returning as staff`);
      return {
        ...soloSession,
        isStaffLogin: true
      };
    }
    
    // ✅ SQL: Find staff by phone
    const staffRepo = getStaffRepository();
    const allStaff = await staffRepo.findAll();
    const staff = allStaff.find((s: any) => {
      if (!s || !s.phone) return false;
      return phonesMatch(normalizePhone(s.phone), cleanPhone);
    });
    
    if (!staff) {
      console.log(`❌ [STAFF AUTH] No staff found`);
      return null;
    }
    
    console.log(`✅ [STAFF AUTH] Found staff: ${staff.id}`);
    
    // ✅ SQL: Get center if exists
    const db = getDbClient();
    let center = null;
    if (staff.center_id) {
      const { data: centerData } = await db
        .from('centres')
        .select('*')
        .eq('id', staff.center_id)
        .single();
      center = centerData;
    }
    
    return {
      staffId: staff.id,
      centerId: staff.center_id,
      vendorId: staff.vendor_id,
      staff,
      center,
      isSoloProvider: false,
      isStaffLogin: true,
      status: staff.status,
      isActive: staff.is_active !== false
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
export async function resolveVendorLogin(phone: string) {
  try {
    const cleanPhone = normalizePhone(phone);
    
    console.log(`🔐 [AUTH RESOLVER] Resolving login for: ${cleanPhone}`);
    
    // 1. Check if solo provider
    const soloSession = await getSoloProviderSession(phone);
    if (soloSession) {
      console.log(`✅ [AUTH RESOLVER] Solo provider login`);
      return {
        ...soloSession,
        loginType: 'SOLO_PROVIDER'
      };
    }
    
    // 2. Check if multi-staff vendor
    const vendorSession = await getMultiStaffVendorSession(phone);
    if (vendorSession) {
      console.log(`✅ [AUTH RESOLVER] Multi-staff vendor login`);
      return {
        ...vendorSession,
        loginType: 'MULTI_STAFF_VENDOR'
      };
    }
    
    // 3. Check if regular staff
    const staffSession = await getStaffSession(phone);
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
  
  const status = vendor.application_status || vendor.status;
  const isActive = vendor.is_active !== false;
  const setupCompleted = vendor.setup_completed || vendor.setupCompleted;
  
  // Pending approval
  if (status === 'pending') {
    return 'pending_approval';
  }
  
  // Rejected
  if (status === 'rejected') {
    return 'rejected';
  }
  
  // Approved but setup not complete
  if (status === 'approved' && !setupCompleted) {
    return 'approved_setup_pending';
  }
  
  // Active and setup complete
  if (status === 'approved' && setupCompleted && isActive) {
    return 'active';
  }
  
  // Inactive
  if (status === 'approved' && !isActive) {
    return 'inactive';
  }
  
  return 'unknown';
}
