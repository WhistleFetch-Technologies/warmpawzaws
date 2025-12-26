/**
 * ============================================================================
 * INDEPENDENT VENDOR SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Phase 7C: Integrated Services - Rule 6 Implementation
 * 
 * Features:
 * - Independent vendor onboarding
 * - Ambulance, Pharmacy, Diagnostics vendor support
 * - Service configuration
 * - Logistics partner association
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `vendors` table for vendor data
 * - Uses `platform_settings` for service configurations
 * 
 * Date: 2025-01-28
 * Migration: Batch 9 - 12 KV operations → 0
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { upsertQuery } from '../../lib/db.ts';

export function independentVendorSystemEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const db = getDbClient();
  const vendorsRepo = getVendorsRepository();

  // ========================================
  // ONBOARD INDEPENDENT VENDOR
  // ========================================
  app.post(`${BASE_PATH}/integrated-services/vendor/onboard-independent`, async (c) => {
    try {
      const {
        vendorName,
        vendorType,
        location,
        services,
        operatingHours,
        contactInfo,
        logisticsPartner,
      } = await c.req.json();

      if (!vendorName || !vendorType || !location || !contactInfo) {
        return sendError(c, 'Required fields missing', 400);
      }

      // Validate vendor type
      const validTypes = ['ambulance', 'pharmacy', 'diagnostics'];
      if (!validTypes.includes(vendorType)) {
        return sendError(c, `Invalid vendor type. Must be one of: ${validTypes.join(', ')}`, 400);
      }

      const now = new Date().toISOString();

      // ✅ SQL: Create vendor record
      const vendor = await vendorsRepo.create({
        business_name: vendorName,
        owner_name: contactInfo.emergencyContact || contactInfo.phone,
        phone: contactInfo.phone,
        email: contactInfo.email || '',
        address: location.address,
        city: location.city || '',
        state: location.state || '',
        pincode: location.pincode || '',
        latitude: location.lat,
        longitude: location.lng,
        category: vendorType,
        status: 'pending', // Requires admin approval
        is_active: false,
        operating_hours: JSON.stringify(operatingHours || {
          open: '00:00',
          close: '23:59',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        }),
        specialization: services?.join(', ') || '',
        metadata: {
          isIndependent: true,
          vendorType,
          services: services || [],
          operatingHours: operatingHours || {},
          contactInfo,
          logisticsPartner
        }
      });

      // ✅ SQL: Store in vendor type index (platform_settings)
      const { data: typeIndexData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `independent_vendor_index:${vendorType}`)
        .maybeSingle();

      const typeIndex = typeIndexData?.setting_value?.vendorIds || [];
      typeIndex.push(vendor.id);

      await upsertQuery('platform_settings', {
        setting_key: `independent_vendor_index:${vendorType}`,
        setting_value: { vendorIds: typeIndex },
        setting_type: 'object',
        updated_at: now
      }, 'setting_key');

      console.log(`✅ Independent vendor onboarded: ${vendor.id} (${vendorType})`);

      return sendSuccess(c, { 
        vendor: {
          vendorId: vendor.id,
          vendorName: vendor.business_name,
          vendorType,
          isIndependent: true,
          isApproved: false,
          isActive: false
        }
      }, 'Independent vendor onboarded successfully. Awaiting approval.');
    } catch (error) {
      console.error('Error onboarding independent vendor:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET INDEPENDENT VENDOR
  // ========================================
  app.get(`${BASE_PATH}/integrated-services/vendor/independent/:vendorId`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);

      if (!vendor) {
        return sendError(c, 'Independent vendor not found', 404);
      }

      // Check if it's an independent vendor
      if (!vendor.metadata?.isIndependent) {
        return sendError(c, 'Vendor is not an independent vendor', 400);
      }

      return sendSuccess(c, { 
        vendor: {
          vendorId: vendor.id,
          vendorName: vendor.business_name,
          vendorType: vendor.metadata?.vendorType || vendor.category,
          isIndependent: true,
          location: {
            lat: vendor.latitude,
            lng: vendor.longitude,
            address: vendor.address
          },
          services: vendor.metadata?.services || [],
          operatingHours: vendor.metadata?.operatingHours || {},
          contactInfo: vendor.metadata?.contactInfo || {},
          logisticsPartner: vendor.metadata?.logisticsPartner,
          isApproved: vendor.status === 'approved',
          isActive: vendor.is_active,
          createdAt: vendor.created_at,
          updatedAt: vendor.updated_at
        }
      });
    } catch (error) {
      console.error('Error getting independent vendor:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // UPDATE INDEPENDENT VENDOR
  // ========================================
  app.put(`${BASE_PATH}/integrated-services/vendor/independent/:vendorId`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const updates = await c.req.json();

      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);

      if (!vendor) {
        return sendError(c, 'Independent vendor not found', 404);
      }

      // Update vendor fields
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.vendorName) updateData.business_name = updates.vendorName;
      if (updates.location) {
        updateData.address = updates.location.address;
        updateData.latitude = updates.location.lat;
        updateData.longitude = updates.location.lng;
        if (updates.location.city) updateData.city = updates.location.city;
        if (updates.location.state) updateData.state = updates.location.state;
        if (updates.location.pincode) updateData.pincode = updates.location.pincode;
      }
      if (updates.contactInfo) {
        if (updates.contactInfo.phone) updateData.phone = updates.contactInfo.phone;
        if (updates.contactInfo.email) updateData.email = updates.contactInfo.email;
      }
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

      // Update metadata
      const metadata = vendor.metadata || {};
      if (updates.services) {
        metadata.services = updates.services;
        updateData.specialization = updates.services.join(', ');
      }
      if (updates.operatingHours) {
        metadata.operatingHours = updates.operatingHours;
        updateData.operating_hours = JSON.stringify(updates.operatingHours);
      }
      if (updates.contactInfo) metadata.contactInfo = { ...metadata.contactInfo, ...updates.contactInfo };
      if (updates.logisticsPartner !== undefined) metadata.logisticsPartner = updates.logisticsPartner;

      updateData.metadata = metadata;

      // ✅ SQL: Update vendor
      const updated = await vendorsRepo.update(vendorId, updateData);

      console.log(`✅ Independent vendor updated: ${vendorId}`);

      return sendSuccess(c, { 
        vendor: {
          vendorId: updated.id,
          vendorName: updated.business_name,
          isActive: updated.is_active,
          updatedAt: updated.updated_at
        }
      }, 'Independent vendor updated successfully');
    } catch (error) {
      console.error('Error updating independent vendor:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // LIST INDEPENDENT VENDORS
  // ========================================
  app.get(`${BASE_PATH}/integrated-services/vendor/independent/list`, async (c) => {
    try {
      const vendorType = c.req.query('type');
      const isApproved = c.req.query('approved');
      const isActive = c.req.query('active');

      // ✅ SQL: Get all vendors with independent flag
      let query = db
        .from('vendors')
        .select('*');

      // Filter by independent vendors (metadata.isIndependent = true)
      // Since we can't filter JSONB directly in all cases, we'll fetch and filter
      const { data: vendorsData, error } = await query;

      if (error) throw error;

      let vendors = (vendorsData || []).filter((v: any) => v.metadata?.isIndependent === true);

      // Apply filters
      if (vendorType) {
        vendors = vendors.filter((v: any) => 
          (v.metadata?.vendorType || v.category) === vendorType
        );
      }

      if (isApproved !== undefined) {
        const approvedFilter = isApproved === 'true';
        vendors = vendors.filter((v: any) => 
          (approvedFilter && v.status === 'approved') || (!approvedFilter && v.status !== 'approved')
        );
      }

      if (isActive !== undefined) {
        const activeFilter = isActive === 'true';
        vendors = vendors.filter((v: any) => v.is_active === activeFilter);
      }

      // Sort by creation date (newest first)
      vendors.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const formattedVendors = vendors.map((v: any) => ({
        vendorId: v.id,
        vendorName: v.business_name,
        vendorType: v.metadata?.vendorType || v.category,
        isIndependent: true,
        location: {
          lat: v.latitude,
          lng: v.longitude,
          address: v.address
        },
        services: v.metadata?.services || [],
        operatingHours: v.metadata?.operatingHours || {},
        contactInfo: v.metadata?.contactInfo || {},
        logisticsPartner: v.metadata?.logisticsPartner,
        isApproved: v.status === 'approved',
        isActive: v.is_active,
        createdAt: v.created_at,
        updatedAt: v.updated_at
      }));

      return sendSuccess(c, { vendors: formattedVendors, count: formattedVendors.length });
    } catch (error) {
      console.error('Error listing independent vendors:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // CONFIGURE VENDOR SERVICE
  // ========================================
  app.post(`${BASE_PATH}/integrated-services/vendor/service-config`, async (c) => {
    try {
      const {
        vendorId,
        serviceType,
        serviceConfig,
      } = await c.req.json();

      if (!vendorId || !serviceType || !serviceConfig) {
        return sendError(c, 'Required fields missing', 400);
      }

      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);

      if (!vendor) {
        return sendError(c, 'Independent vendor not found', 404);
      }

      // ✅ SQL: Store service configuration in platform_settings
      const configId = `service_config:${vendorId}:${serviceType}`;
      const now = new Date().toISOString();

      const config = {
        vendorId,
        serviceType,
        ...serviceConfig,
        createdAt: now,
        updatedAt: now
      };

      await upsertQuery('platform_settings', {
        setting_key: configId,
        setting_value: config,
        setting_type: 'object',
        updated_at: now
      }, 'setting_key');

      // Add service to vendor's service list if not exists
      const metadata = vendor.metadata || {};
      const services = metadata.services || [];
      if (!services.includes(serviceType)) {
        services.push(serviceType);
        metadata.services = services;

        await vendorsRepo.update(vendorId, {
          metadata,
          specialization: services.join(', ')
        });
      }

      console.log(`✅ Service config created: ${configId}`);

      return sendSuccess(c, { config }, 'Service configuration saved successfully');
    } catch (error) {
      console.error('Error configuring service:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // APPROVE/REJECT INDEPENDENT VENDOR (Admin)
  // ========================================
  app.post(`${BASE_PATH}/integrated-services/vendor/independent/:vendorId/approve`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const { isApproved, rejectionReason } = await c.req.json();

      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);

      if (!vendor) {
        return sendError(c, 'Independent vendor not found', 404);
      }

      const updateData: any = {
        status: isApproved ? 'approved' : 'rejected',
        is_active: isApproved,
        updated_at: new Date().toISOString()
      };

      if (isApproved) {
        updateData.approved_at = new Date().toISOString();
      } else {
        // Store rejection reason in metadata
        const metadata = vendor.metadata || {};
        metadata.rejectionReason = rejectionReason;
        updateData.metadata = metadata;
      }

      // ✅ SQL: Update vendor
      const updated = await vendorsRepo.update(vendorId, updateData);

      const action = isApproved ? 'approved' : 'rejected';
      console.log(`✅ Independent vendor ${action}: ${vendorId}`);

      return sendSuccess(c, { 
        vendor: {
          vendorId: updated.id,
          isApproved: updated.status === 'approved',
          isActive: updated.is_active
        }
      }, `Independent vendor ${action} successfully`);
    } catch (error) {
      console.error('Error approving/rejecting vendor:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Independent Vendor System endpoints registered (SQL-only)');
}
