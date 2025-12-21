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
   */
  app.get('/make-server-3dd53475/staff/:staffId/services', async (c) => {
    try {
      const { staffId } = c.req.param();
      
      console.log('📋 [STAFF-SERVICE] Fetching services for staff:', staffId);
      
      // Get staff services from KV store
      const services = await kvStore.getByPrefix(`staff:${staffId}:service:`);
      
      // Deduplicate by serviceId (in case of data duplication)
      const uniqueServices = [];
      const seenServiceIds = new Set();
      
      for (const service of services) {
        if (!seenServiceIds.has(service.serviceId)) {
          seenServiceIds.add(service.serviceId);
          uniqueServices.push(service);
        }
      }
      
      console.log('✅ [STAFF-SERVICE] Found services:', services.length, '(unique:', uniqueServices.length, ')');
      
      return c.json({
        success: true,
        services: uniqueServices || []
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
              at_home: { enabled: false, available: false, maxDistance: 10, acceptInstantBooking: true },
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
   */
  app.post('/make-server-3dd53475/staff/:staffId/services/create-custom', async (c) => {
    try {
      const { staffId } = c.req.param();
      const { serviceName, category, price, duration, description } = await c.req.json();
      
      console.log('➕ [STAFF-SERVICE] Creating custom service for staff:', { staffId, serviceName });
      
      // Get staff profile
      const staff = await kvStore.get(`staff:${staffId}`);
      
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
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
        
        // Staff service metadata
        isCustom: true, // This is staff's own service
        clinicName: null,
        vendorId: null,
        
        // Status
        isActive: true,
        needsApproval: true, // Custom services may need approval
        status: 'pending',
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save to KV store
      await kvStore.set(`staff:${staffId}:service:${staffServiceId}`, staffService);
      await kvStore.set(`staff:service:${staffServiceId}`, staffService);
      
      console.log('✅ [STAFF-SERVICE] Custom service created for staff:', staffServiceId);
      
      return c.json({
        success: true,
        service: staffService
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
      
      // Only custom services can be fully edited
      if (!service.isCustom) {
        // For clinic services, only allow toggling active status
        if (updates.isActive !== undefined) {
          service.isActive = updates.isActive;
          service.updatedAt = new Date().toISOString();
          
          await kvStore.set(`staff:${staffId}:service:${serviceId}`, service);
          await kvStore.set(`staff:service:${serviceId}`, service);
          
          return c.json({
            success: true,
            service
          });
        } else {
          return c.json({ error: 'Cannot edit clinic services' }, 400);
        }
      }
      
      // Update custom service
      const updatedService = {
        ...service,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await kvStore.set(`staff:${staffId}:service:${serviceId}`, updatedService);
      await kvStore.set(`staff:service:${serviceId}`, updatedService);
      
      console.log('✅ [STAFF-SERVICE] Service updated:', serviceId);
      
      return c.json({
        success: true,
        service: updatedService
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

  console.log('✅ Staff service endpoints registered');
}