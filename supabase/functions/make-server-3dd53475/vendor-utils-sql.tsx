/**
 * Vendor Utilities (SQL-ONLY VERSION)
 * 
 * CRITICAL: These utilities ensure database consistency for vendor records.
 * ALWAYS use saveVendor() instead of direct SQL to ensure proper data handling.
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()` with SQL repository calls
 * - All data now comes from SQL tables (vendors table)
 * - Index lookups now use SQL queries with WHERE clauses
 * 
 * Date: 2025-01-27
 * Migration: Batch 9 - 500 KV Operations Migration
 */

import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';

/**
 * Save vendor with automatic data consistency
 * 
 * This is the ONLY function that should be used to save vendor records.
 * It ensures all necessary data is properly stored in SQL.
 * 
 * @param vendorData - Complete vendor object with id, phone, and optionally userId/email
 * @returns Promise<void>
 */
export async function saveVendor(vendorData: any): Promise<void> {
  const vendorId = vendorData.id;
  
  if (!vendorId) {
    throw new Error('❌ saveVendor: vendorData.id is required');
  }
  
  console.log(`💾 Saving vendor: ${vendorId}`);
  
  const vendorsRepo = getVendorsRepository();
  const client = getDbClient();
  
  // ✅ SQL: Check if vendor exists
  const existing = await vendorsRepo.findById(vendorId);
  
  if (existing) {
    // ✅ SQL: Update existing vendor
    await vendorsRepo.update(vendorId, {
      ...vendorData,
      updated_at: new Date().toISOString()
    });
    console.log(`   ✅ Vendor updated: ${vendorId}`);
  } else {
    // ✅ SQL: Create new vendor
    await vendorsRepo.create({
      id: vendorId,
      phone: vendorData.phone,
      email: vendorData.email,
      business_name: vendorData.businessName || vendorData.business_name,
      owner_name: vendorData.ownerName || vendorData.owner_name,
      role_id: vendorData.roleId || vendorData.role_id,
      status: vendorData.status || 'pending',
      is_active: vendorData.isActive ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...vendorData
    });
    console.log(`   ✅ Vendor created: ${vendorId}`);
  }
  
  // Note: Phone/email/userId lookups are now handled via SQL WHERE clauses
  // No separate index tables needed - SQL indexes handle this efficiently
  
  console.log(`✅ Vendor saved: ${vendorId}`);
}

/**
 * Update vendor with automatic data consistency
 * 
 * Updates vendor record in SQL.
 * 
 * @param vendorId - Vendor ID
 * @param updates - Partial vendor data to update
 * @returns Promise<any> - Updated vendor object
 */
export async function updateVendor(vendorId: string, updates: any): Promise<any> {
  console.log(`🔄 Updating vendor: ${vendorId}`);
  
  const vendorsRepo = getVendorsRepository();
  
  // ✅ SQL: Get existing vendor
  const existingVendor = await vendorsRepo.findById(vendorId);
  
  if (!existingVendor) {
    throw new Error(`❌ Vendor not found: ${vendorId}`);
  }
  
  // ✅ SQL: Update vendor
  const updatedVendor = await vendorsRepo.update(vendorId, {
    ...updates,
    updated_at: new Date().toISOString()
  });
  
  console.log(`✅ Vendor updated: ${vendorId}`);
  
  return updatedVendor;
}

/**
 * Get vendor by ID
 * 
 * @param vendorId - Vendor ID
 * @returns Promise<any | null> - Vendor object or null
 */
export async function getVendor(vendorId: string): Promise<any | null> {
  const vendorsRepo = getVendorsRepository();
  return await vendorsRepo.findById(vendorId);
}

/**
 * Get vendor by phone number
 * 
 * @param phone - Phone number (will be normalized)
 * @returns Promise<any | null> - Vendor object or null
 */
export async function getVendorByPhone(phone: string): Promise<any | null> {
  const { normalizePhone } = await import('./phone-utils.tsx');
  const cleanPhone = normalizePhone(phone);
  
  // ✅ SQL: Query vendor by phone
  const client = getDbClient();
  const { data: vendor } = await client
    .from('vendors')
    .select('*')
    .eq('phone', cleanPhone)
    .maybeSingle();
  
  return vendor;
}

/**
 * Get vendor by user ID
 * 
 * @param userId - User ID from Supabase Auth
 * @returns Promise<any | null> - Vendor object or null
 */
export async function getVendorByUserId(userId: string): Promise<any | null> {
  // ✅ SQL: Query vendor by user_id (if column exists) or metadata
  const client = getDbClient();
  
  // Try direct user_id column first
  const { data: vendor } = await client
    .from('vendors')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (vendor) return vendor;
  
  // Fallback: Check metadata JSONB
  const { data: vendorByMetadata } = await client
    .from('vendors')
    .select('*')
    .eq('metadata->>userId', userId)
    .maybeSingle();
  
  return vendorByMetadata;
}

/**
 * Get vendor by email
 * 
 * @param email - Email address
 * @returns Promise<any | null> - Vendor object or null
 */
export async function getVendorByEmail(email: string): Promise<any | null> {
  const cleanEmail = email.toLowerCase().trim();
  
  // ✅ SQL: Query vendor by email
  const client = getDbClient();
  const { data: vendor } = await client
    .from('vendors')
    .select('*')
    .eq('email', cleanEmail)
    .maybeSingle();
  
  return vendor;
}

/**
 * Delete vendor
 * 
 * @param vendorId - Vendor ID
 * @returns Promise<void>
 */
export async function deleteVendor(vendorId: string): Promise<void> {
  const vendorsRepo = getVendorsRepository();
  
  // ✅ SQL: Get vendor first
  const vendor = await vendorsRepo.findById(vendorId);
  
  if (!vendor) {
    console.warn(`⚠️ Vendor not found for deletion: ${vendorId}`);
    return;
  }
  
  // ✅ SQL: Delete vendor (cascade will handle related records if foreign keys are set)
  await vendorsRepo.delete(vendorId);
  
  console.log(`🗑️ Vendor deleted: ${vendorId}`);
}

/**
 * Ensure vendor data consistency (idempotent)
 * 
 * This can be called at any time to ensure vendor data is consistent.
 * Safe to run multiple times.
 * 
 * @param vendorId - Vendor ID
 * @returns Promise<{ created: string[], existed: string[] }>
 */
export async function ensureVendorIndexes(vendorId: string): Promise<{ created: string[], existed: string[] }> {
  const vendor = await getVendor(vendorId);
  
  if (!vendor) {
    throw new Error(`❌ Vendor not found: ${vendorId}`);
  }
  
  // In SQL, indexes are handled automatically by the database
  // This function now just verifies the vendor exists and has required fields
  const created: string[] = [];
  const existed: string[] = [];
  
  // Verify phone exists (required for login)
  if (vendor.phone) {
    existed.push('phone');
  } else {
    console.warn(`⚠️ Vendor ${vendorId} missing phone number`);
  }
  
  // Verify email exists (optional)
  if (vendor.email) {
    existed.push('email');
  }
  
  return { created, existed };
}

