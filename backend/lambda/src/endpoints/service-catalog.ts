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
 * Based on reference implementation - matches vendor app roles to catalog roles
 */
const roleMappings: Record<string, string[]> = {
  // Healthcare Roles
  'veterinarian': ['vet', 'veterinarian', 'veterinarian'],
  'veterinary_clinic': ['vet_clinic', 'veterinary_clinic', 'vet', 'veterinary_clinic'],
  'pet_pharmacy': ['pharmacy', 'pet_pharmacy', 'pharmacy'],
  'pet_ambulance': ['ambulance', 'pet_ambulance', 'ambulance'],
  'nutritionist': ['nutritionist', 'pet_nutritionist', 'nutritionist'],
  
  // Service Provider Roles
  'pet_groomer': ['groomer', 'pet_groomer', 'groomer'],
  'pet_walker': ['walker', 'pet_walker', 'dog_walker', 'pet_walker'],
  'pet_trainer': ['trainer', 'pet_trainer', 'trainer'],
  'pet_behaviorist': ['behaviorist', 'pet_behaviorist', 'behaviorist'],
  'pet_sitter': ['sitter', 'pet_sitter', 'sitter'],
  'pet_taxi': ['transport', 'pet_transport', 'pet_taxi', 'pet_transport'],
  'pet_boarding': ['boarding', 'pet_boarder', 'pet_hotel', 'pet_boarding'],
  'pet_resort': ['resort', 'pet_resort', 'resort'],
  'pet_cafe': ['cafe', 'pet_cafe', 'cafe'],
  'pet_photographer': ['photographer', 'pet_photographer', 'photographer'],
  'pet_sunset_services': ['sunset', 'pet_sunset_services', 'sunset_services'],
  
  // Retail Roles
  'pet_products_store': ['store', 'pet_store', 'retailer', 'pet_products_store'],
  'pet_breeder': ['breeder', 'pet_breeder', 'breeder'],
  
  // Other Roles
  'pet_shelter': ['shelter', 'pet_shelter', 'ngo', 'pet_shelter'],
  'insurance': ['insurance', 'pet_insurance', 'insurance'],
};

export function registerServiceCatalogEndpoints(app: Hono) {
  /**
   * GET /service-catalog/role/:roleId
   * Get services for a specific role
   * ✅ CRITICAL: Filters by role on backend (DB query - no frontend dependency)
   */
  app.get("/service-catalog/role/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      const serviceStyle = c.req.query('serviceStyle');
      const vendorId = c.req.query('vendorId'); // Optional: if vendorId provided, include vendor's role info

      // ✅ CRITICAL: Get role from DB to validate and get config
      let role = null;
      let roleConfig: any = {};
      
      try {
        // Try to get role by ID first (UUID)
        const rolesById = await select('roles', { id: roleId });
        if (rolesById.length > 0) {
          role = rolesById[0];
        } else {
          // Try by name (string identifier)
          const rolesByName = await select('roles', { name: roleId });
          if (rolesByName.length > 0) {
            role = rolesByName[0];
          }
        }
        
        if (role) {
          roleConfig = role.config || {};
        }
      } catch (roleError: any) {
        console.warn(`[Service Catalog] Failed to load role ${roleId}:`, roleError.message);
        // Continue with role mappings fallback
      }

      // Use role from DB if available, otherwise use mappings
      const acceptableRoles = role 
        ? [role.name, role.id, ...(roleMappings[role.name] || []), ...(roleMappings[roleId] || [])]
        : (roleMappings[roleId] || [roleId]);

      // Remove duplicates
      const uniqueRoles = [...new Set(acceptableRoles)];

      let catalogQuery = `
        SELECT * FROM service_catalog
        WHERE status = 'active'
        AND publish_status = 'published'
        AND (applicable_roles && $1::text[] OR applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
      `;

      const params: any[] = [uniqueRoles];
      let paramIndex = 2;

      if (serviceStyle) {
        catalogQuery += ` AND (service_style = $${paramIndex} OR service_style = 'all' OR service_style IS NULL)`;
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
        // ✅ Include role info directly (no separate API call needed)
        role: role ? {
          id: role.id,
          name: role.name,
          display_name: role.display_name,
          config: roleConfig,
        } : null,
        vendorTypes: roleConfig?.vendorTypes || [],
        serviceStyles: roleConfig?.serviceStyles || [],
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
   * ✅ CRITICAL: If roleId provided, includes role info (DB query - no frontend dependency)
   */
  app.get("/admin/service-catalog", async (c) => {
    try {
      const status = c.req.query('status');
      const roleId = c.req.query('roleId');
      const vendorId = c.req.query('vendorId'); // Optional: for vendor-specific filtering
      const groupBy = c.req.query('groupBy'); // 'category' | 'subcategory' | 'none'

      // ✅ CRITICAL: Get role from DB if roleId provided (no frontend dependency)
      let role = null;
      let roleConfig: any = {};
      
      if (roleId) {
        try {
          const rolesById = await select('roles', { id: roleId });
          if (rolesById.length > 0) {
            role = rolesById[0];
          } else {
            const rolesByName = await select('roles', { name: roleId });
            if (rolesByName.length > 0) {
              role = rolesByName[0];
            }
          }
          
          if (role) {
            roleConfig = role.config || {};
          }
        } catch (roleError: any) {
          console.warn(`[Admin Service Catalog] Failed to load role ${roleId}:`, roleError.message);
        }
      }

      // ✅ CRITICAL: If vendorId provided, get vendor's role from DB
      let vendorRole = null;
      if (vendorId && !roleId) {
        try {
          const vendors = await select('vendors', { id: vendorId });
          if (vendors.length > 0 && vendors[0].role_id) {
            const vendorRoles = await select('roles', { id: vendors[0].role_id });
            if (vendorRoles.length > 0) {
              vendorRole = vendorRoles[0];
              roleConfig = vendorRole.config || {};
            }
          }
        } catch (vendorError: any) {
          console.warn(`[Admin Service Catalog] Failed to load vendor role:`, vendorError.message);
        }
      }

      let catalogQuery = `SELECT * FROM service_catalog WHERE 1=1`;
      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        catalogQuery += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (roleId || vendorRole) {
        const targetRole = role || vendorRole;
        const acceptableRoles = targetRole
          ? [targetRole.name, targetRole.id, ...(roleMappings[targetRole.name] || []), ...(roleMappings[roleId || ''] || [])]
          : (roleMappings[roleId || ''] || [roleId || '']);
        const uniqueRoles = [...new Set(acceptableRoles.filter(Boolean))];
        
        catalogQuery += ` AND (applicable_roles && $${paramIndex}::text[] OR applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)`;
        params.push(uniqueRoles);
        paramIndex++;
      }

      catalogQuery += ` ORDER BY category_name ASC, sub_category_name ASC NULLS LAST, display_order ASC, service_name ASC`;

      const services = await query(catalogQuery, params);

      // If groupBy is 'category' or 'subcategory', group services hierarchically
      if (groupBy === 'category' || groupBy === 'subcategory') {
        const grouped: Record<string, any> = {};
        
        (services.rows || []).forEach((service: any) => {
          // Ensure all service fields are safe (no undefined)
          const safeService = {
            ...service,
            id: String(service.id || service.service_id || ''),
            service_id: String(service.service_id || service.id || ''),
            service_name: String(service.service_name || ''),
            category_id: String(service.category_id || ''),
            category_name: String(service.category_name || 'Uncategorized'),
            sub_category_id: String(service.sub_category_id || ''),
            sub_category_name: String(service.sub_category_name || ''),
          };
          
          const categoryKey = safeService.category_name || 'Uncategorized';
          const subcategoryKey = safeService.sub_category_name || null;
          
          if (!grouped[categoryKey]) {
            grouped[categoryKey] = {
              category_id: safeService.category_id,
              category_name: categoryKey,
              services: [],
              subcategories: {},
            };
          }
          
          if (groupBy === 'subcategory' && subcategoryKey) {
            if (!grouped[categoryKey].subcategories[subcategoryKey]) {
              grouped[categoryKey].subcategories[subcategoryKey] = {
                sub_category_id: safeService.sub_category_id,
                sub_category_name: subcategoryKey,
                services: [],
              };
            }
            grouped[categoryKey].subcategories[subcategoryKey].services.push(safeService);
          } else {
            grouped[categoryKey].services.push(safeService);
          }
        });

        // Convert grouped object to array format
        const groupedArray = Object.values(grouped).map((category: any) => {
          if (groupBy === 'subcategory' && Object.keys(category.subcategories || {}).length > 0) {
            category.subcategories = Object.values(category.subcategories).map((subcat: any) => ({
              ...subcat,
              itemCount: (subcat.services || []).length,
            }));
          }
          category.itemCount = (category.services || []).length;
          return category;
        });

        return c.json({
          success: true,
          services: groupedArray,
          total: services.rows.length,
          grouped: true,
          groupBy,
          // ✅ Include role info if roleId or vendorId provided (no separate API call needed)
          role: (role || vendorRole) ? {
            id: (role || vendorRole)!.id,
            name: (role || vendorRole)!.name,
            display_name: (role || vendorRole)!.display_name,
            config: roleConfig,
          } : null,
          vendorTypes: roleConfig?.vendorTypes || [],
          serviceStyles: roleConfig?.serviceStyles || [],
        });
      }

      // Ensure all service fields are safe (no undefined)
      const safeServices = (services.rows || []).map((service: any) => ({
        ...service,
        id: String(service.id || service.service_id || ''),
        service_id: String(service.service_id || service.id || ''),
        service_name: String(service.service_name || ''),
        category_id: String(service.category_id || ''),
        category_name: String(service.category_name || ''),
        sub_category_id: String(service.sub_category_id || ''),
        sub_category_name: String(service.sub_category_name || ''),
      }));

      return c.json({
        success: true,
        services: safeServices,
        total: safeServices.length,
        grouped: false,
        // ✅ Include role info if roleId or vendorId provided (no separate API call needed)
        role: (role || vendorRole) ? {
          id: String((role || vendorRole)!.id || ''),
          name: String((role || vendorRole)!.name || ''),
          display_name: String((role || vendorRole)!.display_name || ''),
          config: roleConfig || {},
        } : null,
        vendorTypes: roleConfig?.vendorTypes || [],
        serviceStyles: roleConfig?.serviceStyles || [],
      });
    } catch (error: any) {
      console.error('Error fetching service catalog:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/service-catalog/complete
   * ✅ CRITICAL: Comprehensive endpoint - returns vendor services + available catalog + role + capabilities
   * All data in one call - no frontend dependencies
   */
  app.get("/vendor/:vendorId/service-catalog/complete", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const serviceStyle = c.req.query('serviceStyle');

      // ✅ Get vendor with role and capabilities from DB
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const vendor = vendors[0];

      let role = null;
      let capabilities: string[] = [];
      let roleConfig: any = {};
      let allowedServiceStyles: string[] = ['at_home', 'at_center', 'tele'];

      if (vendor.role_id) {
        try {
          const roles = await select('roles', { id: vendor.role_id });
          if (roles.length > 0) {
            role = roles[0];
            roleConfig = role.config || {};
            allowedServiceStyles = roleConfig?.serviceStyles || roleConfig?.service_styles || ['at_home', 'at_center', 'tele'];
            
            // Get capabilities
            try {
              const allPermissions = await query(
                `SELECT role_id, permission_name 
                 FROM role_permissions 
                 WHERE role_id = ANY($1::text[])`,
                [[vendor.role_id]]
              );
              capabilities = allPermissions.rows.map((p: any) => p.permission_name);
            } catch {
              const permissions = await select('role_permissions', { role_id: vendor.role_id });
              capabilities = permissions.map(p => p.permission_name);
            }
          }
        } catch (roleError: any) {
          console.warn(`[Vendor Catalog Complete] Failed to load role:`, roleError.message);
        }
      }

      // ✅ Get vendor's existing services
      const vendorServicesQuery = `
        SELECT vs.*, s.name as base_service_name, s.description as base_description
        FROM vendor_services vs
        LEFT JOIN services s ON vs.service_id = s.id
        WHERE vs.vendor_id = $1
        AND vs.is_enabled = true
        ORDER BY vs.created_at DESC
      `;
      const vendorServicesResult = await query(vendorServicesQuery, [vendorId]);
      const vendorServices = vendorServicesResult.rows;

      // ✅ Get available catalog services for this role (filtered by backend)
      const acceptableRoles = role 
        ? [role.name, role.id, ...(roleMappings[role.name] || []), ...(roleMappings[vendor.role_id || ''] || [])]
        : (roleMappings[vendor.role_id || ''] || []);
      const uniqueRoles = [...new Set(acceptableRoles.filter(Boolean))];

      let catalogQuery = `
        SELECT * FROM service_catalog
        WHERE status = 'active'
        AND publish_status = 'published'
        AND (applicable_roles && $1::text[] OR applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)
      `;
      const params: any[] = [uniqueRoles];
      
      if (serviceStyle) {
        catalogQuery += ` AND (service_style = $2 OR service_style = 'all' OR service_style IS NULL)`;
        params.push(serviceStyle);
      }
      
      catalogQuery += ` ORDER BY display_order ASC`;
      const catalogResult = await query(catalogQuery, params);
      const availableServices = catalogResult.rows;

      // ✅ Get categories
      const categoriesResult = await query(`
        SELECT 
          id::text as id,
          COALESCE(category_id::text, '') as category_id,
          name::text as name,
          COALESCE(description::text, '') as description,
          COALESCE(display_order::integer, 0) as display_order
        FROM service_categories
        ORDER BY display_order ASC, name ASC
        LIMIT 1000
      `).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          role_id: vendor.role_id,
          vendor_type: vendor.vendor_type,
        },
        role: role ? {
          id: role.id,
          name: role.name,
          display_name: role.display_name,
          config: roleConfig,
        } : null,
        capabilities,
        allowedServiceStyles,
        vendorTypes: roleConfig?.vendorTypes || [],
        vendorServices: vendorServices.map((s: any) => ({
          id: s.id,
          serviceId: s.service_id,
          serviceName: s.service_name || s.base_service_name,
          description: s.description || s.base_description,
          category: s.category,
          price: parseFloat(s.price || s.custom_price || '0'),
          duration: s.duration_minutes || s.custom_duration || 30,
          serviceStyle: s.service_style,
          isCustomService: s.is_custom_service,
        })),
        availableServices: availableServices.map((s: any) => ({
          id: s.service_id || s.id,
          serviceName: s.service_name,
          displayName: s.display_name || s.service_name,
          description: s.description,
          categoryId: s.category_id,
          categoryName: s.category_name,
          applicableRoles: s.applicable_roles || [],
          serviceStyle: s.service_style || 'at_center',
          basePrice: parseFloat(s.base_price || '0'),
          duration: s.duration_minutes || 30,
        })),
        categories: categoriesResult.rows,
        totalVendorServices: vendorServices.length,
        totalAvailableServices: availableServices.length,
      });
    } catch (error: any) {
      console.error('Error fetching complete vendor catalog:', error);
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

