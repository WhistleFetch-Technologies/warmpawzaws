import { Hono } from "hono";

/**
 * Custom Service Endpoints
 * Handles vendor-created custom services for center-based vendors
 * RESTRICTION: Only available for serviceStyle = 'at_center' or 'both'
 */
export function customServiceEndpoints(app: Hono, kv: any) {

  // ============================================
  // GET CUSTOM SERVICES FOR VENDOR
  // ============================================

  /**
   * GET /vendor/:vendorId/custom-services
   * Load all custom services created by a vendor
   */
  app.get("/make-server-3dd53475/vendor/:vendorId/custom-services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`📋 Loading custom services for vendor: ${vendorId}`);
      
      // Load vendor to verify service style
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        console.log(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ CRITICAL: Check service style restriction
      // ❌ EXPLICITLY BLOCKED: at_home and tele service styles
      if (vendor.serviceStyle !== 'at_center' && vendor.serviceStyle !== 'both') {
        console.log(`❌ Custom services NOT allowed for service style: ${vendor.serviceStyle}`);
        console.log(`   ✅ ALLOWED: at_center, both`);
        console.log(`   ❌ BLOCKED: at_home, tele`);
        
        // Provide specific error message based on service style
        let errorMessage = 'Custom services are only available for center-based vendors';
        if (vendor.serviceStyle === 'at_home') {
          errorMessage = 'Custom services are only available for center-based vendors, not home service providers';
        } else if (vendor.serviceStyle === 'tele') {
          errorMessage = 'Custom services are only available for physical locations, not tele consultation services';
        }
        
        return c.json({ 
          error: errorMessage,
          serviceStyle: vendor.serviceStyle,
          allowed: false,
          allowedStyles: ['at_center', 'both'],
          blockedStyles: ['at_home', 'tele']
        }, 403);
      }
      
      console.log(`✅ Vendor ${vendorId} is eligible for custom services (serviceStyle: ${vendor.serviceStyle})`);
      
      // Load all custom services for this vendor
      const allCustomServices = await kv.getByPrefix(`custom-service:${vendorId}:`);
      
      console.log(`📦 Found ${allCustomServices.length} custom services`);
      
      // Sort by creation date (newest first)
      const sortedServices = allCustomServices.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      return c.json({
        success: true,
        services: sortedServices,
        vendorServiceStyle: vendor.serviceStyle
      });
      
    } catch (error) {
      console.error('❌ Error loading custom services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // CREATE CUSTOM SERVICE
  // ============================================

  /**
   * POST /vendor/:vendorId/custom-services
   * Create a new custom service (vendors with at_center or both only)
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/custom-services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const serviceData = await c.req.json();
      
      console.log(`💾 Creating custom service for vendor: ${vendorId}`);
      console.log(`   Service Name: ${serviceData.serviceName}`);
      
      // Load vendor to verify eligibility
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (!vendor) {
        console.log(`❌ Vendor not found: ${vendorId}`);
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ CRITICAL: Enforce service style restriction
      // ❌ EXPLICITLY BLOCKED: at_home and tele service styles  
      if (vendor.serviceStyle !== 'at_center' && vendor.serviceStyle !== 'both') {
        console.log(`❌ REJECTED: Custom services NOT allowed for serviceStyle: ${vendor.serviceStyle}`);
        console.log(`   ✅ ALLOWED: at_center, both`);
        console.log(`   ❌ BLOCKED: at_home, tele`);
        
        // Provide specific error message based on service style
        let errorMessage = 'Custom services are only available for center-based vendors';
        if (vendor.serviceStyle === 'at_home') {
          errorMessage = 'Custom services are only available for center-based vendors, not home service providers';
        } else if (vendor.serviceStyle === 'tele') {
          errorMessage = 'Custom services are only available for physical locations, not tele consultation services';
        }
        
        return c.json({ 
          error: errorMessage,
          serviceStyle: vendor.serviceStyle,
          allowed: false,
          allowedStyles: ['at_center', 'both'],
          blockedStyles: ['at_home', 'tele']
        }, 403);
      }
      
      console.log(`✅ Service style check passed: ${vendor.serviceStyle}`);
      
      // Validate required fields
      if (!serviceData.serviceName || !serviceData.description || !serviceData.categoryName) {
        return c.json({ 
          error: 'Missing required fields: serviceName, description, categoryName' 
        }, 400);
      }
      
      if (serviceData.isPackage) {
        if (!serviceData.packageDetails || 
            !serviceData.packageDetails.pricingBySize ||
            serviceData.packageDetails.pricingBySize.small <= 0) {
          return c.json({ 
            error: 'Package services must have valid pricing for all pet sizes' 
          }, 400);
        }
      } else {
        if (!serviceData.price || serviceData.price <= 0) {
          return c.json({ error: 'Price must be greater than 0' }, 400);
        }
      }
      
      if (!serviceData.duration || serviceData.duration <= 0) {
        return c.json({ error: 'Duration must be greater than 0' }, 400);
      }
      
      // Generate unique service ID
      const serviceId = `CS${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // Create custom service object
      const customService = {
        id: serviceId,
        vendorId,
        vendorName: vendor.fullName || vendor.businessName,
        roleName: vendor.roleName,
        roleId: vendor.roleId,
        serviceStyle: 'at_center', // Always at_center for custom services
        
        // Service details
        serviceName: serviceData.serviceName.trim(),
        description: serviceData.description.trim(),
        duration: serviceData.duration,
        price: serviceData.price || 0,
        categoryName: serviceData.categoryName.trim(),
        subCategoryName: serviceData.subCategoryName?.trim() || null,
        
        // Package details (if applicable)
        isPackage: serviceData.isPackage || false,
        packageDetails: serviceData.isPackage ? serviceData.packageDetails : null,
        
        // Additional details
        whatIncluded: serviceData.whatIncluded || [],
        whatNotIncluded: serviceData.whatNotIncluded || [],
        petTypes: serviceData.petTypes || ['dog', 'cat'],
        
        // Status and metadata
        publishStatus: 'draft', // Always start as draft
        isCustomService: true,
        isPlatformManaged: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: vendorId,
        
        // Approval tracking
        submittedForApprovalAt: null,
        approvedAt: null,
        approvedBy: null,
        rejectionReason: null,
        rejectedAt: null,
        rejectedBy: null
      };
      
      // Save custom service
      await kv.set(`custom-service:${vendorId}:${serviceId}`, customService);
      
      console.log(`✅ Custom service created: ${serviceId}`);
      console.log(`   Vendor: ${vendor.fullName || vendor.businessName}`);
      console.log(`   Service: ${customService.serviceName}`);
      console.log(`   Category: ${customService.categoryName}`);
      console.log(`   Status: draft`);
      
      return c.json({
        success: true,
        service: customService,
        message: 'Custom service created successfully. Submit for approval to make it live.'
      });
      
    } catch (error) {
      console.error('❌ Error creating custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // PUBLISH CUSTOM SERVICE (Submit for Approval)
  // ============================================

  /**
   * POST /vendor/:vendorId/custom-services/:serviceId/publish
   * Submit custom service for admin approval
   */
  app.post("/make-server-3dd53475/vendor/:vendorId/custom-services/:serviceId/publish", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      
      console.log(`📤 Publishing custom service: ${serviceId} for vendor: ${vendorId}`);
      
      // Load custom service
      const service = await kv.get(`custom-service:${vendorId}:${serviceId}`);
      
      if (!service) {
        console.log(`❌ Custom service not found: ${serviceId}`);
        return c.json({ error: 'Custom service not found' }, 404);
      }
      
      // Check if already published or pending
      if (service.publishStatus === 'published') {
        return c.json({ error: 'Service is already published' }, 400);
      }
      
      if (service.publishStatus === 'pending_approval') {
        return c.json({ error: 'Service is already pending approval' }, 400);
      }
      
      // Update status to pending approval
      service.publishStatus = 'pending_approval';
      service.submittedForApprovalAt = new Date().toISOString();
      service.updatedAt = new Date().toISOString();
      
      await kv.set(`custom-service:${vendorId}:${serviceId}`, service);
      
      // Add to pending approval queue
      const pendingQueue = await kv.get('custom-services:pending-approval') || [];
      if (!pendingQueue.includes(serviceId)) {
        pendingQueue.push(serviceId);
        await kv.set('custom-services:pending-approval', pendingQueue);
      }
      
      console.log(`✅ Custom service submitted for approval: ${serviceId}`);
      console.log(`   Service: ${service.serviceName}`);
      console.log(`   Vendor: ${service.vendorName}`);
      console.log(`   Status: pending_approval`);
      
      return c.json({
        success: true,
        service,
        message: 'Service submitted for admin approval'
      });
      
    } catch (error) {
      console.error('❌ Error publishing custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // DELETE CUSTOM SERVICE
  // ============================================

  /**
   * DELETE /vendor/:vendorId/custom-services/:serviceId
   * Delete a custom service (only if draft or rejected)
   */
  app.delete("/make-server-3dd53475/vendor/:vendorId/custom-services/:serviceId", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      
      console.log(`🗑️ Deleting custom service: ${serviceId} for vendor: ${vendorId}`);
      
      // Load custom service
      const service = await kv.get(`custom-service:${vendorId}:${serviceId}`);
      
      if (!service) {
        console.log(`❌ Custom service not found: ${serviceId}`);
        return c.json({ error: 'Custom service not found' }, 404);
      }
      
      // Only allow deletion of draft or rejected services
      if (service.publishStatus === 'published') {
        return c.json({ 
          error: 'Cannot delete published services. Please contact admin.' 
        }, 400);
      }
      
      if (service.publishStatus === 'pending_approval') {
        return c.json({ 
          error: 'Cannot delete services pending approval. Wait for admin review or contact support.' 
        }, 400);
      }
      
      // Delete the service
      await kv.del(`custom-service:${vendorId}:${serviceId}`);
      
      console.log(`✅ Custom service deleted: ${serviceId}`);
      
      return c.json({
        success: true,
        message: 'Custom service deleted successfully'
      });
      
    } catch (error) {
      console.error('❌ Error deleting custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // ADMIN - GET ALL PENDING CUSTOM SERVICES
  // ============================================

  /**
   * GET /admin/custom-services/pending
   * Get all custom services pending approval
   */
  app.get("/make-server-3dd53475/admin/custom-services/pending", async (c) => {
    try {
      console.log('📋 Admin: Loading pending custom services...');
      
      // Get all custom services with pending status
      const allCustomServices = await kv.getByPrefix('custom-service:');
      
      const pendingServices = allCustomServices.filter(
        service => service.publishStatus === 'pending_approval'
      );
      
      console.log(`📦 Found ${pendingServices.length} custom services pending approval`);
      
      // Sort by submission date (oldest first for FIFO processing)
      const sortedServices = pendingServices.sort((a, b) => {
        const dateA = new Date(a.submittedForApprovalAt || a.createdAt).getTime();
        const dateB = new Date(b.submittedForApprovalAt || b.createdAt).getTime();
        return dateA - dateB;
      });
      
      return c.json({
        success: true,
        services: sortedServices,
        count: sortedServices.length
      });
      
    } catch (error) {
      console.error('❌ Error loading pending custom services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // ADMIN - APPROVE CUSTOM SERVICE
  // ============================================

  /**
   * POST /admin/custom-services/:serviceId/approve
   * Approve a custom service for publishing
   */
  app.post("/make-server-3dd53475/admin/custom-services/:serviceId/approve", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const { adminId, adminName } = await c.req.json();
      
      console.log(`✅ Admin approving custom service: ${serviceId}`);
      console.log(`   Admin: ${adminName} (${adminId})`);
      
      // Find the service across all vendors
      const allServices = await kv.getByPrefix('custom-service:');
      const service = allServices.find(s => s.id === serviceId);
      
      if (!service) {
        console.log(`❌ Custom service not found: ${serviceId}`);
        return c.json({ error: 'Custom service not found' }, 404);
      }
      
      if (service.publishStatus !== 'pending_approval') {
        return c.json({ 
          error: `Cannot approve service with status: ${service.publishStatus}` 
        }, 400);
      }
      
      // Update service status
      service.publishStatus = 'published';
      service.approvedAt = new Date().toISOString();
      service.approvedBy = adminId;
      service.approvedByName = adminName;
      service.updatedAt = new Date().toISOString();
      service.rejectionReason = null; // Clear any previous rejection
      
      // Save updated service
      await kv.set(`custom-service:${service.vendorId}:${serviceId}`, service);
      
      // Remove from pending queue
      const pendingQueue = await kv.get('custom-services:pending-approval') || [];
      const updatedQueue = pendingQueue.filter((id: string) => id !== serviceId);
      await kv.set('custom-services:pending-approval', updatedQueue);
      
      console.log(`✅ Custom service approved and published: ${serviceId}`);
      console.log(`   Service: ${service.serviceName}`);
      console.log(`   Vendor: ${service.vendorName}`);
      console.log(`   Approved by: ${adminName}`);
      
      // TODO: Send notification to vendor (Phase 2)
      
      return c.json({
        success: true,
        service,
        message: 'Custom service approved and published successfully'
      });
      
    } catch (error) {
      console.error('❌ Error approving custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // ADMIN - REJECT CUSTOM SERVICE
  // ============================================

  /**
   * POST /admin/custom-services/:serviceId/reject
   * Reject a custom service with reason
   */
  app.post("/make-server-3dd53475/admin/custom-services/:serviceId/reject", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const { adminId, adminName, rejectionReason } = await c.req.json();
      
      console.log(`❌ Admin rejecting custom service: ${serviceId}`);
      console.log(`   Admin: ${adminName} (${adminId})`);
      console.log(`   Reason: ${rejectionReason}`);
      
      if (!rejectionReason || rejectionReason.trim() === '') {
        return c.json({ error: 'Rejection reason is required' }, 400);
      }
      
      // Find the service across all vendors
      const allServices = await kv.getByPrefix('custom-service:');
      const service = allServices.find(s => s.id === serviceId);
      
      if (!service) {
        console.log(`❌ Custom service not found: ${serviceId}`);
        return c.json({ error: 'Custom service not found' }, 404);
      }
      
      if (service.publishStatus !== 'pending_approval') {
        return c.json({ 
          error: `Cannot reject service with status: ${service.publishStatus}` 
        }, 400);
      }
      
      // Update service status
      service.publishStatus = 'rejected';
      service.rejectedAt = new Date().toISOString();
      service.rejectedBy = adminId;
      service.rejectedByName = adminName;
      service.rejectionReason = rejectionReason.trim();
      service.updatedAt = new Date().toISOString();
      
      // Save updated service
      await kv.set(`custom-service:${service.vendorId}:${serviceId}`, service);
      
      // Remove from pending queue
      const pendingQueue = await kv.get('custom-services:pending-approval') || [];
      const updatedQueue = pendingQueue.filter((id: string) => id !== serviceId);
      await kv.set('custom-services:pending-approval', updatedQueue);
      
      console.log(`✅ Custom service rejected: ${serviceId}`);
      console.log(`   Service: ${service.serviceName}`);
      console.log(`   Vendor: ${service.vendorName}`);
      console.log(`   Rejected by: ${adminName}`);
      
      // TODO: Send notification to vendor (Phase 2)
      
      return c.json({
        success: true,
        service,
        message: 'Custom service rejected'
      });
      
    } catch (error) {
      console.error('❌ Error rejecting custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // GET PUBLISHED CUSTOM SERVICES (Customer View)
  // ============================================

  /**
   * GET /custom-services/published
   * Get all published custom services for customer browsing
   * Can filter by category, vendor, location, etc.
   */
  app.get("/make-server-3dd53475/custom-services/published", async (c) => {
    try {
      const { categoryName, vendorId, petType, city } = c.req.query();
      
      console.log(`🔍 Loading published custom services...`);
      if (categoryName) console.log(`   Filter: category=${categoryName}`);
      if (vendorId) console.log(`   Filter: vendorId=${vendorId}`);
      if (petType) console.log(`   Filter: petType=${petType}`);
      if (city) console.log(`   Filter: city=${city}`);
      
      // Get all custom services
      const allCustomServices = await kv.getByPrefix('custom-service:');
      
      // Filter published services
      let publishedServices = allCustomServices.filter(
        service => service.publishStatus === 'published'
      );
      
      // Apply filters
      if (categoryName) {
        publishedServices = publishedServices.filter(
          s => s.categoryName.toLowerCase() === categoryName.toLowerCase()
        );
      }
      
      if (vendorId) {
        publishedServices = publishedServices.filter(
          s => s.vendorId === vendorId
        );
      }
      
      if (petType) {
        publishedServices = publishedServices.filter(
          s => s.petTypes && s.petTypes.includes(petType.toLowerCase())
        );
      }
      
      if (city) {
        // Load vendor data to check city
        const servicesWithCity = [];
        for (const service of publishedServices) {
          const vendor = await kv.get(`vendor:${service.vendorId}`);
          if (vendor && vendor.city && vendor.city.toLowerCase() === city.toLowerCase()) {
            servicesWithCity.push({
              ...service,
              vendorCity: vendor.city,
              vendorAddress: vendor.address
            });
          }
        }
        publishedServices = servicesWithCity;
      }
      
      console.log(`📦 Found ${publishedServices.length} published custom services`);
      
      return c.json({
        success: true,
        services: publishedServices,
        count: publishedServices.length
      });
      
    } catch (error) {
      console.error('❌ Error loading published custom services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}