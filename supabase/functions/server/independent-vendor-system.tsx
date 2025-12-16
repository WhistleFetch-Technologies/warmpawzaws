import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

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

export function independentVendorSystemEndpoints(app: Hono, kv: any) {
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

      await kv.set(`independent_vendor_${vendorId}`, vendor);

      // Store in vendor type index
      const typeIndex = await kv.get(`independent_vendor_index_${vendorType}`) || [];
      typeIndex.push(vendorId);
      await kv.set(`independent_vendor_index_${vendorType}`, typeIndex);

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

      const vendor = await kv.get(`independent_vendor_${vendorId}`);

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

      const vendor = await kv.get(`independent_vendor_${vendorId}`);

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

      await kv.set(`independent_vendor_${vendorId}`, updated);

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

      const vendorsData = await kv.getByPrefix('independent_vendor_');
      
      let vendors = vendorsData
        .map((item: any) => item.value || item)
        .filter((v: any) => v.isIndependent === true);

      // Apply filters
      if (vendorType) {
        vendors = vendors.filter((v: any) => v.vendorType === vendorType);
      }

      if (isApproved !== undefined) {
        const approvedFilter = isApproved === 'true';
        vendors = vendors.filter((v: any) => v.isApproved === approvedFilter);
      }

      if (isActive !== undefined) {
        const activeFilter = isActive === 'true';
        vendors = vendors.filter((v: any) => v.isActive === activeFilter);
      }

      // Sort by creation date (newest first)
      vendors.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

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

      const vendor = await kv.get(`independent_vendor_${vendorId}`);

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

      await kv.set(configId, config);

      // Add service to vendor's service list if not exists
      if (!vendor.services.includes(serviceType)) {
        vendor.services.push(serviceType);
        vendor.updatedAt = new Date().toISOString();
        await kv.set(`independent_vendor_${vendorId}`, vendor);
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

      const vendor = await kv.get(`independent_vendor_${vendorId}`);

      if (!vendor) {
        return sendError(c, 'Independent vendor not found', 404);
      }

      vendor.isApproved = isApproved;
      
      if (isApproved) {
        vendor.isActive = true; // Auto-activate on approval
      } else {
        vendor.rejectionReason = rejectionReason;
        vendor.isActive = false;
      }

      vendor.updatedAt = new Date().toISOString();

      await kv.set(`independent_vendor_${vendorId}`, vendor);

      const action = isApproved ? 'approved' : 'rejected';
      console.log(`✅ Independent vendor ${action}: ${vendorId}`);

      return sendSuccess(c, { vendor }, `Independent vendor ${action} successfully`);
    } catch (error) {
      console.error('Error approving/rejecting vendor:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Independent Vendor System endpoints registered');
}
