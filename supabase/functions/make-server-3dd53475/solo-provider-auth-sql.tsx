/**
 * ============================================================================
 * SOLO PROVIDER AUTHENTICATION HELPERS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Smart login routing for solo providers:
 * - Same phone number for vendor, center, and staff
 * - Returns unified session with all IDs
 * - Determines default dashboard mode
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signatures
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with SQL queries
 * - Uses `VendorsRepository`, `StaffRepository`
 * - Uses `vendors`, `staff` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 16 - KV to SQL (10 KV operations removed)
 * ============================================================================
 */

import { normalizePhone, phonesMatch } from "./phone-utils.tsx";
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();
const vendorsRepo = getVendorsRepository();
const staffRepo = getStaffRepository();

/**
 * Check if a phone belongs to a solo provider
 */
export async function isSoloProvider(phone: string): Promise<boolean> {
  try {
    const cleanPhone = normalizePhone(phone);
    
    // ✅ SQL: Find vendor by phone
    const { data: vendors } = await db
      .from('vendors')
      .select('*')
      .eq('phone', cleanPhone)
      .single();
    
    if (!vendors) return false;
    
    // Check if vendor is solo provider (has is_independent flag or staff count = 1)
    const { data: staff } = await db
      .from('staff')
      .select('id')
      .eq('vendor_id', vendors.id)
      .eq('is_active', true);
    
    return (staff?.length || 0) <= 1;
  } catch (error) {
    console.error('Error checking solo provider:', error);
    return false;
  }
}

/**
 * Get solo provider session data
 */
export async function getSoloProviderSession(phone: string) {
  try {
    const cleanPhone = normalizePhone(phone);
    
    // ✅ SQL: Find vendor by phone
    const { data: vendor } = await db
      .from('vendors')
      .select('*')
      .eq('phone', cleanPhone)
      .single();
    
    if (!vendor) return null;
    
    // ✅ SQL: Get staff for this vendor
    const { data: staffList } = await db
      .from('staff')
      .select('*')
      .eq('vendor_id', vendor.id)
      .eq('is_active', true)
      .limit(1);
    
    const staff = staffList?.[0] || null;
    
    // Check if solo provider
    const { data: allStaff } = await db
      .from('staff')
      .select('id')
      .eq('vendor_id', vendor.id)
      .eq('is_active', true);
    
    if ((allStaff?.length || 0) > 1) {
      return null; // Not a solo provider
    }
    
    return {
      vendorId: vendor.id,
      centerId: vendor.id, // Same as vendor for solo providers
      staffId: staff?.id || null,
      vendor,
      center: vendor,
      staff,
      isSoloProvider: true,
      ownerName: vendor.owner_name,
      businessName: vendor.business_name,
      roleName: vendor.role_id,
      status: vendor.status,
      isActive: vendor.is_active,
      setupCompleted: vendor.setup_completed,
      defaultMode: 'CENTER'
    };
  } catch (error) {
    console.error('Error fetching solo provider session:', error);
    return null;
  }
}

/**
 * Get regular multi-staff vendor session data
 */
export async function getMultiStaffVendorSession(phone: string) {
  try {
    const cleanPhone = normalizePhone(phone);
    
    // ✅ SQL: Find vendor by phone
    const { data: vendor } = await db
      .from('vendors')
      .select('*')
      .eq('phone', cleanPhone)
      .single();
    
    if (!vendor) return null;
    
    // Check if solo provider
    const { data: staff } = await db
      .from('staff')
      .select('id')
      .eq('vendor_id', vendor.id)
      .eq('is_active', true);
    
    if ((staff?.length || 0) <= 1) {
      return null; // Is solo provider, use getSoloProviderSession instead
    }
    
    return {
      vendorId: vendor.id,
      centerId: vendor.id,
      vendor,
      center: vendor,
      isSoloProvider: false,
      status: vendor.status,
      isActive: vendor.is_active,
      setupCompleted: vendor.setup_completed
    };
  } catch (error) {
    console.error('Error fetching multi-staff vendor session:', error);
    return null;
  }
}

/**
 * Get staff session data
 */
export async function getStaffSession(phone: string) {
  try {
    const cleanPhone = normalizePhone(phone);
    
    // Check if solo provider first
    const soloSession = await getSoloProviderSession(phone);
    if (soloSession) {
      return {
        ...soloSession,
        isStaffLogin: true
      };
    }
    
    // ✅ SQL: Find staff by phone
    const { data: staff } = await db
      .from('staff')
      .select('*, vendors!inner(*)')
      .eq('phone', cleanPhone)
      .eq('is_active', true)
      .single();
    
    if (!staff) return null;
    
    return {
      staffId: staff.id,
      centerId: staff.vendor_id,
      vendorId: staff.vendor_id,
      staff,
      center: staff.vendors,
      isSoloProvider: false,
      isStaffLogin: true,
      status: staff.status,
      isActive: staff.is_active
    };
  } catch (error) {
    console.error('Error fetching staff session:', error);
    return null;
  }
}

/**
 * Universal vendor/staff login resolver
 */
export async function resolveVendorLogin(phone: string) {
  try {
    // Try solo provider first
    const soloSession = await getSoloProviderSession(phone);
    if (soloSession) return soloSession;
    
    // Try multi-staff vendor
    const vendorSession = await getMultiStaffVendorSession(phone);
    if (vendorSession) return vendorSession;
    
    // Try staff
    const staffSession = await getStaffSession(phone);
    if (staffSession) return staffSession;
    
    return null;
  } catch (error) {
    console.error('Error resolving vendor login:', error);
    return null;
  }
}

console.log('✅ Solo Provider Auth helpers (SQL-only) registered');

