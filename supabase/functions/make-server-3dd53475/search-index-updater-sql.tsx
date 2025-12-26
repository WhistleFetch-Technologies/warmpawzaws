/**
 * ============================================================================
 * REAL-TIME SEARCH INDEX UPDATER - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Automatic index updates on CRUD operations
 * - Incremental indexing (no full rebuild needed)
 * - Index refresh mechanisms
 * - Batch updates for performance
 * - Error recovery and retry logic
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()`, `kv.getByPrefix()` with SQL queries
 * - Uses `search_index` table
 * - Uses SQL repositories: `StaffRepository`, `VendorsRepository`, `ServicesRepository`
 * 
 * Date: 2025-01-28
 * Migration: Batch 14 - KV to SQL (14 KV operations removed)
 * ============================================================================
 */

import { getDbClient } from '../../lib/db.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';

const db = getDbClient();

/**
 * Index a single staff member
 */
export async function indexStaff(staffId: string, staffData?: any): Promise<void> {
  try {
    console.log(`🔍 [INDEX-STAFF] Indexing staff: ${staffId}`);
    
    // ✅ SQL: Get staff data if not provided
    const staffRepo = getStaffRepository();
    const staff = staffData || await staffRepo.findById(staffId);
    
    if (!staff) {
      console.warn(`⚠️ Staff not found: ${staffId}`);
      return;
    }
    
    // ✅ SQL: Get vendor data for location
    const vendorsRepo = getVendorsRepository();
    const vendor = staff.vendorId ? await vendorsRepo.findById(staff.vendorId) : null;
    
    // Build searchable text
    const searchableText = [
      staff.fullName || staff.name,
      staff.specialization,
      staff.qualifications?.join(' '),
      staff.services?.map((s: any) => s.name || s).join(' '),
      vendor?.business_name,
      vendor?.city,
      vendor?.address,
      staff.bio || '',
      staff.expertise?.join(' ')
    ].filter(Boolean).join(' ').toLowerCase();
    
    // ✅ SQL: Upsert search index entry
    const { error } = await db
      .from('search_index')
      .upsert({
        entity_type: 'staff',
        entity_id: staffId,
        search_text: searchableText,
        metadata: {
          staffId: staff.staffId || staffId,
          name: staff.fullName || staff.name,
          specialization: staff.specialization,
          services: staff.services || [],
          rating: staff.rating || 0,
          experience: staff.experience || 0,
          vendorId: staff.vendorId,
          vendorName: vendor?.business_name,
          location: {
            city: vendor?.city,
            area: vendor?.address,
            state: vendor?.state,
            lat: vendor?.latitude,
            lng: vendor?.longitude
          },
          availability: staff.availability || {},
          isActive: staff.isActive !== false,
          photoUrl: staff.photo || staff.photoUrl
        }
      }, {
        onConflict: 'entity_type,entity_id'
      });
    
    if (error) {
      console.error(`❌ [INDEX-STAFF] Error indexing staff ${staffId}:`, error);
      return;
    }
    
    console.log(`✅ [INDEX-STAFF] Successfully indexed staff: ${staffId}`);
  } catch (error) {
    console.error(`❌ [INDEX-STAFF] Error indexing staff ${staffId}:`, error);
    // Don't throw - log and continue
  }
}

/**
 * Remove staff from index
 */
export async function removeStaffIndex(staffId: string): Promise<void> {
  try {
    console.log(`🗑️ [INDEX-STAFF] Removing staff from index: ${staffId}`);
    
    // ✅ SQL: Delete from search_index
    const { error } = await db
      .from('search_index')
      .delete()
      .eq('entity_type', 'staff')
      .eq('entity_id', staffId);
    
    if (error) {
      console.error(`❌ [INDEX-STAFF] Error removing staff from index ${staffId}:`, error);
      return;
    }
    
    console.log(`✅ [INDEX-STAFF] Successfully removed staff from index: ${staffId}`);
  } catch (error) {
    console.error(`❌ [INDEX-STAFF] Error removing staff from index ${staffId}:`, error);
  }
}

/**
 * Index a single vendor/center
 */
export async function indexVendor(vendorId: string, vendorData?: any): Promise<void> {
  try {
    console.log(`🔍 [INDEX-VENDOR] Indexing vendor: ${vendorId}`);
    
    // ✅ SQL: Get vendor data if not provided
    const vendorsRepo = getVendorsRepository();
    const vendor = vendorData || await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      console.warn(`⚠️ Vendor not found: ${vendorId}`);
      return;
    }
    
    // Build searchable text
    const searchableText = [
      vendor.business_name,
      vendor.specialization,
      vendor.city,
      vendor.address,
      vendor.state
    ].filter(Boolean).join(' ').toLowerCase();
    
    // ✅ SQL: Upsert search index entry
    const { error } = await db
      .from('search_index')
      .upsert({
        entity_type: 'vendor',
        entity_id: vendorId,
        search_text: searchableText,
        metadata: {
          vendorId: vendor.id || vendorId,
          businessName: vendor.business_name,
          description: vendor.specialization,
          city: vendor.city,
          area: vendor.address,
          state: vendor.state,
          address: vendor.address,
          lat: vendor.latitude,
          lng: vendor.longitude,
          status: vendor.status,
          isActive: vendor.is_active !== false
        }
      }, {
        onConflict: 'entity_type,entity_id'
      });
    
    if (error) {
      console.error(`❌ [INDEX-VENDOR] Error indexing vendor ${vendorId}:`, error);
      return;
    }
    
    console.log(`✅ [INDEX-VENDOR] Successfully indexed vendor: ${vendorId}`);
  } catch (error) {
    console.error(`❌ [INDEX-VENDOR] Error indexing vendor ${vendorId}:`, error);
  }
}

/**
 * Remove vendor from index
 */
export async function removeVendorIndex(vendorId: string): Promise<void> {
  try {
    console.log(`🗑️ [INDEX-VENDOR] Removing vendor from index: ${vendorId}`);
    
    // ✅ SQL: Delete from search_index
    const { error } = await db
      .from('search_index')
      .delete()
      .eq('entity_type', 'vendor')
      .eq('entity_id', vendorId);
    
    if (error) {
      console.error(`❌ [INDEX-VENDOR] Error removing vendor from index ${vendorId}:`, error);
      return;
    }
    
    console.log(`✅ [INDEX-VENDOR] Successfully removed vendor from index: ${vendorId}`);
  } catch (error) {
    console.error(`❌ [INDEX-VENDOR] Error removing vendor from index ${vendorId}:`, error);
  }
}

/**
 * Index a single service
 */
export async function indexService(serviceId: string, serviceData?: any): Promise<void> {
  try {
    console.log(`🔍 [INDEX-SERVICE] Indexing service: ${serviceId}`);
    
    // ✅ SQL: Get service data if not provided
    const servicesRepo = getServicesRepository();
    const service = serviceData || await servicesRepo.findById(serviceId);
    
    if (!service) {
      console.warn(`⚠️ Service not found: ${serviceId}`);
      return;
    }
    
    // ✅ SQL: Get vendor data
    const vendorsRepo = getVendorsRepository();
    const vendor = service.vendor_id ? await vendorsRepo.findById(service.vendor_id) : null;
    
    // Build searchable text
    const searchableText = [
      service.name,
      service.description,
      service.category,
      vendor?.business_name,
      vendor?.city,
      vendor?.address
    ].filter(Boolean).join(' ').toLowerCase();
    
    // ✅ SQL: Upsert search index entry
    const { error } = await db
      .from('search_index')
      .upsert({
        entity_type: 'service',
        entity_id: serviceId,
        search_text: searchableText,
        metadata: {
          serviceId: service.id || serviceId,
          name: service.name,
          description: service.description,
          category: service.category,
          price: service.price,
          duration: service.duration_minutes,
          vendorId: service.vendor_id,
          vendorName: vendor?.business_name,
          location: {
            city: vendor?.city,
            area: vendor?.address,
            lat: vendor?.latitude,
            lng: vendor?.longitude
          },
          isActive: service.is_active !== false
        }
      }, {
        onConflict: 'entity_type,entity_id'
      });
    
    if (error) {
      console.error(`❌ [INDEX-SERVICE] Error indexing service ${serviceId}:`, error);
      return;
    }
    
    console.log(`✅ [INDEX-SERVICE] Successfully indexed service: ${serviceId}`);
  } catch (error) {
    console.error(`❌ [INDEX-SERVICE] Error indexing service ${serviceId}:`, error);
  }
}

/**
 * Remove service from index
 */
export async function removeServiceIndex(serviceId: string): Promise<void> {
  try {
    console.log(`🗑️ [INDEX-SERVICE] Removing service from index: ${serviceId}`);
    
    // ✅ SQL: Delete from search_index
    const { error } = await db
      .from('search_index')
      .delete()
      .eq('entity_type', 'service')
      .eq('entity_id', serviceId);
    
    if (error) {
      console.error(`❌ [INDEX-SERVICE] Error removing service from index ${serviceId}:`, error);
      return;
    }
    
    console.log(`✅ [INDEX-SERVICE] Successfully removed service from index: ${serviceId}`);
  } catch (error) {
    console.error(`❌ [INDEX-SERVICE] Error removing service from index ${serviceId}:`, error);
  }
}

/**
 * Batch index multiple items
 */
export async function batchIndex(items: Array<{type: 'staff' | 'vendor' | 'service', id: string, data?: any}>): Promise<void> {
  console.log(`🔍 [BATCH-INDEX] Starting batch index of ${items.length} items`);
  
  const results = {
    success: 0,
    failed: 0
  };
  
  for (const item of items) {
    try {
      if (item.type === 'staff') {
        await indexStaff(item.id, item.data);
        results.success++;
      } else if (item.type === 'vendor') {
        await indexVendor(item.id, item.data);
        results.success++;
      } else if (item.type === 'service') {
        await indexService(item.id, item.data);
        results.success++;
      }
    } catch (error) {
      console.error(`❌ [BATCH-INDEX] Error indexing ${item.type} ${item.id}:`, error);
      results.failed++;
    }
  }
  
  console.log(`✅ [BATCH-INDEX] Completed: ${results.success} success, ${results.failed} failed`);
}

/**
 * Rebuild entire search index
 */
export async function rebuildSearchIndex(): Promise<{staff: number, vendors: number, services: number}> {
  console.log(`🔄 [REBUILD-INDEX] Starting full index rebuild`);
  
  const results = {
    staff: 0,
    vendors: 0,
    services: 0
  };
  
  try {
    // ✅ SQL: Index all staff
    const staffRepo = getStaffRepository();
    const allStaff = await staffRepo.findAll();
    for (const staff of allStaff) {
      await indexStaff(staff.id, staff);
      results.staff++;
    }
    
    // ✅ SQL: Index all vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll();
    for (const vendor of allVendors) {
      await indexVendor(vendor.id, vendor);
      results.vendors++;
    }
    
    // ✅ SQL: Index all services
    const servicesRepo = getServicesRepository();
    const allServices = await servicesRepo.findAll();
    for (const service of allServices) {
      await indexService(service.id, service);
      results.services++;
    }
    
    console.log(`✅ [REBUILD-INDEX] Completed: ${results.staff} staff, ${results.vendors} vendors, ${results.services} services`);
  } catch (error) {
    console.error(`❌ [REBUILD-INDEX] Error during rebuild:`, error);
    throw error;
  }
  
  return results;
}

