/**
 * VENDOR CATALOG API V2 - SQL MIGRATION
 * 
 * ✅ MIGRATED TO SQL: Reads from service_catalog table
 * ✅ CATEGORIES: service_categories table
 * 
 * Architecture:
 * - Services stored in service_catalog table with category_id, sub_category_id, applicable_roles
 * - Categories in service_categories table provide organizational structure
 * - Vendor App filters services by applicable_roles array
 */

import type { Hono } from "npm:hono@4.6.14";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export function registerVendorCatalogAPIV2(app: Hono) {
  
  /**
   * Map role IDs used in Service Catalog to vendor app role IDs
   */
  const roleMappings: Record<string, string[]> = {
    // Vendor App Role → Service Catalog Roles
    'pet_groomer': ['groomer', 'pet_groomer'],
    'veterinarian': ['vet', 'veterinarian', 'role_veterinarian'], // Solo veterinarian - only vet services
    'vet_clinic': ['vet_clinic', 'veterinary_clinic', 'vet', 'role_vet_clinic'], // Business clinic - all hospital services
    'veterinary_clinic': ['vet_clinic', 'veterinary_clinic', 'vet', 'role_vet_clinic'], // Alias for vet_clinic
    'ambulance': ['ambulance', 'ambulance_service', 'role_ambulance'], // Pet ambulance service
    'diagnostics_center': ['diagnostics_center', 'diagnostic_lab', 'role_diagnostics_center'], // Diagnostics center
    'pharmacy': ['pharmacy', 'pet_pharmacy', 'role_pharmacy'], // Pet pharmacy
    'pet_trainer': ['trainer', 'pet_trainer'],
    'pet_walker': ['walker', 'pet_walker', 'dog_walker'],
    'pet_sitter': ['sitter', 'pet_sitter'],
    'pet_boarder': ['boarding', 'pet_boarder', 'pet_hotel'],
    'pet_cafe': ['cafe', 'pet_cafe'],
    'pet_transport': ['transport', 'pet_transport'],
    'pet_photographer': ['photographer', 'pet_photographer']
  };
  
  /**
   * Get services for a specific role (VENDOR APP)
   * ✅ READS FROM: platform:service_catalog
   */
  app.get("/make-server-3dd53475/service-catalog/role/:roleId", async (c) => {
    try {
      const roleId = c.req.param('roleId');
      const serviceStyle = c.req.query('serviceStyle') as 'at_home' | 'at_center' | 'tele' | undefined;
      
      console.log(`\n📋 ===== VENDOR SERVICE CATALOG REQUEST V2 =====`);
      console.log(`   Role ID: ${roleId}`);
      console.log(`   Service Style Filter: ${serviceStyle || 'all'}`);
      
      // ✅ SQL: Read from service_catalog table
      const acceptableRoles = roleMappings[roleId] || [roleId];
      console.log(`   Looking for services with roles: [${acceptableRoles.join(', ')}]`);
      
      // Build query
      let query = supabase
        .from('service_catalog')
        .select('*')
        .eq('status', 'active')
        .in('publish_status', ['published']);
      
      // Filter by applicable roles (using array overlap)
      if (acceptableRoles.length > 0) {
        query = query.overlaps('applicable_roles', acceptableRoles);
        }
        
        // Filter by service style if provided
        if (serviceStyle) {
        const normalizedStyle = serviceStyle.replace('-', '_');
        query = query.or(`service_style.eq.${normalizedStyle},service_style.eq.all`);
      }
      
      const { data: allServices, error } = await query.order('display_order');
      
      if (error) {
        console.error('Error fetching service catalog:', error);
        return c.json({ error: String(error) }, 500);
      }
      
      console.log(`   Total services in catalog: ${allServices?.length || 0}`);
      
      // Transform SQL results to match expected format
      const filteredServices = (allServices || []).map((service: any) => ({
        id: service.service_id || service.id,
        serviceId: service.service_id || service.id,
        serviceName: service.service_name,
        displayName: service.display_name || service.service_name,
        name: service.service_name,
        description: service.description,
        categoryId: service.category_id,
        categoryName: service.category_name,
        subCategoryId: service.sub_category_id,
        subCategoryName: service.sub_category_name,
        applicableRoles: service.applicable_roles || [],
        serviceStyle: service.service_style || 'at_center',
        basePrice: parseFloat(service.base_price || '0'),
        price: parseFloat(service.base_price || '0'),
        duration: service.duration_minutes || 30,
        durationMinutes: service.duration_minutes || 30,
        status: service.status,
        publishStatus: service.publish_status,
        metadata: service.metadata || {}
      }));
      
      console.log(`   Services found after filtering: ${filteredServices.length}`);
      
      return c.json({ 
        success: true,
        roleId,
        serviceStyle: serviceStyle || 'all',
        services: filteredServices,
        total: filteredServices.length
      });
      
    } catch (error) {
      console.error('❌ Error fetching role services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/service-catalog/:serviceId
   * Get details of a specific catalog service
   */
  app.get("/make-server-3dd53475/service-catalog/:serviceId", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      // ✅ SQL: Get service by service_id or id
      const { data: service, error } = await supabase
        .from('service_catalog')
        .select('*')
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .single();
      
      if (error || !service) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      // Transform to expected format
      const serviceData = {
        id: service.service_id || service.id,
        serviceId: service.service_id || service.id,
        serviceName: service.service_name,
        displayName: service.display_name || service.service_name,
        name: service.service_name,
        description: service.description,
        categoryId: service.category_id,
        categoryName: service.category_name,
        subCategoryId: service.sub_category_id,
        subCategoryName: service.sub_category_name,
        applicableRoles: service.applicable_roles || [],
        serviceStyle: service.service_style || 'at_center',
        basePrice: parseFloat(service.base_price || '0'),
        price: parseFloat(service.base_price || '0'),
        duration: service.duration_minutes || 30,
        durationMinutes: service.duration_minutes || 30,
        status: service.status,
        publishStatus: service.publish_status,
        metadata: service.metadata || {}
      };
      
      return c.json({ success: true, service: serviceData });
    } catch (error) {
      console.error('❌ Error fetching service details:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/create
   * Create a new service in the master catalog
   */
  app.post("/make-server-3dd53475/service-catalog/create", async (c) => {
    try {
      const body = await c.req.json();
      const { 
        serviceName, 
        description, 
        basePrice, 
        duration, 
        serviceStyle, 
        applicableRoles,
        categoryId,
        subCategoryId 
      } = body;
      
      if (!serviceName || !basePrice) {
        return c.json({ error: 'Missing required fields' }, 400);
      }
      
      const newServiceId = `svc_cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      // ✅ SQL: Insert into service_catalog table
      const { data: newService, error } = await supabase
        .from('service_catalog')
        .insert({
          service_id: newServiceId,
          service_name: serviceName,
          display_name: serviceName,
          description: description || null,
          base_price: parseFloat(basePrice || '0'),
          duration_minutes: parseInt(duration || '30'),
          service_style: serviceStyle || 'at_center',
          applicable_roles: applicableRoles || [],
          category_id: categoryId || null,
          sub_category_id: subCategoryId || null,
          status: 'draft',
          publish_status: 'draft',
          metadata: {
        approvalStatus: 'pending',
        version: 1,
        pricing: {
              basePrice: parseFloat(basePrice || '0'),
          addOns: [],
          packages: []
            }
          }
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating catalog service:', error);
        return c.json({ error: String(error) }, 500);
      }
      
      console.log(`✅ Created new catalog service: ${newServiceId}`);
      
      const responseService = {
        id: newService.service_id || newService.id,
        serviceId: newService.service_id || newService.id,
        serviceName: newService.service_name,
        description: newService.description,
        basePrice: parseFloat(newService.base_price || '0'),
        duration: newService.duration_minutes || 30,
        serviceStyle: newService.service_style,
        applicableRoles: newService.applicable_roles || [],
        categoryId: newService.category_id,
        subCategoryId: newService.sub_category_id,
        status: newService.status,
        publishStatus: newService.publish_status,
        metadata: newService.metadata || {}
      };
      
      return c.json({ success: true, service: responseService });
      
    } catch (error) {
      console.error('❌ Error creating catalog service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /make-server-3dd53475/service-catalog/:serviceId
   * Update an existing catalog service
   */
  app.put("/make-server-3dd53475/service-catalog/:serviceId", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      const updates = await c.req.json();
      
      // ✅ SQL: Get existing service
      const { data: existingService, error: fetchError } = await supabase
        .from('service_catalog')
        .select('*')
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .single();
      
      if (fetchError || !existingService) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      // ✅ SQL: Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      if (updates.serviceName) updateData.service_name = updates.serviceName;
      if (updates.displayName) updateData.display_name = updates.displayName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.basePrice !== undefined) updateData.base_price = parseFloat(updates.basePrice);
      if (updates.duration !== undefined) updateData.duration_minutes = parseInt(updates.duration);
      if (updates.serviceStyle !== undefined) updateData.service_style = updates.serviceStyle;
      if (updates.applicableRoles !== undefined) updateData.applicable_roles = updates.applicableRoles;
      if (updates.categoryId !== undefined) updateData.category_id = updates.categoryId;
      if (updates.subCategoryId !== undefined) updateData.sub_category_id = updates.subCategoryId;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.publishStatus !== undefined) updateData.publish_status = updates.publishStatus;
      if (updates.metadata !== undefined) {
        const currentMetadata = existingService.metadata || {};
        const currentVersion = currentMetadata.version || 1;
        updateData.metadata = {
          ...currentMetadata,
          ...updates.metadata,
          version: currentVersion + 1
        };
      }
      
      // ✅ SQL: Update service
      const { data: updatedService, error: updateError } = await supabase
        .from('service_catalog')
        .update(updateData)
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating catalog service:', updateError);
        return c.json({ error: String(updateError) }, 500);
      }
      
      console.log(`✅ Updated catalog service: ${serviceId}`);
      
      const responseService = {
        id: updatedService.service_id || updatedService.id,
        serviceId: updatedService.service_id || updatedService.id,
        serviceName: updatedService.service_name,
        displayName: updatedService.display_name,
        description: updatedService.description,
        basePrice: parseFloat(updatedService.base_price || '0'),
        duration: updatedService.duration_minutes || 30,
        serviceStyle: updatedService.service_style,
        applicableRoles: updatedService.applicable_roles || [],
        categoryId: updatedService.category_id,
        subCategoryId: updatedService.sub_category_id,
        status: updatedService.status,
        publishStatus: updatedService.publish_status,
        metadata: updatedService.metadata || {}
      };
      
      return c.json({ success: true, service: responseService });
      
    } catch (error) {
      console.error('❌ Error updating catalog service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * DELETE /make-server-3dd53475/service-catalog/:serviceId
   * Soft delete (archive) a catalog service
   */
  app.delete("/make-server-3dd53475/service-catalog/:serviceId", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      // ✅ SQL: Soft delete (archive) service
      const { data: updatedService, error } = await supabase
        .from('service_catalog')
        .update({
          status: 'archived',
          publish_status: 'archived',
          updated_at: new Date().toISOString()
        })
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .select()
        .single();
      
      if (error || !updatedService) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      console.log(`✅ Archived catalog service: ${serviceId}`);
      
      return c.json({ success: true, message: 'Service archived' });
      
    } catch (error) {
      console.error('❌ Error deleting catalog service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/publish
   * Publish a service (make it visible to vendors)
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/publish", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      // ✅ SQL: Publish service
      const { data: existingService } = await supabase
        .from('service_catalog')
        .select('*')
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .single();
      
      if (!existingService) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      const currentMetadata = existingService.metadata || {};
      const { data: updatedService, error } = await supabase
        .from('service_catalog')
        .update({
          status: 'active',
          publish_status: 'published',
          updated_at: new Date().toISOString(),
          metadata: {
            ...currentMetadata,
            approvalStatus: 'approved',
            publishedAt: new Date().toISOString()
          }
        })
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .select()
        .single();
      
      if (error) {
        console.error('Error publishing service:', error);
        return c.json({ error: String(error) }, 500);
      }
      
      console.log(`✅ Published catalog service: ${serviceId}`);
      
      const responseService = {
        id: updatedService.service_id || updatedService.id,
        serviceName: updatedService.service_name,
        status: updatedService.status,
        publishStatus: updatedService.publish_status,
        metadata: updatedService.metadata
      };
      
      return c.json({ success: true, service: responseService });
      
    } catch (error) {
      console.error('❌ Error publishing catalog service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/unpublish
   * Unpublish a service (draft mode)
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/unpublish", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      // ✅ SQL: Unpublish service
      const { data: updatedService, error } = await supabase
        .from('service_catalog')
        .update({
          status: 'draft',
          publish_status: 'draft',
          updated_at: new Date().toISOString()
        })
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .select()
        .single();
      
      if (error || !updatedService) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      console.log(`✅ Unpublished catalog service: ${serviceId}`);
      
      const responseService = {
        id: updatedService.service_id || updatedService.id,
        serviceName: updatedService.service_name,
        status: updatedService.status,
        publishStatus: updatedService.publish_status
      };
      
      return c.json({ success: true, service: responseService });
      
    } catch (error) {
      console.error('❌ Error unpublishing catalog service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/submit-approval
   * Submit a drafted service for admin approval
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/submit-approval", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      // ✅ SQL: Get existing service
      const { data: existingService, error: fetchError } = await supabase
        .from('service_catalog')
        .select('*')
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .single();
      
      if (fetchError || !existingService) {
        return c.json({ error: 'Service not found' }, 404);
      }

      if (existingService.status !== 'draft') {
        return c.json({ error: 'Only draft services can be submitted for approval' }, 400);
      }
      
      const currentMetadata = existingService.metadata || {};
      const { data: updatedService, error } = await supabase
        .from('service_catalog')
        .update({
          status: 'pending_approval',
          updated_at: new Date().toISOString(),
          metadata: {
            ...currentMetadata,
            approvalStatus: 'pending',
            submittedAt: new Date().toISOString()
          }
        })
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .select()
        .single();
      
      if (error) {
        console.error('Error submitting service:', error);
        return c.json({ error: String(error) }, 500);
      }
      
      console.log(`✅ Submitted service for approval: ${serviceId}`);
      
      const responseService = {
        id: updatedService.service_id || updatedService.id,
        serviceName: updatedService.service_name,
        status: updatedService.status,
        metadata: updatedService.metadata
      };
      
      return c.json({ success: true, service: responseService });
      
    } catch (error) {
      console.error('❌ Error submitting service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/approve
   * Admin approves a service
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/approve", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      // In real app, verify admin token here
      
      // ✅ SQL: Get existing service
      const { data: existingService, error: fetchError } = await supabase
        .from('service_catalog')
        .select('*')
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .single();
      
      if (fetchError || !existingService) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      const currentMetadata = existingService.metadata || {};
      const { data: updatedService, error } = await supabase
        .from('service_catalog')
        .update({
          status: 'active',
          publish_status: 'published',
          updated_at: new Date().toISOString(),
          metadata: {
            ...currentMetadata,
            approvalStatus: 'approved',
            approvedAt: new Date().toISOString()
          }
        })
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .select()
        .single();
      
      if (error) {
        console.error('Error approving service:', error);
        return c.json({ error: String(error) }, 500);
      }
      
      console.log(`✅ Approved service: ${serviceId}`);
      
      const responseService = {
        id: updatedService.service_id || updatedService.id,
        serviceName: updatedService.service_name,
        status: updatedService.status,
        publishStatus: updatedService.publish_status,
        metadata: updatedService.metadata
      };
      
      return c.json({ success: true, service: responseService });
      
    } catch (error) {
      console.error('❌ Error approving service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/reject
   * Admin rejects a service
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/reject", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      const { reason } = await c.req.json();
      
      // ✅ SQL: Get existing service
      const { data: existingService, error: fetchError } = await supabase
        .from('service_catalog')
        .select('*')
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .single();
      
      if (fetchError || !existingService) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      const currentMetadata = existingService.metadata || {};
      const { data: updatedService, error } = await supabase
        .from('service_catalog')
        .update({
          status: 'draft',
          publish_status: 'draft',
          updated_at: new Date().toISOString(),
          metadata: {
            ...currentMetadata,
            approvalStatus: 'rejected',
            rejectionReason: reason || 'Does not meet guidelines',
            rejectedAt: new Date().toISOString()
          }
        })
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .select()
        .single();
      
      if (error) {
        console.error('Error rejecting service:', error);
        return c.json({ error: String(error) }, 500);
      }
      
      console.log(`❌ Rejected service: ${serviceId}`);
      
      const responseService = {
        id: updatedService.service_id || updatedService.id,
        serviceName: updatedService.service_name,
        status: updatedService.status,
        metadata: updatedService.metadata
      };
      
      return c.json({ success: true, service: responseService });
      
    } catch (error) {
      console.error('❌ Error rejecting service:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/media
   * Upload/Manage media for a service
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/media", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      const { images, videos } = await c.req.json(); // Array of URLs
      
      // ✅ SQL: Get existing service
      const { data: existingService, error: fetchError } = await supabase
        .from('service_catalog')
        .select('*')
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .single();
      
      if (fetchError || !existingService) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      const currentMetadata = existingService.metadata || {};
      const updatedMetadata = { ...currentMetadata };
      if (images) updatedMetadata.images = images;
      if (videos) updatedMetadata.videos = videos;
      
      // ✅ SQL: Update service media
      const { data: updatedService, error } = await supabase
        .from('service_catalog')
        .update({
          metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating service media:', error);
        return c.json({ error: String(error) }, 500);
      }
      
      const responseService = {
        id: updatedService.service_id || updatedService.id,
        serviceName: updatedService.service_name,
        metadata: updatedService.metadata
      };
      
      return c.json({ success: true, service: responseService });
      
    } catch (error) {
      console.error('❌ Error updating service media:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/service-catalog/:serviceId/toggle-availability
   * Toggle service availability (Enable/Disable)
   */
  app.post("/make-server-3dd53475/service-catalog/:serviceId/toggle-availability", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      const { isActive } = await c.req.json();
      
      // ✅ SQL: Toggle service availability
      const { data: updatedService, error } = await supabase
        .from('service_catalog')
        .update({
          status: isActive ? 'active' : 'archived',
          updated_at: new Date().toISOString()
        })
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .select()
        .single();
      
      if (error || !updatedService) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      return c.json({ success: true, isActive: updatedService.status === 'active' });
      
    } catch (error) {
      console.error('❌ Error toggling service availability:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/service-catalog/:serviceId/analytics
   * Get analytics for a service
   */
  app.get("/make-server-3dd53475/service-catalog/:serviceId/analytics", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      // In a real system, this would aggregate data from a 'bookings' table/collection
      // For now, we'll generate realistic mock data or aggregate from bookings if available
      
      // ✅ SQL: Get bookings for this service
      const { data: serviceData } = await supabase
        .from('service_catalog')
        .select('service_id')
        .or(`service_id.eq.${serviceId},id.eq.${serviceId}`)
        .single();
      
      let bookingsCount = 0;
      let revenue = 0;
      
      if (serviceData) {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, total_amount, base_price')
          .eq('service_id', serviceData.service_id || serviceId);
        
        bookingsCount = bookings?.length || 0;
        revenue = bookings?.reduce((sum: number, b: any) => 
          sum + parseFloat(b.total_amount || b.base_price || '0'), 0) || 0;
      }
      
      const views = Math.floor(bookingsCount * (Math.random() * 10 + 5)) + 50; // Mock views based on bookings
      const conversionRate = views > 0 ? ((bookingsCount / views) * 100).toFixed(1) : 0;
      
      return c.json({
        success: true,
        analytics: {
          views,
          bookings: bookingsCount,
          revenue,
          conversionRate: `${conversionRate}%`,
          rating: 4.8, // Mock rating
          reviewsCount: Math.floor(bookingsCount * 0.3) // Mock review count
        }
      });
      
    } catch (error) {
      console.error('❌ Error fetching service analytics:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /make-server-3dd53475/service-catalog/:serviceId/reviews
   * Get reviews for a service
   */
  app.get("/make-server-3dd53475/service-catalog/:serviceId/reviews", async (c) => {
    try {
      const serviceId = c.req.param('serviceId');
      
      // Fetch reviews from a central reviews store or mock
      // Assuming reviews are stored as review:{bookingId}
      // We would need a secondary index review:service:{serviceId}
      
      // Mocking for now as Review System is separate
      const reviews = [
        { id: 'rev_1', user: 'Alice', rating: 5, comment: 'Great service!', date: '2023-10-01' },
        { id: 'rev_2', user: 'Bob', rating: 4, comment: 'Good, but late.', date: '2023-09-28' }
      ];
      
      return c.json({ success: true, reviews });
      
    } catch (error) {
      console.error('❌ Error fetching service reviews:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Debug endpoint - Check catalog status
   */
  app.get("/make-server-3dd53475/service-catalog/debug/v2", async (c) => {
    try {
      // ✅ SQL: Get services and categories
      const { data: servicesData } = await supabase
        .from('service_catalog')
        .select('*');
      
      const { data: categoriesData } = await supabase
        .from('service_categories')
        .select('*');
      
      const services = (servicesData || []).map((s: any) => ({
        id: s.service_id || s.id,
        serviceName: s.service_name,
        applicableRoles: s.applicable_roles || [],
        serviceStyle: s.service_style,
        categoryName: s.category_name,
        basePrice: parseFloat(s.base_price || '0')
      }));
      
      const categories = (categoriesData || []).map((c: any) => ({
        id: c.id,
        name: c.name
      }));
      
      // Analyze services
      const roleSet = new Set<string>();
      const styleSet = new Set<string>();
      
      services.forEach((s: any) => {
        if (s.applicableRoles) {
          s.applicableRoles.forEach((r: string) => roleSet.add(r));
        }
        if (s.serviceStyle) {
          styleSet.add(s.serviceStyle);
        }
      });
      
      const byRole: Record<string, number> = {};
      services.forEach((s: any) => {
        if (s.applicableRoles) {
          s.applicableRoles.forEach((r: string) => {
            byRole[r] = (byRole[r] || 0) + 1;
          });
        }
      });
      
      const byStyle: Record<string, number> = {};
      services.forEach((s: any) => {
        if (s.serviceStyle) {
          byStyle[s.serviceStyle] = (byStyle[s.serviceStyle] || 0) + 1;
        }
      });
      
      return c.json({
        success: true,
        dataSource: 'platform:service_catalog',
        stats: {
          totalServices: services.length,
          totalCategories: categories.length,
          availableRoles: Array.from(roleSet),
          availableStyles: Array.from(styleSet),
          servicesByRole: byRole,
          servicesByStyle: byStyle
        },
        sampleServices: services.slice(0, 5).map((s: any) => ({
          name: s.serviceName,
          roles: s.applicableRoles,
          style: s.serviceStyle,
          category: s.categoryName,
          price: s.basePrice
        }))
      });
      
    } catch (error) {
      console.error('Error in debug:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}
