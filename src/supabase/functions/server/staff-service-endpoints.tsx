/**
 * STAFF SERVICE MANAGEMENT ENDPOINTS
 * Handles staff service assignment, custom service creation, and location management
 */

import { Hono } from 'npm:hono@4';

export function staffServiceEndpoints(app: Hono, kvStore: any) {
  
  // ============================================
  // STAFF SERVICE MANAGEMENT
  // ============================================

  /**
   * Get all services for a staff member
   * GET /make-server-3dd53475/staff/:staffId/services
   * Returns services from both staff:${staffId}:service: prefix and staff.services array
   */
  app.get('/make-server-3dd53475/staff/:staffId/services', async (c) => {
    try {
      const { staffId } = c.req.param();
      
      console.log('📋 [STAFF-SERVICE] Fetching services for staff:', staffId);
      
      // Get staff record
      const staff = await kvStore.get(`staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      // Get staff services from KV store (staff:${staffId}:service: prefix)
      const prefixServices = await kvStore.getByPrefix(`staff:${staffId}:service:`) || [];
      
      // Get services from staff.services array (legacy/alternative format)
      const arrayServices = (staff.services && Array.isArray(staff.services)) ? staff.services : [];
      
      // Combine and deduplicate by serviceId
      const allServices = new Map();
      
      // Add prefix services first
      for (const service of prefixServices) {
        const serviceId = service.serviceId || service.id;
        if (serviceId && !allServices.has(serviceId)) {
          allServices.set(serviceId, service);
        }
      }
      
      // Add array services (prefer prefix if duplicate)
      for (const service of arrayServices) {
        const serviceId = service.serviceId || service.id;
        if (serviceId && !allServices.has(serviceId)) {
          allServices.set(serviceId, service);
        }
      }
      
      const uniqueServices = Array.from(allServices.values());
      
      console.log('✅ [STAFF-SERVICE] Found services:', {
        prefix: prefixServices.length,
        array: arrayServices.length,
        unique: uniqueServices.length
      });
      
      return c.json({
        success: true,
        services: uniqueServices,
        count: uniqueServices.length
      });
    } catch (error) {
      console.error('❌ [STAFF-SERVICE] Error fetching services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Add clinic service to staff
   * POST /make-server-3dd53475/staff/:staffId/services/add-clinic-service
   */
  app.post('/make-server-3dd53475/staff/:staffId/services/add-clinic-service', async (c) => {
    try {
      const { staffId } = c.req.param();
      const { serviceId, serviceName, category, categoryName, price, duration, description, serviceStyle } = await c.req.json();
      
      console.log('➕ [STAFF-SERVICE] Adding clinic service to staff:', { staffId, serviceName });
      
      // Get staff profile
      const staff = await kvStore.get(`staff:${staffId}`);
      
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      // Check if service already assigned
      const existingServices = await kvStore.getByPrefix(`staff:${staffId}:service:`);
      const alreadyExists = existingServices.some((s: any) => s.serviceId === serviceId);
      
      if (alreadyExists) {
        return c.json({ error: 'Service already assigned to staff' }, 400);
      }
      
      // Create staff service record
      const staffServiceId = `staffsvc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 9)}`;
      
      const staffService = {
        id: staffServiceId,
        staffId,
        serviceId, // Reference to clinic's service
        serviceName,
        category,
        categoryName,
        price,
        duration,
        description,
        serviceStyle, // 'at_home', 'at_center', 'tele'
        
        // Staff service metadata
        isCustom: false, // This is from clinic
        clinicName: staff.clinicName || 'Clinic',
        vendorId: staff.vendorId,
        
        // Status
        isActive: true,
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save to KV store - ONLY save once with the staff prefix
      await kvStore.set(`staff:${staffId}:service:${staffServiceId}`, staffService);
      
      // ✅ PERSISTENCE VERIFICATION
      const verifyService = await kvStore.get(`staff:${staffId}:service:${staffServiceId}`);
      if (verifyService) {
        console.log(`   ✅ PERSISTENCE VERIFIED: Staff service successfully persisted`);
      } else {
        console.error(`   ❌ PERSISTENCE FAILED: Staff service not found after save`);
        console.error(`      - Expected key: staff:${staffId}:service:${staffServiceId}`);
      }
      
      // ✅ AUTO-ENABLE SERVICE STYLE: When adding a service, automatically enable and make available the service style
      if (serviceStyle && ['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        try {
          let preferences = await kvStore.get(`staff:${staffId}:style_preferences`);
          
          // Create default preferences if they don't exist
          if (!preferences) {
            preferences = {
              staffId,
              at_center: { enabled: true, available: true },
              at_home: { enabled: false, available: false, maxDistance: 10, travelChargePerKm: 0, acceptInstantBooking: true },
              tele: { enabled: false, available: false, videoEnabled: true, chatEnabled: true, maxSessionDuration: 30, acceptInstantBooking: false },
              autoAcceptBookings: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
          }
          
          // Enable and make available the service style
          if (preferences[serviceStyle]) {
            const wasEnabled = preferences[serviceStyle].enabled;
            preferences[serviceStyle].enabled = true;
            preferences[serviceStyle].available = true;
            preferences.updatedAt = new Date().toISOString();
            
            await kvStore.set(`staff:${staffId}:style_preferences`, preferences);
            
            if (!wasEnabled) {
              console.log(`🎨 [STAFF-SERVICE] Auto-enabled ${serviceStyle} for staff ${staffId}`);
            }
          }
        } catch (prefError) {
          console.error('⚠️  [STAFF-SERVICE] Failed to auto-enable service style:', prefError);
          // Don't fail the whole operation if style preference update fails
        }
      }
      
      console.log('✅ [STAFF-SERVICE] Clinic service added to staff:', staffServiceId);
      
      return c.json({
        success: true,
        service: staffService
      });
    } catch (error) {
      console.error('❌ [STAFF-SERVICE] Error adding clinic service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Create custom service for staff
   * POST /make-server-3dd53475/staff/:staffId/services/create-custom
   * ✅ RESTRICTION: Custom services only for at_center service style
   * ✅ REQUIREMENT: Approval required for custom services
   */
  app.post('/make-server-3dd53475/staff/:staffId/services/create-custom', async (c) => {
    try {
      const { staffId } = c.req.param();
      const { serviceName, category, price, duration, description, serviceStyle } = await c.req.json();
      
      console.log('➕ [STAFF-SERVICE] Creating custom service for staff:', { staffId, serviceName });
      
      // Get staff profile
      const staff = await kvStore.get(`staff:${staffId}`);
      
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      // ✅ BUSINESS RULE: Custom services only for at_center
      const effectiveServiceStyle = serviceStyle || 'at_center';
      if (effectiveServiceStyle !== 'at_center') {
        return c.json({ 
          error: 'Custom services are only available for at_center service style',
          serviceStyle: effectiveServiceStyle,
          allowed: ['at_center']
        }, 400);
      }
      
      // Get vendor to check service style
      const vendorId = staff.vendorId;
      if (vendorId) {
        const vendor = await kvStore.get(`vendor:${vendorId}`);
        if (vendor && vendor.serviceStyle) {
          if (vendor.serviceStyle !== 'at_center' && vendor.serviceStyle !== 'both') {
            return c.json({ 
              error: 'Custom services are only available for vendors with at_center or both service styles',
              vendorServiceStyle: vendor.serviceStyle
            }, 400);
          }
        }
      }
      
      // Create custom service record
      const staffServiceId = `staffsvc_${Date.now()}_${Math.random().toString(36).substring(7)}_${Math.random().toString(36).substring(2, 9)}`;
      
      const staffService = {
        id: staffServiceId,
        staffId,
        serviceId: staffServiceId, // Custom services use their own ID
        serviceName,
        category,
        price,
        duration,
        description,
        serviceStyle: 'at_center', // Always at_center for custom services
        
        // Staff service metadata
        isCustom: true, // This is staff's own service
        clinicName: staff.clinicName || null,
        vendorId: vendorId || null,
        
        // Status - ✅ REQUIREMENT: Approval required
        isActive: false, // Not active until approved
        needsApproval: true, // Custom services require approval
        approvalStatus: 'pending_approval', // Pending admin approval
        status: 'pending',
        submittedForApprovalAt: new Date().toISOString(),
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save to KV store
      await kvStore.set(`staff:${staffId}:service:${staffServiceId}`, staffService);
      await kvStore.set(`staff:service:${staffServiceId}`, staffService);
      
      // Add to pending approval queue
      const pendingQueue = await kvStore.get('staff-custom-services:pending-approval') || [];
      if (!pendingQueue.includes(staffServiceId)) {
        pendingQueue.push(staffServiceId);
        await kvStore.set('staff-custom-services:pending-approval', pendingQueue);
      }
      
      console.log('✅ [STAFF-SERVICE] Custom service created for staff:', staffServiceId);
      console.log('   Status: pending_approval (requires admin approval)');
      
      return c.json({
        success: true,
        service: staffService,
        message: 'Custom service created and submitted for admin approval'
      });
    } catch (error) {
      console.error('❌ [STAFF-SERVICE] Error creating custom service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Update staff service
   * PUT /make-server-3dd53475/staff/:staffId/services/:serviceId
   */
  app.put('/make-server-3dd53475/staff/:staffId/services/:serviceId', async (c) => {
    try {
      const { staffId, serviceId } = c.req.param();
      const updates = await c.req.json();
      
      console.log('🔄 [STAFF-SERVICE] Updating staff service:', { staffId, serviceId });
      
      const service = await kvStore.get(`staff:service:${serviceId}`);
      
      if (!service) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      if (service.staffId !== staffId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      // For non-custom services (from vendor), only allow toggling active status
      if (!service.isCustom) {
        if (updates.isActive !== undefined) {
          service.isActive = updates.isActive;
          service.updatedAt = new Date().toISOString();
          
          const serviceKey = service.id ? `staff:${staffId}:service:${service.id}` : `staff:${staffId}:service:${serviceId}`;
          await kvStore.set(serviceKey, service);
          
          // Also update in staff.services array if it exists
          const staff = await kvStore.get(`staff:${staffId}`);
          if (staff && staff.services && Array.isArray(staff.services)) {
            const serviceIndex = staff.services.findIndex((s: any) => 
              s.serviceId === serviceId || s.id === serviceId
            );
            if (serviceIndex !== -1) {
              staff.services[serviceIndex].isActive = service.isActive;
              staff.updatedAt = new Date().toISOString();
              await kvStore.set(`staff:${staffId}`, staff);
            }
          }
          
          return c.json({
            success: true,
            service,
            message: `Service ${service.isActive ? 'enabled' : 'disabled'} successfully`
          });
        } else {
          return c.json({ error: 'Cannot edit vendor services. Only enable/disable is allowed.' }, 400);
        }
      }
      
      // ✅ For custom services, check approval status before allowing edits
      if (service.isCustom && service.approvalStatus === 'pending_approval') {
        return c.json({ 
          error: 'Cannot edit custom service while pending approval. Wait for admin review.' 
        }, 400);
      }
      
      if (service.isCustom && service.approvalStatus === 'rejected') {
        return c.json({ 
          error: 'Cannot edit rejected custom service. Create a new one instead.' 
        }, 400);
      }
      
      // Update custom service (only if approved or draft)
      const updatedService = {
        ...service,
        ...updates,
        // Ensure serviceStyle remains at_center for custom services
        serviceStyle: 'at_center',
        updatedAt: new Date().toISOString()
      };
      
      // If updating after approval, mark as needing re-approval if significant changes
      if (service.approvalStatus === 'approved' && 
          (updates.price !== undefined || updates.duration !== undefined || updates.serviceName !== undefined)) {
        updatedService.approvalStatus = 'pending_approval';
        updatedService.isActive = false;
        updatedService.submittedForApprovalAt = new Date().toISOString();
      }
      
      const serviceKey = updatedService.id ? `staff:${staffId}:service:${updatedService.id}` : `staff:${staffId}:service:${serviceId}`;
      await kvStore.set(serviceKey, updatedService);
      
      console.log('✅ [STAFF-SERVICE] Service updated:', serviceId);
      
      return c.json({
        success: true,
        service: updatedService,
        message: updatedService.approvalStatus === 'pending_approval' 
          ? 'Service updated and resubmitted for approval'
          : 'Service updated successfully'
      });
    } catch (error) {
      console.error('❌ [STAFF-SERVICE] Error updating service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Delete staff service
   * DELETE /make-server-3dd53475/staff/:staffId/services/:serviceId
   */
  app.delete('/make-server-3dd53475/staff/:staffId/services/:serviceId', async (c) => {
    try {
      const { staffId, serviceId } = c.req.param();
      
      console.log('🗑️ [STAFF-SERVICE] Deleting staff service:', { staffId, serviceId });
      
      const service = await kvStore.get(`staff:service:${serviceId}`);
      
      if (!service) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      if (service.staffId !== staffId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      
      // Delete from KV store
      await kvStore.del(`staff:${staffId}:service:${serviceId}`);
      await kvStore.del(`staff:service:${serviceId}`);
      
      console.log('✅ [STAFF-SERVICE] Service deleted:', serviceId);
      
      return c.json({ success: true });
    } catch (error) {
      console.error('❌ [STAFF-SERVICE] Error deleting service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // STAFF LOCATION MANAGEMENT
  // ============================================

  /**
   * Get staff locations
   * GET /make-server-3dd53475/staff/:staffId/locations
   */
  app.get('/make-server-3dd53475/staff/:staffId/locations', async (c) => {
    try {
      const { staffId } = c.req.param();
      
      console.log('📋 [STAFF-LOCATION] Fetching locations for staff:', staffId);
      
      const locations = await kvStore.getByPrefix(`staff:${staffId}:location:`);
      
      console.log('✅ [STAFF-LOCATION] Found locations:', locations.length);
      
      return c.json({
        success: true,
        locations: locations || []
      });
    } catch (error) {
      console.error('❌ [STAFF-LOCATION] Error fetching locations:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Add location for staff
   * POST /make-server-3dd53475/staff/:staffId/locations
   */
  app.post('/make-server-3dd53475/staff/:staffId/locations', async (c) => {
    try {
      const { staffId } = c.req.param();
      const { clinicId, clinicName, address, workingHours } = await c.req.json();
      
      console.log('➕ [STAFF-LOCATION] Adding location for staff:', { staffId, clinicName });
      
      const locationId = `loc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const location = {
        id: locationId,
        staffId,
        clinicId,
        clinicName,
        address,
        workingHours,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kvStore.set(`staff:${staffId}:location:${locationId}`, location);
      
      console.log('✅ [STAFF-LOCATION] Location added:', locationId);
      
      return c.json({
        success: true,
        location
      });
    } catch (error) {
      console.error('❌ [STAFF-LOCATION] Error adding location:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Delete location
   * DELETE /make-server-3dd53475/staff/:staffId/locations/:locationId
   */
  app.delete('/make-server-3dd53475/staff/:staffId/locations/:locationId', async (c) => {
    try {
      const { staffId, locationId } = c.req.param();
      
      console.log('🗑️ [STAFF-LOCATION] Deleting location:', { staffId, locationId });
      
      await kvStore.del(`staff:${staffId}:location:${locationId}`);
      
      console.log('✅ [STAFF-LOCATION] Location deleted:', locationId);
      
      return c.json({ success: true });
    } catch (error) {
      console.error('❌ [STAFF-LOCATION] Error deleting location:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // STAFF SERVICE SYNC ENDPOINTS
  // ============================================

  /**
   * Check if staff services need sync from vendor
   * GET /make-server-3dd53475/staff/:staffId/check-sync-needed
   */
  app.get('/make-server-3dd53475/staff/:staffId/check-sync-needed', async (c) => {
    try {
      const { staffId } = c.req.param();
      
      console.log('🔍 [STAFF-SYNC] Checking if sync needed for staff:', staffId);
      
      const staff = await kvStore.get(`staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      const vendorId = staff.vendorId;
      if (!vendorId) {
        return c.json({ 
          success: true, 
          syncNeeded: false, 
          reason: 'No vendor associated' 
        });
      }
      
      // Get vendor's published services
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      const vendorServiceIds = new Set<string>();
      
      for (const style of serviceStyles) {
        const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
        const vendorServicesData = await kvStore.get(vendorServicesKey);
        
        if (vendorServicesData && vendorServicesData.services) {
          const publishedServices = vendorServicesData.services.filter(
            (s: any) => s.publishStatus === 'published' && s.isEnabled === true
          );
          publishedServices.forEach((s: any) => vendorServiceIds.add(s.serviceId));
        }
      }
      
      // Get staff's current services
      const staffServices = await kvStore.getByPrefix(`staff:${staffId}:service:`);
      const staffServiceIds = new Set(
        staffServices.map((s: any) => s.serviceId).filter(Boolean)
      );
      
      // Also check staff.services array (legacy)
      if (staff.services && Array.isArray(staff.services)) {
        staff.services.forEach((s: any) => {
          if (s.serviceId) staffServiceIds.add(s.serviceId);
        });
      }
      
      // Check if there are vendor services not in staff services
      const missingServiceIds = Array.from(vendorServiceIds).filter(
        id => !staffServiceIds.has(id)
      );
      
      const syncNeeded = missingServiceIds.length > 0;
      
      console.log(`✅ [STAFF-SYNC] Sync check complete:`, {
        vendorServices: vendorServiceIds.size,
        staffServices: staffServiceIds.size,
        missing: missingServiceIds.length,
        syncNeeded
      });
      
      return c.json({
        success: true,
        syncNeeded,
        vendorServiceCount: vendorServiceIds.size,
        staffServiceCount: staffServiceIds.size,
        missingServiceCount: missingServiceIds.length,
        missingServiceIds: missingServiceIds.slice(0, 10) // Limit response size
      });
      
    } catch (error) {
      console.error('❌ [STAFF-SYNC] Error checking sync:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Sync services from vendor to staff
   * POST /make-server-3dd53475/staff/:staffId/sync-services
   */
  app.post('/make-server-3dd53475/staff/:staffId/sync-services', async (c) => {
    try {
      const { staffId } = c.req.param();
      
      console.log('🔄 [STAFF-SYNC] Syncing services for staff:', staffId);
      
      const staff = await kvStore.get(`staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      const vendorId = staff.vendorId;
      if (!vendorId) {
        return c.json({ error: 'No vendor associated with staff' }, 400);
      }
      
      const vendor = await kvStore.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Get vendor's published services from all styles
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      const allVendorServices: any[] = [];
      
      for (const style of serviceStyles) {
        const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
        const vendorServicesData = await kvStore.get(vendorServicesKey);
        
        if (vendorServicesData && vendorServicesData.services) {
          const publishedServices = vendorServicesData.services.filter(
            (s: any) => s.publishStatus === 'published' && s.isEnabled === true
          );
          allVendorServices.push(...publishedServices);
        }
      }
      
      console.log(`📋 Found ${allVendorServices.length} published vendor services`);
      
      // Get staff's current services
      const existingStaffServices = await kvStore.getByPrefix(`staff:${staffId}:service:`);
      const existingServiceIds = new Set(
        existingStaffServices.map((s: any) => s.serviceId).filter(Boolean)
      );
      
      // Create staff service records for missing services
      let servicesCreated = 0;
      const createdServices = [];
      
      for (const vendorService of allVendorServices) {
        if (!existingServiceIds.has(vendorService.serviceId)) {
          const staffServiceId = `staffsvc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 9)}`;
          
          const staffService = {
            id: staffServiceId,
            staffId,
            serviceId: vendorService.serviceId,
            serviceName: vendorService.serviceName,
            category: vendorService.categoryName,
            categoryName: vendorService.categoryName,
            subCategoryName: vendorService.subCategoryName,
            price: vendorService.customPrice || vendorService.price,
            duration: vendorService.customDuration || vendorService.duration,
            description: vendorService.description || vendorService.customDescription,
            serviceStyle: vendorService.serviceStyle,
            
            // Staff service metadata
            isCustom: false,
            clinicName: vendor.businessName || vendor.fullName,
            vendorId: vendorId,
            
            // Status - staff can enable/disable
            isActive: true, // Default to enabled when synced
            
            // Timestamps
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncedAt: new Date().toISOString()
          };
          
          await kvStore.set(`staff:${staffId}:service:${staffServiceId}`, staffService);
          existingServiceIds.add(vendorService.serviceId);
          servicesCreated++;
          createdServices.push(staffService);
        }
      }
      
      // Also update staff.services array for backward compatibility
      if (staff.services) {
        const updatedServices = [...(staff.services || [])];
        createdServices.forEach(newService => {
          if (!updatedServices.find((s: any) => s.serviceId === newService.serviceId)) {
            updatedServices.push(newService);
          }
        });
        staff.services = updatedServices;
        staff.updatedAt = new Date().toISOString();
        await kvStore.set(`staff:${staffId}`, staff);
      }
      
      console.log(`✅ [STAFF-SYNC] Synced ${servicesCreated} services to staff ${staffId}`);
      
      return c.json({
        success: true,
        servicesCreated,
        services: createdServices,
        message: `${servicesCreated} service(s) synced from vendor`
      });
      
    } catch (error) {
      console.error('❌ [STAFF-SYNC] Error syncing services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Toggle service active status (enable/disable)
   * PUT /make-server-3dd53475/staff/:staffId/services/:serviceId/toggle
   */
  app.put('/make-server-3dd53475/staff/:staffId/services/:serviceId/toggle', async (c) => {
    try {
      const { staffId, serviceId } = c.req.param();
      const { isActive } = await c.req.json();
      
      console.log('🔄 [STAFF-SERVICE] Toggling service:', { staffId, serviceId, isActive });
      
      // Find the service in staff's service list
      const staffServices = await kvStore.getByPrefix(`staff:${staffId}:service:`);
      const service = staffServices.find((s: any) => s.serviceId === serviceId || s.id === serviceId);
      
      if (!service) {
        return c.json({ error: 'Service not found for this staff member' }, 404);
      }
      
      // Update isActive status
      service.isActive = isActive !== undefined ? isActive : !service.isActive;
      service.updatedAt = new Date().toISOString();
      
      // Save updated service
      const serviceKey = service.id ? `staff:${staffId}:service:${service.id}` : `staff:${staffId}:service:${serviceId}`;
      await kvStore.set(serviceKey, service);
      
      // Also update in staff.services array if it exists
      const staff = await kvStore.get(`staff:${staffId}`);
      if (staff && staff.services && Array.isArray(staff.services)) {
        const serviceIndex = staff.services.findIndex((s: any) => 
          s.serviceId === serviceId || s.id === serviceId
        );
        if (serviceIndex !== -1) {
          staff.services[serviceIndex].isActive = service.isActive;
          staff.updatedAt = new Date().toISOString();
          await kvStore.set(`staff:${staffId}`, staff);
        }
      }
      
      console.log(`✅ [STAFF-SERVICE] Service ${serviceId} ${service.isActive ? 'enabled' : 'disabled'}`);
      
      return c.json({
        success: true,
        service,
        message: `Service ${service.isActive ? 'enabled' : 'disabled'} successfully`
      });
      
    } catch (error) {
      console.error('❌ [STAFF-SERVICE] Error toggling service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get all available vendor services for staff to enable
   * GET /make-server-3dd53475/staff/:staffId/available-vendor-services
   */
  app.get('/make-server-3dd53475/staff/:staffId/available-vendor-services', async (c) => {
    try {
      const { staffId } = c.req.param();
      
      console.log('📋 [STAFF-SERVICE] Fetching available vendor services for staff:', staffId);
      
      const staff = await kvStore.get(`staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      const vendorId = staff.vendorId;
      if (!vendorId) {
        return c.json({ error: 'No vendor associated' }, 400);
      }
      
      // Get vendor's published services
      const serviceStyles = ['at_home', 'at_center', 'tele'];
      const allVendorServices: any[] = [];
      
      for (const style of serviceStyles) {
        const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
        const vendorServicesData = await kvStore.get(vendorServicesKey);
        
        if (vendorServicesData && vendorServicesData.services) {
          const publishedServices = vendorServicesData.services.filter(
            (s: any) => s.publishStatus === 'published' && s.isEnabled === true
          );
          allVendorServices.push(...publishedServices);
        }
      }
      
      // Get staff's current services
      const staffServices = await kvStore.getByPrefix(`staff:${staffId}:service:`);
      const staffServiceIds = new Set(
        staffServices.map((s: any) => s.serviceId).filter(Boolean)
      );
      
      // Mark which services are already enabled for staff
      const availableServices = allVendorServices.map(vendorService => ({
        ...vendorService,
        isEnabledForStaff: staffServiceIds.has(vendorService.serviceId),
        staffServiceId: staffServices.find((s: any) => s.serviceId === vendorService.serviceId)?.id || null
      }));
      
      console.log(`✅ [STAFF-SERVICE] Found ${availableServices.length} available vendor services`);
      
      return c.json({
        success: true,
        services: availableServices,
        total: availableServices.length,
        enabled: availableServices.filter((s: any) => s.isEnabledForStaff).length
      });
      
    } catch (error) {
      console.error('❌ [STAFF-SERVICE] Error fetching available services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Staff service endpoints registered');
}