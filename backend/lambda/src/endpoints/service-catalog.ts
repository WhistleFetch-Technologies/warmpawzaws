/**
 * ============================================================================
 * SERVICE CATALOG ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles platform service catalog:
 * - Get services by role
 * - Get service categories
 * - Get service details
 * 
 * Migrated from: supabase/functions/make-server-3dd53475/vendor-catalog-api-v2.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query, insert, update } from '../database/rds-connection';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';

/**
 * Map role IDs to service catalog roles
 */
const roleMappings: Record<string, string[]> = {
  'pet_groomer': ['groomer', 'pet_groomer'],
  'veterinarian': ['vet', 'veterinarian', 'role_veterinarian'],
  'vet_clinic': ['vet_clinic', 'veterinary_clinic', 'vet', 'role_vet_clinic'],
  'veterinary_clinic': ['vet_clinic', 'veterinary_clinic', 'vet', 'role_vet_clinic'],
  'ambulance': ['ambulance', 'ambulance_service', 'role_ambulance'],
  'diagnostics_center': ['diagnostics_center', 'diagnostic_lab', 'role_diagnostics_center'],
  'pharmacy': ['pharmacy', 'pet_pharmacy', 'role_pharmacy'],
  'pet_trainer': ['trainer', 'pet_trainer'],
  'pet_walker': ['walker', 'pet_walker', 'dog_walker'],
  'pet_sitter': ['sitter', 'pet_sitter'],
  'pet_boarder': ['boarding', 'pet_boarder', 'pet_hotel'],
  'pet_cafe': ['cafe', 'pet_cafe'],
  'pet_transport': ['transport', 'pet_transport'],
  'pet_photographer': ['photographer', 'pet_photographer'],
};

export function registerServiceCatalogEndpoints(app: Hono) {
  /**
   * GET /service-catalog/role/:roleId
   * Get services for a specific role
   */
  app.get("/service-catalog/role/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      const serviceStyle = c.req.query('serviceStyle');

      const acceptableRoles = roleMappings[roleId] || [roleId];

      let catalogQuery = `
        SELECT * FROM service_catalog
        WHERE status = 'active'
        AND publish_status = 'published'
        AND (applicable_roles && $1::text[])
      `;

      const params: any[] = [acceptableRoles];
      let paramIndex = 2;

      if (serviceStyle) {
        catalogQuery += ` AND (service_style = $${paramIndex} OR service_style = 'all')`;
        params.push(serviceStyle);
        paramIndex++;
      }

      catalogQuery += ` ORDER BY display_order ASC`;

      const services = await query(catalogQuery, params);

      const filteredServices = services.rows.map((service: any) => ({
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
        metadata: service.metadata || {},
      }));

      return c.json({
        success: true,
        roleId,
        serviceStyle: serviceStyle || 'all',
        services: filteredServices,
        total: filteredServices.length,
      });
    } catch (error: any) {
      console.error('Error fetching service catalog:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /service-catalog/:serviceId
   * Get service details
   */
  app.get("/service-catalog/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();

      const services = await query(
        `SELECT * FROM service_catalog
         WHERE (service_id = $1 OR id = $1)
         AND status = 'active'`,
        [serviceId]
      );

      if (services.rows.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      const service = services.rows[0];

      return c.json({
        success: true,
        service: {
          id: service.service_id || service.id,
          serviceId: service.service_id || service.id,
          serviceName: service.service_name,
          displayName: service.display_name || service.service_name,
          description: service.description,
          categoryId: service.category_id,
          categoryName: service.category_name,
          subCategoryId: service.sub_category_id,
          subCategoryName: service.sub_category_name,
          applicableRoles: service.applicable_roles || [],
          serviceStyle: service.service_style,
          basePrice: parseFloat(service.base_price || '0'),
          duration: service.duration_minutes || 30,
          status: service.status,
          publishStatus: service.publish_status,
          metadata: service.metadata || {},
        },
      });
    } catch (error: any) {
      console.error('Error fetching service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /service-catalog/categories
   * Get all service categories
   */
  app.get("/service-catalog/categories", async (c) => {
    try {
      // Try to query service_categories table
      // NOTE: If this fails with "uuid = text" error, it's due to schema conflict:
      // - Migration 001 creates parent_category_id UUID
      // - Migration 002 adds foreign key: parent_category_id UUID REFERENCES service_categories(id)
      // - Migration 048 adds category_id TEXT
      // The foreign key constraint causes type mismatch errors
      
      const categories = await query(`
        SELECT 
          id::text as id,
          COALESCE(category_id::text, '') as category_id,
          name::text as name,
          COALESCE(description::text, '') as description,
          COALESCE(display_order::integer, 0) as display_order,
          COALESCE(created_at::text, '') as created_at
        FROM service_categories
        LIMIT 1000
      `);
      
      // Sort in JavaScript to avoid any SQL type issues
      const sortedCategories = categories.rows.sort((a: any, b: any) => {
        const orderA = parseInt(a.display_order) || 0;
        const orderB = parseInt(b.display_order) || 0;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });

      return c.json({
        success: true,
        categories: sortedCategories,
        total: sortedCategories.length,
      });
    } catch (error: any) {
      console.error('Error fetching categories:', error);
      // If uuid = text error, return empty array with helpful message
      // This is a known database schema issue from conflicting migrations
      // The table has parent_category_id UUID with foreign key constraint that causes type mismatch
      // This requires a manual database migration to fix properly
      if (error.message && (
        error.message.includes('does not exist') || 
        error.message.includes('operator does not exist') ||
        error.message.includes('uuid = text') ||
        error.message.includes('uuid =')
      )) {
        return c.json({
          success: true,
          categories: [],
          total: 0,
          message: 'Service categories table has schema constraint issue (uuid = text). The parent_category_id UUID column with foreign key from migration 002 conflicts with category_id TEXT from migration 048. This requires a manual database migration to drop the parent_category_id column and foreign key constraint. For now, endpoint returns empty array. Call POST /admin/migrations/fix-service-categories-constraint to attempt automatic fix.'
        });
      }
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/service-catalog
   * Get all services (admin view) with hierarchical grouping
   */
  app.get("/admin/service-catalog", async (c) => {
    try {
      const status = c.req.query('status');
      const roleId = c.req.query('roleId');
      const groupBy = c.req.query('groupBy'); // 'category' | 'subcategory' | 'none'

      let catalogQuery = `SELECT * FROM service_catalog WHERE 1=1`;
      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        catalogQuery += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (roleId) {
        const acceptableRoles = roleMappings[roleId] || [roleId];
        catalogQuery += ` AND (applicable_roles && $${paramIndex}::text[])`;
        params.push(acceptableRoles);
        paramIndex++;
      }

      catalogQuery += ` ORDER BY category_name ASC, sub_category_name ASC NULLS LAST, display_order ASC, service_name ASC`;

      const services = await query(catalogQuery, params);

      // If groupBy is 'category' or 'subcategory', group services hierarchically
      if (groupBy === 'category' || groupBy === 'subcategory') {
        const grouped: Record<string, any> = {};
        
        services.rows.forEach((service: any) => {
          const categoryKey = service.category_name || service.category_id || 'Uncategorized';
          const subcategoryKey = service.sub_category_name || service.sub_category_id || null;
          
          if (!grouped[categoryKey]) {
            grouped[categoryKey] = {
              category_id: service.category_id,
              category_name: categoryKey,
              services: [],
              subcategories: {},
            };
          }
          
          if (groupBy === 'subcategory' && subcategoryKey) {
            if (!grouped[categoryKey].subcategories[subcategoryKey]) {
              grouped[categoryKey].subcategories[subcategoryKey] = {
                sub_category_id: service.sub_category_id,
                sub_category_name: subcategoryKey,
                services: [],
              };
            }
            grouped[categoryKey].subcategories[subcategoryKey].services.push(service);
          } else {
            grouped[categoryKey].services.push(service);
          }
        });

        // Convert grouped object to array format
        const groupedArray = Object.values(grouped).map((category: any) => {
          if (groupBy === 'subcategory' && Object.keys(category.subcategories).length > 0) {
            category.subcategories = Object.values(category.subcategories).map((subcat: any) => ({
              ...subcat,
              itemCount: subcat.services.length,
            }));
          }
          category.itemCount = category.services.length;
          return category;
        });

        return c.json({
          success: true,
          services: groupedArray,
          total: services.rows.length,
          grouped: true,
          groupBy,
        });
      }

      return c.json({
        success: true,
        services: services.rows,
        total: services.rows.length,
        grouped: false,
      });
    } catch (error: any) {
      console.error('Error fetching service catalog:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/service-catalog
   * Create new service
   */
  app.post("/admin/service-catalog", async (c) => {
    try {
      const body = await c.req.json();
      const {
        service_id,
        service_name,
        display_name,
        description,
        category_id,
        category_name,
        sub_category_id,
        sub_category_name,
        applicable_roles,
        service_style,
        base_price,
        duration_minutes,
        metadata,
        display_order,
      } = body;

      // Validation
      if (!service_id || !service_name || !applicable_roles || applicable_roles.length === 0) {
        return c.json({ 
          error: 'service_id, service_name, and applicable_roles are required' 
        }, 400);
      }

      // Check if service_id already exists
      const existing = await query(
        'SELECT * FROM service_catalog WHERE service_id = $1',
        [service_id]
      );

      if (existing.rows.length > 0) {
        return c.json({ error: 'Service with this ID already exists' }, 409);
      }

      const newService = await insert('service_catalog', {
        service_id,
        service_name,
        display_name: display_name || service_name,
        description: description || '',
        category_id: category_id || null,
        category_name: category_name || null,
        sub_category_id: sub_category_id || null,
        sub_category_name: sub_category_name || null,
        applicable_roles,
        service_style: service_style || 'at_center',
        base_price: base_price || 0,
        duration_minutes: duration_minutes || 30,
        status: 'active',
        publish_status: 'published',
        metadata: metadata || {},
        display_order: display_order || 0,
      });

      return c.json({
        success: true,
        message: 'Service created successfully',
        service: newService[0],
      });
    } catch (error: any) {
      console.error('Error creating service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/service-catalog/:serviceId
   * Update service
   */
  app.put("/admin/service-catalog/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const body = await c.req.json();

      // Check if service exists
      const existing = await query(
        'SELECT * FROM service_catalog WHERE service_id = $1 OR id = $1',
        [serviceId]
      );

      if (existing.rows.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      const service = existing.rows[0];

      // Update service
      const updateData: any = {};
      if (body.service_name !== undefined) updateData.service_name = body.service_name;
      if (body.display_name !== undefined) updateData.display_name = body.display_name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.category_id !== undefined) updateData.category_id = body.category_id;
      if (body.category_name !== undefined) updateData.category_name = body.category_name;
      if (body.sub_category_id !== undefined) updateData.sub_category_id = body.sub_category_id;
      if (body.sub_category_name !== undefined) updateData.sub_category_name = body.sub_category_name;
      if (body.applicable_roles !== undefined) updateData.applicable_roles = body.applicable_roles;
      if (body.service_style !== undefined) updateData.service_style = body.service_style;
      if (body.base_price !== undefined) updateData.base_price = body.base_price;
      if (body.duration_minutes !== undefined) updateData.duration_minutes = body.duration_minutes;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.publish_status !== undefined) updateData.publish_status = body.publish_status;
      if (body.metadata !== undefined) updateData.metadata = body.metadata;
      if (body.display_order !== undefined) updateData.display_order = body.display_order;

      await update('service_catalog', { id: service.id }, updateData);

      // Fetch updated service
      const updated = await query(
        'SELECT * FROM service_catalog WHERE id = $1',
        [service.id]
      );

      return c.json({
        success: true,
        message: 'Service updated successfully',
        service: updated.rows[0],
      });
    } catch (error: any) {
      console.error('Error updating service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /admin/service-catalog/:serviceId
   * Delete (archive) service
   */
  app.delete("/admin/service-catalog/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();

      const existing = await query(
        'SELECT * FROM service_catalog WHERE service_id = $1 OR id = $1',
        [serviceId]
      );

      if (existing.rows.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      const service = existing.rows[0];

      // Soft delete: archive the service
      await update('service_catalog', { id: service.id }, {
        status: 'archived',
        publish_status: 'archived',
      });

      return c.json({
        success: true,
        message: 'Service archived successfully',
      });
    } catch (error: any) {
      console.error('Error deleting service:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

