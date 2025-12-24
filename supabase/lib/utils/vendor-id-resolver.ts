/**
 * VENDOR ID RESOLVER UTILITY
 * Standardized function to resolve vendor IDs (handles both UUID and vendor_id string)
 * Use this in ALL endpoints that accept vendorId parameter
 */

import { getVendorsRepository } from '../repositories/vendors.ts';

/**
 * Resolve vendor ID to UUID
 * Handles:
 * - UUID format (returns as-is if valid)
 * - vendor_id string (e.g., "vendor_9611377119")
 * - Phone number fallback
 * 
 * @param identifier - Vendor ID (UUID, vendor_id string, or phone)
 * @returns Resolved UUID or null if not found
 */
export async function resolveVendorIdToUuid(identifier: string): Promise<string | null> {
  if (!identifier) {
    return null;
  }
  
  const vendorsRepo = getVendorsRepository();
  return await vendorsRepo.resolveVendorId(identifier);
}

/**
 * Resolve vendor ID and get vendor object
 * @param identifier - Vendor ID (UUID, vendor_id string, or phone)
 * @returns Vendor object or null if not found
 */
export async function resolveVendor(identifier: string) {
  const vendorsRepo = getVendorsRepository();
  const resolvedId = await vendorsRepo.resolveVendorId(identifier);
  
  if (!resolvedId) {
    return null;
  }
  
  return await vendorsRepo.findById(resolvedId);
}

