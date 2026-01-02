// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import {
  getVendorsRepository,
  getIntegratedServicesRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

/**
 * 🏪 INDEPENDENT VENDOR SYSTEM
 * 
 * Phase 7C: Integrated Services - Rule 6 Implementation
 * 
 * Features:
 * - Independent vendor onboarding
 * - Ambulance, Pharmacy, Diagnostics vendor support
 * - Service configuration
 * - Logistics partner association
 */

interface IndependentVendor {
  vendorId: string;
  vendorName: string;
  vendorType: 'ambulance' | 'pharmacy' | 'diagnostics';
  isIndependent: boolean;
  location: { lat: number; lng: number; address: string };
  services: string[];
  operatingHours: {
    open: string;
    close: string;
    days: string[];
  };
  contactInfo: {
    phone: string;
    email: string;
    emergencyContact: string;
  };
  logisticsPartner?: string;
  isApproved: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function independentVendorSystemEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

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

      const vendorId = `indv_${vendorType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const vendor: IndependentVendor = {
        vendorId,
        vendorName,
        vendorType,
        isIndependent: true,
        location,
        services: services || [],
        operatingHours: operatingHours || {
          open: '00:00',
          close: '23:59',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        },
        contactInfo,
        logisticsPartner,
        isApproved: false, // Requires admin approval
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // ✅ SQL: Create independent vendor
      const integratedServicesRepo = getIntegratedServicesRepository();
      await integratedServicesRepo.create({
        id: vendorId,
        vendor_name: vendorName,
        vendor_type: vendorType,
        is_independent: true,
        location: JSON.stringify(location),
        services: services || [],
        operating_hours: JSON.stringify(operatingHours || {
          open: '00:00',
          close: '23:59',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        }),
        contact_info: JSON.stringify(contactInfo),
        logistics_partner: logisticsPartner || null,
        is_approved: false,
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      console.log(`✅ Independent vendor onboarded: ${vendorId} (${vendorType})`);

      return sendSuccess(c, { vendor }, 'Independent vendor onboarded successfully. Awaiting approval.');
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

      // ✅ SQL: Get independent vendor
      const integratedServicesRepo = getIntegratedServicesRepository();
      const vendor = await integratedServicesRepo.findById(vendorId);

      if (!vendor) {
        return sendError(c, 'Independent vendor not found', 404);
      }

      return sendSuccess(c, { vendor });
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

      // ✅ SQL: Get independent vendor
      const integratedServicesRepo = getIntegratedServicesRepository();
      const vendor = await integratedServicesRepo.findById(vendorId);

      if (!vendor) {
        return sendError(c, 'Independent vendor not found', 404);
      }

      const updated: IndependentVendor = {
        ...vendor,
        vendorName: updates.vendorName || vendor.vendorName,
        location: updates.location || vendor.location,
        services: updates.services || vendor.services,
        operatingHours: updates.operatingHours || vendor.operatingHours,
        contactInfo: updates.contactInfo || vendor.contactInfo,
        logisticsPartner: updates.logisticsPartner !== undefined ? updates.logisticsPartner : vendor.logisticsPartner,
        isActive: updates.isActive !== undefined ? updates.isActive : vendor.isActive,
        updatedAt: new Date().toISOString(),
      };

      // ✅ SQL: Update independent vendor
      await integratedServicesRepo.update(vendorId, {
        vendor_name: updates.vendorName || vendor.vendor_name,
        location: updates.location ? JSON.stringify(updates.location) : vendor.location,
        services: updates.services || vendor.services,
        operating_hours: updates.operatingHours ? JSON.stringify(updates.operatingHours) : vendor.operating_hours,
        contact_info: updates.contactInfo ? JSON.stringify(updates.contactInfo) : vendor.contact_info,
        logistics_partner: updates.logisticsPartner !== undefined ? updates.logisticsPartner : vendor.logistics_partner,
        is_active: updates.isActive !== undefined ? updates.isActive : vendor.is_active,
        updated_at: new Date().toISOString()
      });
      
      const updated = await integratedServicesRepo.findById(vendorId);

      console.log(`✅ Independent vendor updated: ${vendorId}`);

      return sendSuccess(c, { vendor: updated }, 'Independent vendor updated successfully');
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

      // ✅ SQL: Get all independent vendors
      const integratedServicesRepo = getIntegratedServicesRepository();
      let vendors = await integratedServicesRepo.findAll();
      vendors = vendors.filter((v: any) => v.is_independent === true || v.isIndependent === true);

      // Apply filters
      if (vendorType) {
        vendors = vendors.filter((v: any) => (v.vendor_type || v.vendorType) === vendorType);
      }

      if (isApproved !== undefined) {
        const approvedFilter = isApproved === 'true';
        vendors = vendors.filter((v: any) => (v.is_approved !== undefined ? v.is_approved : v.isApproved) === approvedFilter);
      }

      if (isActive !== undefined) {
        const activeFilter = isActive === 'true';
        vendors = vendors.filter((v: any) => (v.is_active !== undefined ? v.is_active : v.isActive) === activeFilter);
      }

      // Sort by creation date (newest first)
      vendors.sort((a: any, b: any) => {
        const aDate = a.created_at || a.createdAt;
        const bDate = b.created_at || b.createdAt;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

      return sendSuccess(c, { vendors, count: vendors.length });
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

      // ✅ SQL: Get independent vendor
      const integratedServicesRepo = getIntegratedServicesRepository();
      const vendor = await integratedServicesRepo.findById(vendorId);

      if (!vendor) {
        return sendError(c, 'Independent vendor not found', 404);
      }

      // Store service configuration
      const configId = `service_config_${vendorId}_${serviceType}`;
      
      const config = {
        vendorId,
        serviceType,
        ...serviceConfig,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // ✅ SQL: Store service configuration
      await integratedServicesRepo.updateServiceConfig(vendorId, serviceType, serviceConfig);

      // ✅ SQL: Add service to vendor's service list if not exists
      const currentServices = vendor.services || [];
      if (!currentServices.includes(serviceType)) {
        await integratedServicesRepo.update(vendorId, {
          services: [...currentServices, serviceType],
          updated_at: new Date().toISOString()
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

      // ✅ SQL: Get independent vendor
      const integratedServicesRepo = getIntegratedServicesRepository();
      const vendor = await integratedServicesRepo.findById(vendorId);

      if (!vendor) {
        return sendError(c, 'Independent vendor not found', 404);
      }

      // ✅ SQL: Update vendor approval status
      const updateData: any = {
        is_approved: isApproved,
        updated_at: new Date().toISOString()
      };
      
      if (isApproved) {
        updateData.is_active = true; // Auto-activate on approval
      } else {
        updateData.rejection_reason = rejectionReason;
        updateData.is_active = false;
      }

      await integratedServicesRepo.update(vendorId, updateData);
      const updatedVendor = await integratedServicesRepo.findById(vendorId);

      const action = isApproved ? 'approved' : 'rejected';
      console.log(`✅ Independent vendor ${action}: ${vendorId}`);

      return sendSuccess(c, { vendor: updatedVendor }, `Independent vendor ${action} successfully`);
    } catch (error) {
      console.error('Error approving/rejecting vendor:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Independent Vendor System endpoints registered');
}
