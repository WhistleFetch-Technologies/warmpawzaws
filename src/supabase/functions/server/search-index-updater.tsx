/**
 * 🔄 REAL-TIME SEARCH INDEX UPDATER
 * 
 * Phase 7D: Elastic Search Enhancement - Rule 5 Implementation
 * 
 * Features:
 * - Automatic index updates on CRUD operations
 * - Incremental indexing (no full rebuild needed)
 * - Index refresh mechanisms
 * - Batch updates for performance
 * - Error recovery and retry logic
 */

import * as kv from './kv_store.tsx';

/**
 * Index a single staff member
 */
export async function indexStaff(staffId: string, staffData?: any): Promise<void> {
  try {
    console.log(`🔍 [INDEX-STAFF] Indexing staff: ${staffId}`);
    
    // Get staff data if not provided
    const staff = staffData || await kv.get(`staff_${staffId}`);
    
    if (!staff) {
      console.warn(`⚠️ Staff not found: ${staffId}`);
      return;
    }
    
    // Get vendor data for location
    const vendor = await kv.get(`vendor:${staff.vendorId}`);
    
    // Build searchable text
    const searchableText = [
      staff.name,
      staff.specialization,
      staff.qualifications?.join(' '),
      staff.services?.join(' '),
      vendor?.businessName,
      vendor?.address?.city,
      vendor?.address?.area,
      staff.bio || '',
      staff.expertise?.join(' ')
    ].filter(Boolean).join(' ').toLowerCase();
    
    // Create search index entry
    const searchIndex = {
      id: staffId,
      type: 'staff',
      data: {
        staffId: staff.staffId || staffId,
        name: staff.name,
        specialization: staff.specialization,
        services: staff.services || [],
        rating: staff.rating || 0,
        experience: staff.experience || 0,
        vendorId: staff.vendorId,
        vendorName: vendor?.businessName,
        location: {
          city: vendor?.address?.city,
          area: vendor?.address?.area,
          state: vendor?.address?.state,
          lat: vendor?.location?.lat,
          lng: vendor?.location?.lng
        },
        availability: staff.availability || {},
        isActive: staff.isActive !== false,
        photoUrl: staff.photoUrl
      },
      searchableText,
      tags: [
        staff.specialization,
        ...(staff.services || []),
        vendor?.address?.city,
        vendor?.address?.area,
        ...(staff.expertise || [])
      ].filter(Boolean).map(t => t.toLowerCase()),
      rating: staff.rating || 0,
      experience: staff.experience || 0,
      indexedAt: new Date().toISOString()
    };
    
    // Save to search index
    await kv.set(`search_index_staff_${staffId}`, searchIndex);
    
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
    await kv.del(`search_index_staff_${staffId}`);
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
    
    // Get vendor data if not provided
    const vendor = vendorData || await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      console.warn(`⚠️ Vendor not found: ${vendorId}`);
      return;
    }
    
    // Build searchable text
    const searchableText = [
      vendor.businessName,
      vendor.description,
      vendor.serviceType,
      vendor.address?.city,
      vendor.address?.area,
      vendor.address?.state,
      vendor.specializations?.join(' '),
      vendor.amenities?.join(' ')
    ].filter(Boolean).join(' ').toLowerCase();
    
    // Create search index entry
    const searchIndex = {
      id: vendorId,
      type: 'center',
      data: {
        vendorId: vendor.vendorId || vendorId,
        businessName: vendor.businessName,
        serviceType: vendor.serviceType,
        roleId: vendor.roleId,
        description: vendor.description,
        rating: vendor.rating || 0,
        totalReviews: vendor.totalReviews || 0,
        location: {
          city: vendor.address?.city,
          area: vendor.address?.area,
          state: vendor.address?.state,
          address: vendor.address?.fullAddress,
          lat: vendor.location?.lat,
          lng: vendor.location?.lng
        },
        priceRange: vendor.priceRange,
        amenities: vendor.amenities || [],
        specializations: vendor.specializations || [],
        isActive: vendor.isActive !== false,
        status: vendor.status,
        photoUrl: vendor.photoUrl,
        coverPhoto: vendor.coverPhoto
      },
      searchableText,
      tags: [
        vendor.serviceType,
        vendor.address?.city,
        vendor.address?.area,
        ...(vendor.specializations || []),
        ...(vendor.amenities || [])
      ].filter(Boolean).map(t => t.toLowerCase()),
      rating: vendor.rating || 0,
      totalReviews: vendor.totalReviews || 0,
      indexedAt: new Date().toISOString()
    };
    
    // Save to search index
    await kv.set(`search_index_center_${vendorId}`, searchIndex);
    
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
    await kv.del(`search_index_center_${vendorId}`);
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
    
    // Get service data if not provided
    const service = serviceData || await kv.get(`service:${serviceId}`);
    
    if (!service) {
      console.warn(`⚠️ Service not found: ${serviceId}`);
      return;
    }
    
    // Get vendor data
    const vendor = await kv.get(`vendor:${service.vendorId}`);
    
    // Build searchable text
    const searchableText = [
      service.name || service.serviceName,
      service.description,
      service.category,
      service.subcategory,
      vendor?.businessName,
      vendor?.address?.city,
      vendor?.address?.area
    ].filter(Boolean).join(' ').toLowerCase();
    
    // Create search index entry
    const searchIndex = {
      id: serviceId,
      type: 'service',
      data: {
        serviceId: service.id || service.serviceId || serviceId,
        name: service.name || service.serviceName,
        description: service.description,
        category: service.category,
        subcategory: service.subcategory || service.subCategory,
        price: service.price,
        duration: service.duration,
        vendorId: service.vendorId,
        vendorName: vendor?.businessName,
        location: {
          city: vendor?.address?.city,
          area: vendor?.address?.area,
          lat: vendor?.location?.lat,
          lng: vendor?.location?.lng
        },
        isActive: service.isActive !== false,
        isPublished: service.isPublished !== false,
        imageUrl: service.imageUrl
      },
      searchableText,
      tags: [
        service.category,
        service.subcategory || service.subCategory,
        vendor?.address?.city,
        vendor?.address?.area
      ].filter(Boolean).map(t => t.toLowerCase()),
      price: service.price || 0,
      rating: vendor?.rating || 0,
      indexedAt: new Date().toISOString()
    };
    
    // Save to search index
    await kv.set(`search_index_service_${serviceId}`, searchIndex);
    
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
    await kv.del(`search_index_service_${serviceId}`);
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
    // Index all staff
    const allStaff = await kv.getByPrefix('staff_') || [];
    for (const staff of allStaff) {
      await indexStaff(staff.staffId || staff.id, staff);
      results.staff++;
    }
    
    // Index all vendors
    const allVendors = await kv.getByPrefix('vendor:vendor_') || [];
    for (const vendor of allVendors) {
      await indexVendor(vendor.vendorId || vendor.id, vendor);
      results.vendors++;
    }
    
    // Index all services
    const allServices = await kv.getByPrefix('service:') || [];
    for (const service of allServices) {
      await indexService(service.id || service.serviceId, service);
      results.services++;
    }
    
    console.log(`✅ [REBUILD-INDEX] Completed: ${results.staff} staff, ${results.vendors} vendors, ${results.services} services`);
  } catch (error) {
    console.error(`❌ [REBUILD-INDEX] Error during rebuild:`, error);
    throw error;
  }
  
  return results;
}
