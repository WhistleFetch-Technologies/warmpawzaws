/**
 * ============================================================================
 * SERVICE CATALOG SEEDING ENDPOINTS
 * ============================================================================
 * 
 * Admin endpoints for seeding service catalog data
 * - Seed standard services (vet, grooming, training, etc.)
 * - Seed via UI (single service)
 * - Bulk seed operations
 * 
 * Date: 2025-01-23
 * Migration: Phase 1 - Foundation
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';

const supabase = getDbClient();

/**
 * Standard service catalog templates
 */
const STANDARD_SERVICES = [
  // Veterinary Services
  {
    service_id: 'vet_consultation',
    name: 'Veterinary Consultation',
    description: 'Professional veterinary consultation for your pet',
    category: 'healthcare',
    sub_category: 'consultation',
    base_price: 500,
    duration_minutes: 30,
    service_style: 'tele',
    is_live: true,
    publish_status: 'published',
    metadata: {
      tags: ['vet', 'consultation', 'tele'],
      images: [],
      requirements: []
    }
  },
  {
    service_id: 'vet_clinic_visit',
    name: 'Clinic Visit',
    description: 'In-clinic veterinary consultation',
    category: 'healthcare',
    sub_category: 'consultation',
    base_price: 800,
    duration_minutes: 45,
    service_style: 'at_center',
    is_live: true,
    publish_status: 'published',
    metadata: {
      tags: ['vet', 'clinic', 'consultation'],
      images: [],
      requirements: []
    }
  },
  {
    service_id: 'vet_home_visit',
    name: 'Home Visit',
    description: 'Veterinary consultation at your home',
    category: 'healthcare',
    sub_category: 'consultation',
    base_price: 1200,
    duration_minutes: 60,
    service_style: 'at_home',
    is_live: true,
    publish_status: 'published',
    metadata: {
      tags: ['vet', 'home', 'consultation'],
      images: [],
      requirements: []
    }
  },
  // Grooming Services
  {
    service_id: 'grooming_full',
    name: 'Full Grooming',
    description: 'Complete grooming service including bath, haircut, and nail trim',
    category: 'grooming',
    sub_category: 'full_service',
    base_price: 1500,
    duration_minutes: 120,
    service_style: 'at_center',
    is_live: true,
    publish_status: 'published',
    metadata: {
      tags: ['grooming', 'full', 'bath', 'haircut'],
      images: [],
      requirements: []
    }
  },
  {
    service_id: 'grooming_bath',
    name: 'Bath & Brush',
    description: 'Bath and brushing service',
    category: 'grooming',
    sub_category: 'basic',
    base_price: 800,
    duration_minutes: 60,
    service_style: 'at_center',
    is_live: true,
    publish_status: 'published',
    metadata: {
      tags: ['grooming', 'bath', 'brush'],
      images: [],
      requirements: []
    }
  },
  // Training Services
  {
    service_id: 'training_basic',
    name: 'Basic Training',
    description: 'Basic obedience training for your pet',
    category: 'training',
    sub_category: 'obedience',
    base_price: 2000,
    duration_minutes: 60,
    service_style: 'at_center',
    is_live: true,
    publish_status: 'published',
    metadata: {
      tags: ['training', 'obedience', 'basic'],
      images: [],
      requirements: []
    }
  },
  {
    service_id: 'training_advanced',
    name: 'Advanced Training',
    description: 'Advanced training programs',
    category: 'training',
    sub_category: 'advanced',
    base_price: 3000,
    duration_minutes: 90,
    service_style: 'at_center',
    is_live: true,
    publish_status: 'published',
    metadata: {
      tags: ['training', 'advanced'],
      images: [],
      requirements: []
    }
  },
  // Pet Walking
  {
    service_id: 'walking_daily',
    name: 'Daily Walking',
    description: 'Daily dog walking service',
    category: 'walking',
    sub_category: 'daily',
    base_price: 500,
    duration_minutes: 30,
    service_style: 'at_home',
    is_live: true,
    publish_status: 'published',
    metadata: {
      tags: ['walking', 'daily', 'exercise'],
      images: [],
      requirements: []
    }
  },
  // Boarding
  {
    service_id: 'boarding_daily',
    name: 'Daily Boarding',
    description: 'Daily boarding service for your pet',
    category: 'boarding',
    sub_category: 'daily',
    base_price: 1000,
    duration_minutes: 1440, // 24 hours
    service_style: 'at_center',
    is_live: true,
    publish_status: 'published',
    metadata: {
      tags: ['boarding', 'daily', 'care'],
      images: [],
      requirements: []
    }
  },
  // Nutrition
  {
    service_id: 'nutrition_consultation',
    name: 'Nutrition Consultation',
    description: 'Pet nutrition and diet consultation',
    category: 'nutrition',
    sub_category: 'consultation',
    base_price: 600,
    duration_minutes: 45,
    service_style: 'tele',
    is_live: true,
    publish_status: 'published',
    metadata: {
      tags: ['nutrition', 'diet', 'consultation'],
      images: [],
      requirements: []
    }
  }
];

export function registerServiceCatalogSeeding(app: Hono) {
  console.log('📦 [CATALOG-SEEDING] Registering service catalog seeding endpoints...');
  
  // Note: seed-all-services endpoint is now handled by admin-service-catalog-sql.tsx
  // This file only handles the legacy /seed endpoint

  /**
   * POST /admin/catalog/seed
   * Seed standard service catalog (legacy endpoint)
   */
  app.post('/make-server-3dd53475/admin/catalog/seed', async (c) => {
    try {
      const body = await c.req.json();
      const { services, overwrite = false } = body;
      
      // Use provided services or standard services
      const servicesToSeed = STANDARD_SERVICES;
      
      if (!confirm) {
        // Return preview for UI confirmation
        return sendSuccess(c, {
          preview: true,
          services: servicesToSeed,
          stats: {
            totalServices: servicesToSeed.length,
            categoriesSeeded: [...new Set(servicesToSeed.map(s => s.category))].length,
            breakdown: servicesToSeed.reduce((acc: any, s) => {
              acc[s.category] = (acc[s.category] || 0) + 1;
              return acc;
            }, {})
          },
          message: 'Review the services below and confirm to seed the catalog'
        });
      }
      
      // Continue with seeding logic...
      const { services, overwrite = false } = body;
      const servicesToSeedActual = services || STANDARD_SERVICES;
      
      console.log(`📦 [CATALOG-SEEDING] Seeding ${servicesToSeedActual.length} services...`);
      
      const results = [];
      
      for (const serviceData of servicesToSeedActual) {
        const { service_id, name, description, category, sub_category, base_price, duration_minutes, service_style, is_live, publish_status, metadata } = serviceData;
        
        if (!service_id || !name || !category || !base_price) {
          results.push({
            service_id: service_id || 'unknown',
            status: 'error',
            message: 'Missing required fields: service_id, name, category, base_price'
          });
          continue;
        }
        
        // Check if service exists
        const { data: existing } = await supabase
          .from('services')
          .select('id, service_id')
          .eq('service_id', service_id)
          .maybeSingle();
        
        if (existing && !overwrite) {
          results.push({
            service_id,
            status: 'skipped',
            message: 'Service already exists'
          });
          continue;
        }
        
        // Insert or update service
        const serviceRecord: any = {
          service_id,
          name,
          description: description || '',
          category,
          sub_category: sub_category || category,
          base_price,
          duration_minutes: duration_minutes || 30,
          service_style: service_style || 'at_center',
          is_live: is_live !== undefined ? is_live : true,
          publish_status: publish_status || 'published',
          metadata: metadata || {}
        };
        
        if (existing && overwrite) {
          const { error: updateError } = await supabase
            .from('services')
            .update(serviceRecord)
            .eq('id', existing.id);
          
          if (updateError) {
            results.push({
              service_id,
              status: 'error',
              message: updateError.message
            });
          } else {
            results.push({
              service_id,
              status: 'updated',
              message: 'Service updated'
            });
          }
        } else {
          const { error: insertError } = await supabase
            .from('services')
            .insert(serviceRecord);
          
          if (insertError) {
            results.push({
              service_id,
              status: 'error',
              message: insertError.message
            });
          } else {
            results.push({
              service_id,
              status: 'created',
              message: 'Service created'
            });
          }
        }
      }
      
      const created = results.filter(r => r.status === 'created').length;
      const updated = results.filter(r => r.status === 'updated').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const errors = results.filter(r => r.status === 'error');
      
      return sendSuccess(c, {
        preview: false,
        results,
        stats: {
          total: servicesToSeedActual.length,
          created,
          updated,
          skipped,
          errors: errors.length
        },
        message: `Seeded ${created} services, updated ${updated}, skipped ${skipped}`
      });
    } catch (error) {
      console.error('❌ [CATALOG-SEEDING] Error seeding services:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/catalog/seed
   * Seed standard service catalog (legacy endpoint)
   */
  app.post('/make-server-3dd53475/admin/catalog/seed', async (c) => {
    try {
      const body = await c.req.json();
      const { services, overwrite = false } = body;
      
      // Use provided services or standard services
      const servicesToSeed = services || STANDARD_SERVICES;
      
      console.log(`📦 [CATALOG-SEEDING] Seeding ${servicesToSeed.length} services...`);
      
      const results = [];
      
      for (const serviceData of servicesToSeed) {
        const { service_id, name, description, category, sub_category, base_price, duration_minutes, service_style, is_live, publish_status, metadata } = serviceData;
        
        if (!service_id || !name || !category || !base_price) {
          results.push({
            service_id: service_id || 'unknown',
            status: 'error',
            message: 'Missing required fields: service_id, name, category, base_price'
          });
          continue;
        }
        
        // Check if service exists
        const { data: existing } = await supabase
          .from('services')
          .select('id, service_id')
          .eq('service_id', service_id)
          .maybeSingle();
        
        if (existing && !overwrite) {
          results.push({
            service_id,
            status: 'skipped',
            message: 'Service already exists'
          });
          continue;
        }
        
        // Prepare service data
        const serviceInsert = {
          service_id,
          name,
          description: description || '',
          category,
          sub_category: sub_category || null,
          base_price: parseFloat(base_price),
          duration_minutes: parseInt(duration_minutes) || 30,
          service_style: service_style || 'at_center',
          is_live: is_live !== undefined ? is_live : true,
          publish_status: publish_status || 'published',
          metadata: metadata || {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        // Insert or update
        let result;
        if (existing && overwrite) {
          const { data, error } = await supabase
            .from('services')
            .update(serviceInsert)
            .eq('service_id', service_id)
            .select()
            .single();
          
          if (error) throw error;
          result = { service_id, status: 'updated', service: data };
        } else {
          const { data, error } = await supabase
            .from('services')
            .insert(serviceInsert)
            .select()
            .single();
          
          if (error) throw error;
          result = { service_id, status: 'created', service: data };
        }
        
        results.push(result);
        console.log(`✅ Service ${service_id} ${result.status}`);
      }
      
      const created = results.filter(r => r.status === 'created').length;
      const updated = results.filter(r => r.status === 'updated').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      
      return sendSuccess(c, {
        message: `Seeded ${created} services, updated ${updated}, skipped ${skipped}`,
        results,
        summary: {
          total: servicesToSeed.length,
          created,
          updated,
          skipped,
          errors: results.filter(r => r.status === 'error').length
        }
      });
      
    } catch (error) {
      console.error('❌ [CATALOG-SEEDING] Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/catalog/seed-ui
   * Seed single service via UI (for admin to add custom services)
   */
  app.post('/make-server-3dd53475/admin/catalog/seed-ui', async (c) => {
    try {
      const body = await c.req.json();
      const {
        serviceName,
        description,
        category,
        subCategory,
        price,
        duration,
        serviceStyle,
        tags,
        images,
        isLive = true,
        publishStatus = 'published'
      } = body;
      
      if (!serviceName || !category || !price) {
        return sendError(c, 'Missing required fields: serviceName, category, price', 400);
      }
      
      // Generate service_id
      const service_id = `svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const serviceData = {
        service_id,
        name: serviceName,
        description: description || '',
        category,
        sub_category: subCategory || null,
        base_price: parseFloat(price),
        duration_minutes: parseInt(duration) || 30,
        service_style: serviceStyle || 'at_center',
        is_live: isLive,
        publish_status: publishStatus,
        metadata: {
          tags: tags || [],
          images: images || [],
          requirements: []
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const { data: newService, error } = await supabase
        .from('services')
        .insert(serviceData)
        .select()
        .single();
      
      if (error) {
        console.error('❌ [CATALOG-SEEDING] Error creating service:', error);
        return sendError(c, `Failed to create service: ${error.message}`, 500);
      }
      
      console.log(`✅ [CATALOG-SEEDING] Service created via UI: ${service_id}`);
      
      return sendSuccess(c, {
        service: newService,
        message: 'Service created successfully'
      });
      
    } catch (error) {
      console.error('❌ [CATALOG-SEEDING] Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/catalog/services
   * Get all catalog services (for admin to view/manage)
   */
  app.get('/make-server-3dd53475/admin/catalog/services', async (c) => {
    try {
      const { category, is_live, publish_status } = c.req.query();
      
      let query = supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (category) {
        query = query.eq('category', category);
      }
      
      if (is_live !== undefined) {
        query = query.eq('is_live', is_live === 'true');
      }
      
      if (publish_status) {
        query = query.eq('publish_status', publish_status);
      }
      
      const { data: services, error } = await query;
      
      if (error) {
        console.error('❌ [CATALOG-SEEDING] Error fetching services:', error);
        return sendError(c, `Failed to fetch services: ${error.message}`, 500);
      }
      
      return sendSuccess(c, {
        services: services || [],
        count: services?.length || 0
      });
      
    } catch (error) {
      console.error('❌ [CATALOG-SEEDING] Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/catalog/services/:serviceId
   * Update a catalog service
   */
  app.put('/make-server-3dd53475/admin/catalog/services/:serviceId', async (c) => {
    try {
      const { serviceId } = c.req.param();
      const updates = await c.req.json();
      
      // Check if service exists
      const { data: existing } = await supabase
        .from('services')
        .select('id')
        .eq('service_id', serviceId)
        .maybeSingle();
      
      if (!existing) {
        return sendError(c, 'Service not found', 404);
      }
      
      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      
      if (updates.serviceName) updateData.name = updates.serviceName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category) updateData.category = updates.category;
      if (updates.subCategory !== undefined) updateData.sub_category = updates.subCategory;
      if (updates.price !== undefined) updateData.base_price = parseFloat(updates.price);
      if (updates.duration !== undefined) updateData.duration_minutes = parseInt(updates.duration);
      if (updates.serviceStyle) updateData.service_style = updates.serviceStyle;
      if (updates.isLive !== undefined) updateData.is_live = updates.isLive;
      if (updates.publishStatus) updateData.publish_status = updates.publishStatus;
      if (updates.metadata) updateData.metadata = updates.metadata;
      
      const { data: updated, error } = await supabase
        .from('services')
        .update(updateData)
        .eq('service_id', serviceId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ [CATALOG-SEEDING] Error updating service:', error);
        return sendError(c, `Failed to update service: ${error.message}`, 500);
      }
      
      return sendSuccess(c, {
        service: updated,
        message: 'Service updated successfully'
      });
      
    } catch (error) {
      console.error('❌ [CATALOG-SEEDING] Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/catalog/services/:serviceId
   * Soft delete a catalog service (set is_live = false)
   */
  app.delete('/make-server-3dd53475/admin/catalog/services/:serviceId', async (c) => {
    try {
      const { serviceId } = c.req.param();
      
      const { data: updated, error } = await supabase
        .from('services')
        .update({
          is_live: false,
          updated_at: new Date().toISOString(),
        })
        .eq('service_id', serviceId)
        .select()
        .single();
      
      if (error) {
        console.error('❌ [CATALOG-SEEDING] Error deleting service:', error);
        return sendError(c, `Failed to delete service: ${error.message}`, 500);
      }
      
      return sendSuccess(c, {
        service: updated,
        message: 'Service deleted successfully'
      });
      
    } catch (error) {
      console.error('❌ [CATALOG-SEEDING] Error:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ [CATALOG-SEEDING] Service catalog seeding endpoints registered');
}

