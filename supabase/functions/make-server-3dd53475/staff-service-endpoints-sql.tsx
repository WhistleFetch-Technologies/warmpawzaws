/**
 * STAFF SERVICE MANAGEMENT ENDPOINTS - SQL VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * Handles staff service assignment, custom service creation, and location management
 */

import { Hono } from 'npm:hono@4';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';

export function staffServiceEndpointsSQL(app: Hono) {
  const client = getDbClient();
  const staffRepo = getStaffRepository();
  const servicesRepo = getServicesRepository();

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
      
      console.log('📋 [STAFF-SERVICE-SQL] Fetching services for staff:', staffId);
      
      // Get staff services from SQL
      const { data: staffServices, error } = await client
        .from('staff_services')
        .select(`
          *,
          services (*)
        `)
        .eq('staff_id', staffId)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching staff services:', error);
        return sendError(c, error, 500);
      }

      // Transform to match expected format
      const services = (staffServices || []).map((ss: any) => ({
        id: ss.id,
        staffId: ss.staff_id,
        serviceId: ss.service_id,
        serviceName: ss.services?.name || 'Service',
        category: ss.services?.category || '',
        categoryName: ss.services?.category || '',
        price: parseFloat(ss.price || ss.services?.price || 0),
        duration: ss.duration || ss.services?.duration || 60,
        description: ss.description || ss.services?.description || '',
        serviceStyle: ss.service_style || 'both',
        isCustom: false, // Staff services are linked to vendor services
        isActive: ss.is_active,
        createdAt: ss.created_at,
        updatedAt: ss.updated_at,
      }));

      // Deduplicate by serviceId
      const uniqueServices = [];
      const seenServiceIds = new Set();
      
      for (const service of services) {
        if (!seenServiceIds.has(service.serviceId)) {
          seenServiceIds.add(service.serviceId);
          uniqueServices.push(service);
        }
      }
      
      console.log('✅ [STAFF-SERVICE-SQL] Found services:', uniqueServices.length);
      
      return sendSuccess(c, {
        services: uniqueServices
      });
    } catch (error) {
      console.error('❌ [STAFF-SERVICE-SQL] Error fetching services:', error);
      return sendError(c, error, 500);
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
      
      console.log('➕ [STAFF-SERVICE-SQL] Adding clinic service to staff:', { staffId, serviceName });
      
      // Get staff profile
      const staff = await staffRepo.findById(staffId);
      
      if (!staff) {
        return sendError(c, 'Staff not found', 404);
      }
      
      // Check if service already assigned
      const { data: existingService } = await client
        .from('staff_services')
        .select('*')
        .eq('staff_id', staffId)
        .eq('service_id', serviceId)
        .single();
      
      if (existingService) {
        return sendError(c, 'Service already assigned to staff', 400);
      }
      
      // Create staff service record
      const { data: staffService, error: insertError } = await client
        .from('staff_services')
        .insert({
          staff_id: staffId,
          service_id: serviceId,
          price: parseFloat(price || 0),
          duration: parseInt(duration || 60),
          description: description || null,
          service_style: serviceStyle || 'both',
          is_active: true,
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating staff service:', insertError);
        return sendError(c, insertError, 500);
      }

      console.log('✅ [STAFF-SERVICE-SQL] Clinic service added to staff:', staffService.id);
      
      return sendSuccess(c, {
        service: {
          id: staffService.id,
          staffId: staffService.staff_id,
          serviceId: staffService.service_id,
          serviceName,
          category,
          categoryName,
          price: parseFloat(staffService.price || 0),
          duration: staffService.duration,
          description: staffService.description,
          serviceStyle: staffService.service_style,
          isCustom: false,
          isActive: staffService.is_active,
          createdAt: staffService.created_at,
          updatedAt: staffService.updated_at,
        }
      });
    } catch (error) {
      console.error('❌ [STAFF-SERVICE-SQL] Error adding clinic service:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Create custom service for staff
   * POST /make-server-3dd53475/staff/:staffId/services/create-custom
   */
  app.post('/make-server-3dd53475/staff/:staffId/services/create-custom', async (c) => {
    try {
      const { staffId } = c.req.param();
      const { serviceName, category, price, duration, description, serviceStyle } = await c.req.json();
      
      console.log('➕ [STAFF-SERVICE-SQL] Creating custom service for staff:', { staffId, serviceName });
      
      // Get staff profile
      const staff = await staffRepo.findById(staffId);
      
      if (!staff) {
        return sendError(c, 'Staff not found', 404);
      }
      
      // Create a custom service in the services table first
      const { data: service, error: serviceError } = await client
        .from('services')
        .insert({
          vendor_id: staff.vendorId,
          name: serviceName,
          category: category || 'custom',
          description: description || null,
          price: parseFloat(price || 0),
          duration: parseInt(duration || 60),
          is_active: false, // Custom services need approval
          service_style: serviceStyle || 'both',
        })
        .select()
        .single();

      if (serviceError) {
        console.error('Error creating service:', serviceError);
        return sendError(c, serviceError, 500);
      }

      // Link to staff
      const { data: staffService, error: linkError } = await client
        .from('staff_services')
        .insert({
          staff_id: staffId,
          service_id: service.id,
          price: parseFloat(price || 0),
          duration: parseInt(duration || 60),
          description: description || null,
          service_style: serviceStyle || 'both',
          is_active: false, // Needs approval
        })
        .select()
        .single();

      if (linkError) {
        console.error('Error linking service to staff:', linkError);
        return sendError(c, linkError, 500);
      }
      
      console.log('✅ [STAFF-SERVICE-SQL] Custom service created for staff:', staffService.id);
      
      return sendSuccess(c, {
        service: {
          id: staffService.id,
          staffId: staffService.staff_id,
          serviceId: staffService.service_id,
          serviceName,
          category,
          price: parseFloat(staffService.price || 0),
          duration: staffService.duration,
          description: staffService.description,
          isCustom: true,
          isActive: false,
          needsApproval: true,
          status: 'pending',
          createdAt: staffService.created_at,
          updatedAt: staffService.updated_at,
        }
      });
    } catch (error) {
      console.error('❌ [STAFF-SERVICE-SQL] Error creating custom service:', error);
      return sendError(c, error, 500);
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
      
      console.log('🔄 [STAFF-SERVICE-SQL] Updating staff service:', { staffId, serviceId });
      
      // Get staff service
      const { data: staffService, error: fetchError } = await client
        .from('staff_services')
        .select('*, services(*)')
        .eq('staff_id', staffId)
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .single();
      
      if (fetchError || !staffService) {
        return sendError(c, 'Service not found', 404);
      }

      // Check if it's a custom service (service belongs to staff's vendor)
      const isCustom = staffService.services?.vendor_id === staffService.staff?.vendorId;
      
      if (!isCustom) {
        // For clinic services, only allow toggling active status
        if (updates.isActive !== undefined) {
          const { data: updatedService, error: updateError } = await client
            .from('staff_services')
            .update({
              is_active: updates.isActive,
              updated_at: new Date().toISOString(),
            })
            .eq('id', staffService.id)
            .select()
            .single();
          
          if (updateError) {
            console.error('Error updating service:', updateError);
            return sendError(c, updateError, 500);
          }
          
          return sendSuccess(c, {
            service: updatedService
          });
        } else {
          return sendError(c, 'Cannot edit clinic services', 400);
        }
      }
      
      // Update custom service
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.price !== undefined) updateData.price = parseFloat(updates.price);
      if (updates.duration !== undefined) updateData.duration = parseInt(updates.duration);
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.serviceStyle !== undefined) updateData.service_style = updates.serviceStyle;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

      // Also update the service itself if it's custom
      if (staffService.service_id) {
        const serviceUpdateData: any = {};
        if (updates.serviceName !== undefined) serviceUpdateData.name = updates.serviceName;
        if (updates.category !== undefined) serviceUpdateData.category = updates.category;
        if (updates.description !== undefined) serviceUpdateData.description = updates.description;
        if (updates.price !== undefined) serviceUpdateData.price = parseFloat(updates.price);
        if (updates.duration !== undefined) serviceUpdateData.duration = parseInt(updates.duration);
        if (updates.serviceStyle !== undefined) serviceUpdateData.service_style = updates.serviceStyle;

        await client
          .from('services')
          .update(serviceUpdateData)
          .eq('id', staffService.service_id);
      }

      const { data: updatedService, error: updateError } = await client
        .from('staff_services')
        .update(updateData)
        .eq('id', staffService.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating service:', updateError);
        return sendError(c, updateError, 500);
      }
      
      console.log('✅ [STAFF-SERVICE-SQL] Service updated:', serviceId);
      
      return sendSuccess(c, {
        service: updatedService
      });
    } catch (error) {
      console.error('❌ [STAFF-SERVICE-SQL] Error updating service:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Delete staff service
   * DELETE /make-server-3dd53475/staff/:staffId/services/:serviceId
   */
  app.delete('/make-server-3dd53475/staff/:staffId/services/:serviceId', async (c) => {
    try {
      const { staffId, serviceId } = c.req.param();
      
      console.log('🗑️ [STAFF-SERVICE-SQL] Deleting staff service:', { staffId, serviceId });
      
      // Get staff service
      const { data: staffService, error: fetchError } = await client
        .from('staff_services')
        .select('*')
        .eq('staff_id', staffId)
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .single();
      
      if (fetchError || !staffService) {
        return sendError(c, 'Service not found', 404);
      }

      // Soft delete by setting is_active to false
      const { error: deleteError } = await client
        .from('staff_services')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', staffService.id);
      
      if (deleteError) {
        console.error('Error deleting service:', deleteError);
        return sendError(c, deleteError, 500);
      }
      
      console.log('✅ [STAFF-SERVICE-SQL] Service deleted:', serviceId);
      
      return sendSuccess(c, {});
    } catch (error) {
      console.error('❌ [STAFF-SERVICE-SQL] Error deleting service:', error);
      return sendError(c, error, 500);
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
      
      console.log('📋 [STAFF-LOCATION-SQL] Fetching locations for staff:', staffId);
      
      // Staff locations would be stored in a separate table or in staff preferences
      // For now, return empty array as location management might be handled differently
      // This can be extended when a staff_locations table is created
      
      return sendSuccess(c, {
        locations: []
      });
    } catch (error) {
      console.error('❌ [STAFF-LOCATION-SQL] Error fetching locations:', error);
      return sendError(c, error, 500);
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
      
      console.log('➕ [STAFF-LOCATION-SQL] Adding location for staff:', { staffId, clinicName });
      
      // This would require a staff_locations table
      // For now, return success but note that implementation is pending
      
      return sendSuccess(c, {
        message: 'Location management feature pending implementation',
        location: { clinicId, clinicName, address, workingHours }
      });
    } catch (error) {
      console.error('❌ [STAFF-LOCATION-SQL] Error adding location:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Delete location
   * DELETE /make-server-3dd53475/staff/:staffId/locations/:locationId
   */
  app.delete('/make-server-3dd53475/staff/:staffId/locations/:locationId', async (c) => {
    try {
      const { staffId, locationId } = c.req.param();
      
      console.log('🗑️ [STAFF-LOCATION-SQL] Deleting location:', { staffId, locationId });
      
      // This would require a staff_locations table
      
      return sendSuccess(c, {});
    } catch (error) {
      console.error('❌ [STAFF-LOCATION-SQL] Error deleting location:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Staff service endpoints (SQL) registered');
}

