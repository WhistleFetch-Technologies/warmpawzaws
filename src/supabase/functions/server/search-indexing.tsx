/**
 * Search Indexing Service
 * Syncs data from KV store to Elasticsearch
 */

import * as kv from './kv_store.tsx';
import { getElasticsearchClient, initializeElasticsearchIndices } from './elasticsearch-client.tsx';

/**
 * Index all vendors to Elasticsearch
 */
export async function indexAllVendors(): Promise<void> {
  const esClient = getElasticsearchClient();
  const isAvailable = await esClient.healthCheck();
  
  if (!isAvailable) {
    console.warn('⚠️ [INDEXING] Elasticsearch not available, skipping vendor indexing');
    return;
  }

  try {
    console.log('📊 [INDEXING] Starting vendor indexing...');
    const vendors = await kv.getByPrefix('vendor:vendor_');
    
    const documents = vendors
      .filter((v: any) => v && v.id && v.status === 'approved' && v.isActive)
      .map((vendor: any) => ({
        id: vendor.id,
        doc: {
          id: vendor.id,
          businessName: vendor.businessName || vendor.name || '',
          description: vendor.description || vendor.about || '',
          roleId: vendor.roleId || vendor.role || '',
          role: vendor.role || '',
          location: vendor.latitude && vendor.longitude
            ? { lat: vendor.latitude, lon: vendor.longitude }
            : null,
          rating: vendor.rating || 0,
          price: vendor.consultationFee || vendor.basePrice || 0,
          tags: vendor.tags || [],
          services: vendor.services?.map((s: any) => s.name || s) || [],
          isActive: vendor.isActive || false,
          createdAt: vendor.createdAt || new Date().toISOString(),
        },
      }));

    if (documents.length > 0) {
      await esClient.bulkIndex('vendors', documents);
      console.log(`✅ [INDEXING] Indexed ${documents.length} vendors`);
    }
  } catch (error) {
    console.error('❌ [INDEXING] Error indexing vendors:', error);
    throw error;
  }
}

/**
 * Index all staff to Elasticsearch
 */
export async function indexAllStaff(): Promise<void> {
  const esClient = getElasticsearchClient();
  const isAvailable = await esClient.healthCheck();
  
  if (!isAvailable) {
    console.warn('⚠️ [INDEXING] Elasticsearch not available, skipping staff indexing');
    return;
  }

  try {
    console.log('📊 [INDEXING] Starting staff indexing...');
    const allStaff = await kv.getByPrefix('staff:');
    
    const documents = allStaff
      .filter((s: any) => s && s.id && s.isActive)
      .map((staff: any) => {
        const vendor = staff.vendorId ? await kv.get(`vendor:${staff.vendorId}`) : null;
        
        return {
          id: staff.id,
          doc: {
            id: staff.id,
            fullName: staff.fullName || staff.name || '',
            specialization: staff.specialization || '',
            vendorId: staff.vendorId || '',
            roleId: staff.roleId || vendor?.roleId || '',
            location: vendor?.latitude && vendor?.longitude
              ? { lat: vendor.latitude, lon: vendor.longitude }
              : null,
            consultationFee: staff.consultationFee || 0,
            rating: staff.rating || 0,
            experience: staff.experience || 0,
            isActive: staff.isActive || false,
            createdAt: staff.createdAt || new Date().toISOString(),
          },
        };
      });

    if (documents.length > 0) {
      await esClient.bulkIndex('staff', documents);
      console.log(`✅ [INDEXING] Indexed ${documents.length} staff members`);
    }
  } catch (error) {
    console.error('❌ [INDEXING] Error indexing staff:', error);
    throw error;
  }
}

/**
 * Index a single vendor
 */
export async function indexVendor(vendorId: string): Promise<void> {
  const esClient = getElasticsearchClient();
  const isAvailable = await esClient.healthCheck();
  
  if (!isAvailable) {
    return; // Silently fail if ES not available
  }

  try {
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor || vendor.status !== 'approved' || !vendor.isActive) {
      // Remove from index if not approved/active
      await esClient.delete('vendors', vendorId);
      return;
    }

    await esClient.index('vendors', vendorId, {
      id: vendor.id,
      businessName: vendor.businessName || vendor.name || '',
      description: vendor.description || vendor.about || '',
      roleId: vendor.roleId || vendor.role || '',
      role: vendor.role || '',
      location: vendor.latitude && vendor.longitude
        ? { lat: vendor.latitude, lon: vendor.longitude }
        : null,
      rating: vendor.rating || 0,
      price: vendor.consultationFee || vendor.basePrice || 0,
      tags: vendor.tags || [],
      services: vendor.services?.map((s: any) => s.name || s) || [],
      isActive: vendor.isActive || false,
      createdAt: vendor.createdAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error(`❌ [INDEXING] Error indexing vendor ${vendorId}:`, error);
  }
}

/**
 * Index a single staff member
 */
export async function indexStaff(staffId: string): Promise<void> {
  const esClient = getElasticsearchClient();
  const isAvailable = await esClient.healthCheck();
  
  if (!isAvailable) {
    return;
  }

  try {
    const staff = await kv.get(`staff:${staffId}`);
    if (!staff || !staff.isActive) {
      await esClient.delete('staff', staffId);
      return;
    }

    const vendor = staff.vendorId ? await kv.get(`vendor:${staff.vendorId}`) : null;
    
    await esClient.index('staff', staffId, {
      id: staff.id,
      fullName: staff.fullName || staff.name || '',
      specialization: staff.specialization || '',
      vendorId: staff.vendorId || '',
      roleId: staff.roleId || vendor?.roleId || '',
      location: vendor?.latitude && vendor?.longitude
        ? { lat: vendor.latitude, lon: vendor.longitude }
        : null,
      consultationFee: staff.consultationFee || 0,
      rating: staff.rating || 0,
      experience: staff.experience || 0,
      isActive: staff.isActive || false,
      createdAt: staff.createdAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error(`❌ [INDEXING] Error indexing staff ${staffId}:`, error);
  }
}

/**
 * Initialize and sync all indices
 */
export async function initializeAndSyncIndices(): Promise<void> {
  try {
    await initializeElasticsearchIndices();
    await indexAllVendors();
    await indexAllStaff();
    console.log('✅ [INDEXING] All indices initialized and synced');
  } catch (error) {
    console.error('❌ [INDEXING] Error initializing indices:', error);
  }
}

