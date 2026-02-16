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
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query, insert, update, deleteRows } from '../database/rds-connection';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { inferSpecializationIdsFromCategory } from '../utils/infer-specialization-from-category';
import {
  categoryToApplicableRoles,
  defaultServiceStyleForRoles,
  normalizeServiceStyle,
  isAllowedServiceStyle,
} from '../utils/service-catalog-sync';

/** Map service_catalog category_id to specialization_master category_id for spec resolution */
const CATEGORY_TO_SPEC_CATEGORY: Record<string, string> = {
  veterinary: 'veterinary',
  grooming: 'grooming',
  training: 'training',
  walking: 'walking',
  diagnostic: 'veterinary',
  diagnostics: 'veterinary',
  pharmacy: 'veterinary',
  emergency: 'veterinary',
  wellness: 'wellness',
  specialty: 'veterinary',
  boarding: 'boarding',
  nutrition: 'wellness',
  behavioral: 'behavioral',
  behaviour: 'behavioral',
};

/**
 * Map role IDs/names to service catalog applicable_roles
 * Canonical roles (groomer_center, vet_solo, etc.) must map to names used in service_catalog.applicable_roles
 * so that catalog discovery shows the right services per vendor role.
 */
const roleMappings: Record<string, string[]> = {
  // ✅ FIX: Healthcare roles with clinic services
  'veterinarian': ['vet', 'veterinarian', 'vet_clinic', 'vet_solo'],
  'vet_solo': ['vet', 'veterinarian', 'vet_clinic', 'vet_solo', 'solo_vet'],
  'veterinary_clinic': ['vet_clinic', 'veterinary_clinic', 'vet', 'veterinarian'],
  'vet_clinic': ['vet_clinic', 'veterinary_clinic', 'vet', 'veterinarian', 'vet_solo'],
  // ✅ Diagnostics should NOT inherit vet services
  'diagnostics_center': ['diagnostics_center', 'diagnostics', 'diagnostic_center', 'diagnostics_provider', 'diagnostics_solo', 'lab', 'lab_center'],
  'diagnostics': ['diagnostics_center', 'diagnostics', 'diagnostic_center', 'diagnostics_provider', 'diagnostics_solo', 'lab', 'lab_center'],
  'diagnostic_center': ['diagnostics_center', 'diagnostics', 'diagnostic_center', 'diagnostics_provider', 'diagnostics_solo', 'lab', 'lab_center'],
  
  // ✅ FIX: Nutritionist should ONLY see nutrition services, NOT vet services
  'nutritionist': ['nutritionist', 'pet_nutritionist'],
  'nutritionist_center': ['nutritionist', 'pet_nutritionist', 'nutritionist_center'],
  
  'pet_pharmacy': ['pharmacy', 'pet_pharmacy'],
  'pet_ambulance': ['ambulance', 'pet_ambulance'],
  'ambulance': ['ambulance', 'pet_ambulance'],
  'pharmacy': ['pharmacy', 'pet_pharmacy'],
  'insurance': ['insurance', 'pet_insurance'],
  'center': ['vet_clinic', 'veterinarian', 'veterinary_clinic', 'center'],
  'testing_center': ['vet_clinic', 'veterinarian', 'veterinary_clinic', 'testing_center', 'center'],
  'clinic': ['vet_clinic', 'veterinarian', 'veterinary_clinic', 'clinic'],

  // Service provider – canonical + legacy so catalog matches
  'pet_groomer': ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo', 'pet_spa'],
  'groomer_center': ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo', 'pet_spa'],
  'groomer_solo': ['groomer', 'pet_groomer', 'groomer_center', 'groomer_solo', 'pet_spa'],
  'pet_walker': ['walker', 'pet_walker', 'dog_walker'],
  'walker': ['walker', 'pet_walker', 'dog_walker'],
  'pet_trainer': ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
  'trainer_center': ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
  'trainer_solo': ['trainer', 'pet_trainer', 'trainer_center', 'trainer_solo'],
  'pet_behaviorist': ['behaviorist', 'pet_behaviorist', 'behaviorist_solo', 'behaviorist_center'],
  'behaviorist_solo': ['behaviorist_solo', 'pet_behaviorist', 'behaviorist'],
  'behaviorist_center': ['behaviorist_center', 'pet_behaviorist', 'behaviorist'],
  'pet_sitter': ['sitter', 'pet_sitter'],
  'sitter': ['sitter', 'pet_sitter'],
  'pet_taxi': ['transport', 'pet_transport', 'pet_taxi', 'relocation'],
  'relocation': ['pet_transport', 'relocation', 'pet_relocation'],
  'pet_boarding': ['boarding', 'pet_boarder', 'pet_hotel', 'pet_boarding', 'pet_daycare'],
  'boarding': ['boarding', 'pet_boarder', 'pet_daycare', 'pet_sitter'],
  'pet_resort': ['resort', 'pet_resort'],
  'resort': ['resort', 'pet_resort'],
  'pet_cafe': ['cafe', 'pet_cafe'],
  'cafe': ['cafe', 'pet_cafe'],
  'pet_photographer': ['photographer', 'pet_photographer'],
  'photographer': ['photographer', 'pet_photographer'],
  'pet_sunset_services': ['sunset', 'pet_sunset_services', 'sunset_services'],
  'sunset': ['sunset', 'pet_sunset_services'],
  'holiday': ['holiday'],

  // Retail
  'pet_products_store': ['store', 'pet_store', 'retailer', 'seller', 'pet_products_store'],
  'seller': ['store', 'pet_store', 'seller', 'pet_products_store'],
  'pet_breeder': ['breeder', 'pet_breeder'],
  'breeder': ['breeder', 'pet_breeder'],

  // Other
  'pet_shelter': ['shelter', 'pet_shelter', 'adoption_center', 'pet_adoption_center'],
  'adoption_center': ['adoption_center', 'pet_shelter', 'pet_adoption_center'],
  'event_organizer': ['pet_event_organizer', 'event_organizer'],
};

/** Phase 2: Normalize to canonical codes only (at_home, at_center, tele) for filtering. */
const STYLE_ALIAS_TO_CODE: Record<string, string> = {
  at_center: 'at_center', at_clinic: 'at_center', at_vendor: 'at_center',
  at_home: 'at_home', home_visit: 'at_home', home_service: 'at_home',
  tele: 'tele', video_consultation: 'tele', tele_consultation: 'tele', online: 'tele', video: 'tele',
};
const CANONICAL_STYLES = ['at_home', 'at_center', 'tele'];
function toCanonicalServiceStyles(arr: string[]): string[] {
  const codes = (arr || [])
    .map((s: string) => (s && typeof s === 'string' ? STYLE_ALIAS_TO_CODE[s.toLowerCase().replace(/\s+/g, '_')] || s.toLowerCase().replace(/\s+/g, '_') : null))
    .filter((c: string | null): c is string => !!c && CANONICAL_STYLES.includes(c));
  return [...new Set(codes)];
}

export function registerServiceCatalogEndpoints(app: Hono) {
  /**
   * GET /services
   * List all active services (customer-facing endpoint)
   */
  app.get("/services", async (c) => {
    try {
      const { category, vendor_id, limit = '50' } = c.req.query();

      let queryText = `
        SELECT s.*, v.business_name as vendor_name, v.category as vendor_category
        FROM services s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE s.is_active = true
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (category) {
        queryText += ` AND s.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (vendor_id) {
        queryText += ` AND s.vendor_id = $${paramIndex}`;
        params.push(vendor_id);
        paramIndex++;
      }

      queryText += ` ORDER BY s.created_at DESC LIMIT $${paramIndex}`;
      params.push(parseInt(limit));

      const result = await query(queryText, params);

      return c.json({
        success: true,
        count: result.rows.length,
        services: result.rows,
      });
    } catch (error: any) {
      return c.json({
        success: false,
        error: error.message,
      }, 500);
    }
  });

  /**
   * GET /services/:serviceId
   * Get service details by ID (customer-facing endpoint)
   */
  app.get("/services/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();

      // ✅ FIX: Handle UUID vs text comparison properly
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);

      // 1. Try service_catalog first
      const services = await query(
        isUUID
          ? `SELECT * FROM service_catalog
             WHERE (service_id = $1 OR id = $1::uuid)
             AND status = 'active'`
          : `SELECT * FROM service_catalog
             WHERE (service_id = $1 OR id::text = $1)
             AND status = 'active'`,
        [serviceId]
      );

      if (services.rows.length > 0) {
        const service = services.rows[0];
        const serviceData = {
          id: service.service_id || `catalog_${service.id}`,
          serviceId: service.service_id || `catalog_${service.id}`,
          catalogId: service.id,
          serviceName: service.service_name,
          name: service.service_name,
          displayName: service.display_name || service.service_name,
          description: service.description,
          categoryId: service.category_id,
          categoryName: service.category_name,
          subCategoryId: service.sub_category_id,
          subCategoryName: service.sub_category_name,
          applicableRoles: service.applicable_roles || [],
          specializationIds: service.specialization_ids || [],
          specialization_ids: service.specialization_ids || [],
          service_style: service.service_style,
          serviceStyle: service.service_style || 'at_center',
          basePrice: parseFloat(service.base_price || '0'),
          price: parseFloat(service.base_price || '0'),
          duration: service.duration_minutes || 30,
          durationMinutes: service.duration_minutes || 30,
          status: service.status,
          publishStatus: service.publish_status,
          metadata: service.metadata || {},
        };
        return c.json({
          success: true,
          service: serviceData,
          // Also include flat structure for backward compatibility
          ...serviceData,
        });
      }

      // 2. Try vendor_services.id (ProblemGridFlowRouter passes vendor_services.id from by-problem)
      const vsResultById = await query(
        `SELECT vs.*, v.business_name as vendor_name, v.address as vendor_address
         FROM vendor_services vs
         INNER JOIN vendors v ON vs.vendor_id = v.id
         WHERE vs.id = $1::uuid AND vs.is_enabled = true`,
        [serviceId]
      );

      if (vsResultById.rows.length > 0) {
        const vs = vsResultById.rows[0];
        const price = vs.custom_price != null ? parseFloat(vs.custom_price) : parseFloat(vs.price || '0');
        return c.json({
          success: true,
          service: {
            id: vs.id,
            serviceId: vs.id,
            serviceName: vs.service_name,
            name: vs.service_name,
            displayName: vs.service_name,
            description: vs.custom_description || vs.service_name,
            vendor_id: vs.vendor_id,
            vendor_name: vs.vendor_name,
            vendor_address: vs.vendor_address,
            service_style: vs.service_style || 'at_center',
            serviceStyle: vs.service_style || 'at_center',
            basePrice: price,
            price,
            duration: vs.custom_duration ?? vs.duration_minutes ?? 30,
            durationMinutes: vs.custom_duration ?? vs.duration_minutes ?? 30,
            category: vs.category,
            sub_category: vs.sub_category,
          },
          // Also include flat structure for backward compatibility
          id: vs.id,
          serviceId: vs.id,
          serviceName: vs.service_name,
          name: vs.service_name,
          displayName: vs.service_name,
          description: vs.custom_description || vs.service_name,
          vendor_id: vs.vendor_id,
          vendor_name: vs.vendor_name,
          vendor_address: vs.vendor_address,
          service_style: vs.service_style || 'at_center',
          serviceStyle: vs.service_style || 'at_center',
          basePrice: price,
          price,
          duration: vs.custom_duration ?? vs.duration_minutes ?? 30,
          durationMinutes: vs.custom_duration ?? vs.duration_minutes ?? 30,
          category: vs.category,
          sub_category: vs.sub_category,
        });
      }

      // 3. Fallback: vendor_services.service_id (base service UUID) - in case serviceId is the base service UUID
      if (isUUID) {
        const vsResultByServiceId = await query(
          `SELECT vs.*, v.business_name as vendor_name, v.address as vendor_address
           FROM vendor_services vs
           INNER JOIN vendors v ON vs.vendor_id = v.id
           WHERE vs.service_id = $1::uuid AND vs.is_enabled = true
           LIMIT 1`,
          [serviceId]
        );

        if (vsResultByServiceId.rows.length > 0) {
          const vs = vsResultByServiceId.rows[0];
          const price = vs.custom_price != null ? parseFloat(vs.custom_price) : parseFloat(vs.price || '0');
          return c.json({
            success: true,
            service: {
              id: vs.id,
              serviceId: vs.id,
              serviceName: vs.service_name,
              name: vs.service_name,
              displayName: vs.service_name,
              description: vs.custom_description || vs.service_name,
              vendor_id: vs.vendor_id,
              vendor_name: vs.vendor_name,
              vendor_address: vs.vendor_address,
              service_style: vs.service_style || 'at_center',
              serviceStyle: vs.service_style || 'at_center',
              basePrice: price,
              price,
              duration: vs.custom_duration ?? vs.duration_minutes ?? 30,
              durationMinutes: vs.custom_duration ?? vs.duration_minutes ?? 30,
              category: vs.category,
              sub_category: vs.sub_category,
            },
            // Also include flat structure for backward compatibility
            id: vs.id,
            serviceId: vs.id,
            serviceName: vs.service_name,
            name: vs.service_name,
            displayName: vs.service_name,
            description: vs.custom_description || vs.service_name,
            vendor_id: vs.vendor_id,
            vendor_name: vs.vendor_name,
            vendor_address: vs.vendor_address,
            service_style: vs.service_style || 'at_center',
            serviceStyle: vs.service_style || 'at_center',
            basePrice: price,
            price,
            duration: vs.custom_duration ?? vs.duration_minutes ?? 30,
            durationMinutes: vs.custom_duration ?? vs.duration_minutes ?? 30,
            category: vs.category,
            sub_category: vs.sub_category,
          });
        }
      }

      return c.json({ error: 'Service not found' }, 404);
    } catch (error: any) {
      console.error('Error fetching service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

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

      // ✅ FIX: Normalize role config (walker etc. may have serviceStyles as object { selected: ['at_home'] })
      const rawServiceStyles = roleConfig?.serviceStyles;
      const rawArray = Array.isArray(rawServiceStyles)
        ? rawServiceStyles
        : (rawServiceStyles?.selected ?? rawServiceStyles?.solo ?? (rawServiceStyles ? [] : []));
      const allowedServiceStylesArray = toCanonicalServiceStyles(rawArray);
      const vendorConfiguration = roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
      
      // ✅ CRITICAL: Solo providers cannot use at_center services
      if (vendorConfiguration === 'solo' && serviceStyle === 'at_center') {
        return c.json({
          success: true,
          roleId,
          serviceStyle: serviceStyle || 'all',
          services: [],
          total: 0,
          message: 'Solo providers cannot use "at_center" service style. Only "at_home" and "tele" are allowed.',
          role: role ? {
            id: role.id,
            name: role.name,
            display_name: role.display_name,
            config: roleConfig,
          } : null,
          vendorTypes: roleConfig?.vendorTypes || [],
          serviceStyles: allowedServiceStylesArray,
        });
      }

      // Use role from DB if available, otherwise use mappings (include display_name for matching)
      const roleNameNorm = role?.name?.toLowerCase().replace(/\s+/g, '_');
      const displayNameNorm = role?.display_name?.toLowerCase().replace(/\s+/g, '_');
      const acceptableRoles = role
        ? [
            role.name,
            role.id,
            role.display_name,
            ...(roleMappings[role.name] || []),
            ...(roleMappings[roleId] || []),
            ...(roleNameNorm ? (roleMappings[roleNameNorm] || []) : []),
            ...(displayNameNorm ? (roleMappings[displayNameNorm] || [displayNameNorm]) : []),
          ]
        : (roleMappings[roleId] || [roleId]);

      // Remove duplicates and null/undefined
      const uniqueRoles = [...new Set(acceptableRoles.filter(Boolean))];

      // ✅ STRICT: Only return services that explicitly list this role (no NULL/empty = show to all)
      let catalogQuery = `
        SELECT * FROM service_catalog
        WHERE status = 'active'
        AND publish_status = 'published'
        AND array_length(applicable_roles, 1) > 0
        AND applicable_roles && $1::text[]
      `;

      const params: any[] = [uniqueRoles];
      let paramIndex = 2;

      // ✅ FIX: For solo providers, exclude at_center services even if serviceStyle is not specified
      if (vendorConfiguration === 'solo') {
        catalogQuery += ` AND (service_style != 'at_center' OR service_style = 'all' OR service_style IS NULL)`;
      }

      // ✅ Phase 2: When no serviceStyle query, filter by role's allowed styles so Walker never sees at_center catalog.
      if (!serviceStyle && allowedServiceStylesArray.length > 0) {
        catalogQuery += ` AND (service_style = ANY($${paramIndex}::text[]) OR service_style = 'all' OR service_style IS NULL)`;
        params.push(allowedServiceStylesArray);
        paramIndex++;
      }

      // ✅ FIX: Support comma-separated serviceStyle (e.g. at_home,tele) so solo providers get both styles
      if (serviceStyle) {
        const styles = serviceStyle.split(',').map((s: string) => s.trim()).filter(Boolean);
        const validStyles = styles.filter((s: string) => ['at_home', 'at_center', 'tele', 'all'].includes(s));
        if (validStyles.length > 1) {
          catalogQuery += ` AND service_style = ANY($${paramIndex}::text[])`;
          params.push(validStyles);
          paramIndex++;
        } else if (validStyles.length === 1) {
          catalogQuery += ` AND service_style = $${paramIndex}`;
          params.push(validStyles[0]);
          paramIndex++;
        }
      }

      catalogQuery += ` ORDER BY display_order ASC`;

      const services = await query(catalogQuery, params);

      const filteredServices = services.rows.map((service: any) => ({
        // ✅ CRITICAL FIX: NEVER use service_catalog.id (UUID) as id/serviceId
        // Only use service_id (TEXT) to prevent UUID collisions with vendor_services.id
        // The catalog UUID might match another vendor's vendor_services.id, causing wrong service updates
        id: service.service_id || `catalog_${service.id}`, // Use TEXT service_id, or prefixed catalog UUID if service_id is null
        serviceId: service.service_id || `catalog_${service.id}`, // Use TEXT service_id, or prefixed catalog UUID if service_id is null
        catalogId: service.id, // Store catalog UUID separately for reference (but don't use as id)
        serviceName: service.service_name,
        displayName: service.display_name || service.service_name,
        name: service.service_name,
        description: service.description,
        categoryId: service.category_id,
        categoryName: service.category_name && String(service.category_name).trim() ? service.category_name : (service.category_id === 'veterinary' ? 'Veterinary Services' : service.category_id === 'diagnostic' ? 'Diagnostics & Lab' : service.category_id === 'grooming' ? 'Grooming & Hygiene' : service.category_id || 'General'),
        subCategoryId: service.sub_category_id,
        subCategoryName: service.sub_category_name,
        applicableRoles: service.applicable_roles || [],
        specializationIds: service.specialization_ids || [],
        specialization_ids: service.specialization_ids || [],
        serviceStyle: service.service_style || 'at_center',
        basePrice: parseFloat(service.base_price || '0'),
        price: parseFloat(service.base_price || '0'),
        duration: service.duration_minutes || 30,
        durationMinutes: service.duration_minutes || 30,
        status: service.status,
        publishStatus: service.publish_status,
        metadata: service.metadata || {},
        isPackage: !!(service.metadata && (service.metadata as any).isPackage),
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
        // Phase 1: Always return canonical codes only (at_home, at_center, tele); never raw config.
        serviceStyles: allowedServiceStylesArray,
      });
    } catch (error: any) {
      console.error('Error fetching service catalog:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /service-catalog/:serviceId
   * Get service details
   * NOTE: 'categories' is handled by a specific route below, but due to route registration order,
   * this parameterized route may match first. We explicitly redirect 'categories' requests.
   */
  app.get("/service-catalog/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();
      
      // CRITICAL: If serviceId is 'categories', return graceful response
      // The specific /service-catalog/categories route should handle this, but due to
      // route registration order, this parameterized route may match first
      // When parameterized route matches /service-catalog/categories, return full payload (icon, icon_color, is_active)
      // so customer web dynamic categories work even when this route is registered before the specific route
      if (serviceId === 'categories') {
        console.log('[Service Catalog] Parameterized route caught categories request, returning full payload');
        try {
          const categories = await query(`
            SELECT 
              id::text as id,
              COALESCE(category_id::text, '') as category_id,
              name::text as name,
              COALESCE(description::text, '') as description,
              COALESCE(icon::text, '') as icon,
              COALESCE(icon_color::text, 'text-gray-500') as icon_color,
              COALESCE(display_order::integer, 0) as display_order,
              COALESCE(created_at::text, '') as created_at
            FROM service_categories
            WHERE (is_active = true OR is_active IS NULL)
            LIMIT 1000
          `).catch(() => ({ rows: [] }));
          const sorted = (categories.rows || []).sort((a: any, b: any) => {
            const orderA = parseInt(a.display_order) || 0;
            const orderB = parseInt(b.display_order) || 0;
            if (orderA !== orderB) return orderA - orderB;
            return (a.name || '').localeCompare(b.name || '');
          });
          return c.json({
            success: true,
            categories: sorted,
            total: sorted.length,
          }, 200);
        } catch (catError: any) {
          return c.json({
            success: true,
            categories: [],
            total: 0,
            message: `Categories query failed: ${catError?.message || 'Unknown error'}`,
          }, 200);
        }
      }

      // ✅ FIX: Handle UUID vs text comparison properly
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
      
      const services = await query(
        isUUID
          ? `SELECT * FROM service_catalog
             WHERE (service_id = $1 OR id = $1::uuid)
             AND status = 'active'`
          : `SELECT * FROM service_catalog
             WHERE (service_id = $1 OR id::text = $1)
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
          specializationIds: service.specialization_ids || [],
          specialization_ids: service.specialization_ids || [],
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
    // CRITICAL: Wrap entire handler in try-catch at the TOP LEVEL
    // This ensures we ALWAYS return 200, even if errors escape all other handlers
    try {
      console.log('[Service Categories] Handler called, path:', c.req.path);
      // CRITICAL: Wrap entire handler to ensure ALL errors return 200
      // Use async IIFE to catch any errors that escape
      return await (async () => {
      try {
        console.log('[Service Categories] Starting query execution');
      // Try to query service_categories table
      // NOTE: If this fails with "uuid = text" error, it's due to schema conflict:
      // - Migration 001 creates parent_category_id UUID
      // - Migration 002 adds foreign key: parent_category_id UUID REFERENCES service_categories(id)
      // - Migration 048 adds category_id TEXT
      // The foreign key constraint causes type mismatch errors
      
      // Check if parent_category_id column exists (migration 059 should have dropped it)
      // If it still exists, we need to handle the UUID/text conflict carefully
      let columnCheck;
      try {
        columnCheck = await query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'service_categories' 
          AND column_name = 'parent_category_id'
        `);
      } catch (e) {
        columnCheck = { rows: [] };
      }
      
      const hasParentCategoryId = columnCheck.rows.length > 0;
      
      // Avoid UUID/text constraint issues by casting all UUIDs to text
      // The parent_category_id UUID column with foreign key causes type mismatch errors
      // We only select columns that don't trigger the foreign key constraint
      let categories;
      try {
        // First check if there's a foreign key constraint causing issues
        const constraintCheck = await query(`
          SELECT conname, conrelid::regclass::text as table_name
          FROM pg_constraint
          WHERE conrelid = 'service_categories'::regclass
          AND conname LIKE '%parent_category%'
        `).catch(() => ({ rows: [] }));
        
        // Try query with explicit casting to avoid UUID/text conflicts
        // First check if table exists
        const tableExists = await query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'service_categories'
          )
        `).catch(() => ({ rows: [{ exists: false }] }));
        
        if (!tableExists.rows[0]?.exists) {
          return c.json({
            success: true,
            categories: [],
            total: 0,
            message: 'Service categories table does not exist.',
          }, 200);
        }
        
        // Try simple query first - wrap in try-catch AND .catch() to ensure ALL errors are caught
        try {
          console.log('[Service Categories] Executing main query');
          categories = await query(`
            SELECT 
              id::text as id,
              COALESCE(category_id::text, '') as category_id,
              name::text as name,
              COALESCE(description::text, '') as description,
              COALESCE(icon::text, '') as icon,
              COALESCE(icon_color::text, 'text-gray-500') as icon_color,
              COALESCE(display_order::integer, 0) as display_order,
              COALESCE(created_at::text, '') as created_at
            FROM service_categories
            WHERE (is_active = true OR is_active IS NULL)
            LIMIT 1000
          `).catch((queryErr: any) => {
            // If .catch() catches it, throw to be caught by try-catch
            console.error('[Service Categories] Query .catch() caught error:', queryErr?.message);
            throw queryErr;
          });
          console.log('[Service Categories] Query succeeded, rows:', categories?.rows?.length || 0);
        } catch (queryErr: any) {
          // If try-catch catches it, throw to be caught by outer catch
          console.error('[Service Categories] Query try-catch caught error:', queryErr?.message);
          throw queryErr;
        }
      } catch (error: any) {
        console.error('[Service Categories] Inner catch block - error:', error?.message, 'type:', typeof error);
        // If query fails due to UUID/text conflict, return empty array gracefully
        if (error?.message?.includes('uuid = text') || 
            error?.message?.includes('operator does not exist') ||
            error?.message?.includes('uuid =')) {
          console.warn('[Service Categories] UUID/text conflict detected, returning empty array (200)');
          return c.json({
            success: true,
            categories: [],
            total: 0,
            message: 'Service categories table has schema constraint issue. Migration 059 should fix this.',
          }, 200); // Return 200, not 500
        }
        // For any other error, also return gracefully
        console.error('[Service Categories] Query error, returning 200 with empty array:', error?.message);
        return c.json({
          success: true,
          categories: [],
          total: 0,
          message: `Service categories query failed: ${error?.message || 'Unknown error'}`,
        }, 200); // Return 200, not 500
      }
      
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
      console.error('[Service Categories] Outer catch block - error:', error?.message, 'type:', typeof error, 'stack:', error?.stack?.substring(0, 200));
      // If uuid = text error, return empty array with helpful message (200, not 500)
      // This is a known database schema issue from conflicting migrations
      // The table has parent_category_id UUID with foreign key constraint that causes type mismatch
      // This requires a manual database migration to fix properly
      if (error?.message && (
        error.message.includes('does not exist') || 
        error.message.includes('operator does not exist') ||
        error.message.includes('uuid = text') ||
        error.message.includes('uuid =')
      )) {
        console.log('[Service Categories] Outer catch - UUID/text error detected, returning 200');
        return c.json({
          success: true,
          categories: [],
          total: 0,
          message: 'Service categories table has schema constraint issue (uuid = text). The parent_category_id UUID column with foreign key from migration 002 conflicts with category_id TEXT from migration 048. This requires a manual database migration to drop the parent_category_id column and foreign key constraint. For now, endpoint returns empty array. Call POST /admin/migrations/fix-service-categories-constraint to attempt automatic fix.'
        }, 200); // Return 200, not 500
      }
      // For any other error, also return gracefully
      console.log('[Service Categories] Outer catch - Other error, returning 200');
      return c.json({
        success: true,
        categories: [],
        total: 0,
        message: `Service categories query failed: ${error?.message || 'Unknown error'}`,
      }, 200); // Return 200, not 500
    }
    })().catch((finalError: any) => {
      // Ultimate catch-all - ensure we NEVER return 500
      console.error('[Service Categories] Ultimate catch-all (IIFE .catch):', finalError?.message, 'type:', typeof finalError);
      return c.json({
        success: true,
        categories: [],
        total: 0,
        message: `Service categories query failed: ${finalError?.message || 'Unknown error'}`,
      }, 200);
    });
    } catch (topLevelError: any) {
      // TOP-LEVEL catch-all - this should NEVER be reached, but if it is, return 200
      console.error('[Service Categories] TOP-LEVEL catch-all - This should never happen:', topLevelError?.message);
      return c.json({
        success: true,
        categories: [],
        total: 0,
        message: `Service categories query failed: ${topLevelError?.message || 'Unknown error'}`,
      }, 200);
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
      const serviceStyle = c.req.query('serviceStyle'); // ✅ NEW: Filter by service style (at_home, at_center, tele)

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

      // ✅ FIX: When roleId is provided (vendor accessing catalog), default to active and published services
      if (roleId && !status) {
        catalogQuery += ` AND status = $${paramIndex} AND (publish_status = $${paramIndex + 1} OR publish_status IS NULL)`;
        params.push('active', 'published');
        paramIndex += 2;
      } else if (status) {
        catalogQuery += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (roleId || vendorRole) {
        const targetRole = role || vendorRole;
        const acceptableRoles = targetRole
          ? [
              targetRole.name, 
              targetRole.id, 
              targetRole.display_name, // ✅ Add display_name to matching
              ...(roleMappings[targetRole.name] || []), 
              ...(roleMappings[roleId || ''] || []),
              // ✅ Add normalized variations (lowercase, with underscores, etc.)
              targetRole.name?.toLowerCase(),
              targetRole.name?.toLowerCase().replace(/\s+/g, '_'),
              targetRole.name?.toLowerCase().replace(/\s+/g, '-'),
            ]
          : (roleMappings[roleId || ''] || [roleId || '']);
        const uniqueRoles = [...new Set(acceptableRoles.filter(Boolean))];
        
        console.log(`[Admin Service Catalog] Role filtering - targetRole: ${targetRole?.name}, acceptableRoles: ${JSON.stringify(uniqueRoles)}`);
        
        // ✅ IMPROVED: More lenient query - show services that match role OR have NULL applicable_roles (available to all)
        catalogQuery += ` AND (applicable_roles && $${paramIndex}::text[] OR applicable_roles IS NULL OR array_length(applicable_roles, 1) IS NULL)`;
        params.push(uniqueRoles);
        paramIndex++;
        
        // ✅ DYNAMIC SERVICE STYLES: Only filter at_center for solo-only roles
        const vendorConfiguration = roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
        const targetRoleName = (role?.name || vendorRole?.name || '').toLowerCase().replace(/\s+/g, '_');
        const CENTER_CAPABLE_SOLO_ROLES = ['pet_trainer', 'trainer', 'pet_groomer', 'groomer', 'veterinarian', 'vet'];
        const SOLO_ONLY_ROLES = ['pet_sitter', 'sitter', 'pet_walker', 'walker', 'pet_taxi'];
        const isCenterCapableSolo = CENTER_CAPABLE_SOLO_ROLES.includes(targetRoleName);
        const isSoloOnlyRole = SOLO_ONLY_ROLES.includes(targetRoleName);
        
        if (vendorConfiguration === 'solo' && isSoloOnlyRole && !isCenterCapableSolo) {
          catalogQuery += ` AND (service_style != $${paramIndex} OR service_style IS NULL)`;
          params.push('at_center');
          paramIndex++;
          console.log(`[Admin Service Catalog] Solo-only role (${targetRoleName}) - filtering at_center services`);
        } else if (vendorConfiguration === 'solo' && isCenterCapableSolo) {
          console.log(`[Admin Service Catalog] Center-capable solo (${targetRoleName}) - showing all services`);
        }
      } else {
        // ✅ Also check roleConfig even if roleId wasn't provided but vendorRole was loaded
        const vendorConfiguration = roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
        const vendorRoleNameAlt = (vendorRole?.name || '').toLowerCase().replace(/\s+/g, '_');
        const CENTER_CAPABLE_SOLO_ROLES_ALT = ['pet_trainer', 'trainer', 'pet_groomer', 'groomer', 'veterinarian', 'vet'];
        const SOLO_ONLY_ROLES_ALT = ['pet_sitter', 'sitter', 'pet_walker', 'walker', 'pet_taxi'];
        const isCenterCapableSoloAlt = CENTER_CAPABLE_SOLO_ROLES_ALT.includes(vendorRoleNameAlt);
        const isSoloOnlyRoleAlt = SOLO_ONLY_ROLES_ALT.includes(vendorRoleNameAlt);
        
        if (vendorConfiguration === 'solo' && isSoloOnlyRoleAlt && !isCenterCapableSoloAlt) {
          catalogQuery += ` AND (service_style != $${paramIndex} OR service_style IS NULL)`;
          params.push('at_center');
          paramIndex++;
          console.log(`[Admin Service Catalog] Solo-only role (${vendorRoleNameAlt}) - filtering at_center services`);
        } else if (vendorConfiguration === 'solo' && isCenterCapableSoloAlt) {
          console.log(`[Admin Service Catalog] Center-capable solo (${vendorRoleNameAlt}) - showing all services`);
        }
      }

      // ✅ NEW: Filter by service style if provided
      if (serviceStyle && ['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        catalogQuery += ` AND service_style = $${paramIndex}`;
        params.push(serviceStyle);
        paramIndex++;
        console.log(`[Admin Service Catalog] Filtering by service style: ${serviceStyle}`);
      }

      catalogQuery += ` ORDER BY category_name ASC, sub_category_name ASC NULLS LAST, display_order ASC, service_name ASC`;

      const services = await query(catalogQuery, params);

      // Helper: never expose "Uncategorized" - use role-based or generic default so all discovered services are categorized
      const categoryDisplay = (slug: string) =>
        slug ? String(slug).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
      const defaultCategoryName =
        (roleConfig?.category && categoryDisplay(roleConfig.category as string)) ||
        (role?.display_name && String(role.display_name)) ||
        'General';
      const defaultCategoryId = (roleConfig?.category && String(roleConfig.category).replace(/\s+/g, '_')) || 'general';

      // If groupBy is 'category' or 'subcategory', group services hierarchically
      if (groupBy === 'category' || groupBy === 'subcategory') {
        const grouped: Record<string, any> = {};
        
        (services.rows || []).forEach((service: any) => {
          const effectiveCategoryName = service.category_name?.trim() || defaultCategoryName;
          const effectiveCategoryId = service.category_id?.trim() || defaultCategoryId;
          // Ensure all service fields are safe; never use "Uncategorized"
          const safeService = {
            ...service,
            id: String(service.id || service.service_id || ''),
            service_id: String(service.service_id || service.id || ''),
            service_name: String(service.service_name || ''),
            category_id: effectiveCategoryId,
            category_name: effectiveCategoryName,
            sub_category_id: String(service.sub_category_id || ''),
            sub_category_name: String(service.sub_category_name || ''),
            specialization_ids: service.specialization_ids || [],
            specializationIds: service.specialization_ids || [],
          };
          
          const categoryKey = effectiveCategoryName;
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
          data: groupedArray, // ✅ Use 'data' key for consistency
          services: groupedArray, // ✅ Keep 'services' for backward compatibility
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

      // Ensure all service fields are safe; never return uncategorized (use role-based default)
      const safeServices = (services.rows || []).map((service: any) => {
        const effectiveCategoryName = service.category_name?.trim() || defaultCategoryName;
        const effectiveCategoryId = service.category_id?.trim() || defaultCategoryId;
        return {
          ...service,
          id: String(service.id || service.service_id || ''),
          service_id: String(service.service_id || service.id || ''),
          service_name: String(service.service_name || ''),
          category_id: effectiveCategoryId,
          category_name: effectiveCategoryName,
          sub_category_id: String(service.sub_category_id || ''),
          sub_category_name: String(service.sub_category_name || ''),
          specialization_ids: service.specialization_ids || [],
          specializationIds: service.specialization_ids || [],
        };
      });

      return c.json({
        success: true,
        data: safeServices, // ✅ Use 'data' key for consistency
        services: safeServices, // ✅ Keep 'services' for backward compatibility
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

      // Handle test IDs - return empty catalog
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          vendorServices: [],
          availableCatalog: [],
          role: null,
          capabilities: [],
          totalVendorServices: 0,
          totalAvailableServices: 0,
        });
      }
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
            
            // ✅ DYNAMIC SERVICE STYLES: Handle center-capable solo roles correctly
            const vendorConfiguration = roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
            const roleName = (role.name || '').toLowerCase().replace(/\s+/g, '_');
            
            // Center-capable roles CAN have at_center even as solo
            const CENTER_CAPABLE_SOLO_ROLES = ['pet_trainer', 'trainer', 'pet_groomer', 'groomer', 'veterinarian', 'vet'];
            const SOLO_ONLY_ROLES = ['pet_sitter', 'sitter', 'pet_walker', 'walker', 'pet_taxi'];
            const isCenterCapableSolo = CENTER_CAPABLE_SOLO_ROLES.includes(roleName);
            const isSoloOnlyRole = SOLO_ONLY_ROLES.includes(roleName);
            
            if (vendorConfiguration === 'solo' && isSoloOnlyRole && !isCenterCapableSolo) {
              allowedServiceStyles = allowedServiceStyles.filter((style: string) => style !== 'at_center');
              console.log(`[Service Catalog Complete] Solo-only role (${roleName}) - filtered at_center. Allowed: ${allowedServiceStyles.join(', ')}`);
            } else if (vendorConfiguration === 'solo' && isCenterCapableSolo) {
              console.log(`[Service Catalog Complete] Center-capable solo (${roleName}) - keeping all: ${allowedServiceStyles.join(', ')}`);
            }
            
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
      
      // ✅ DYNAMIC SERVICE STYLES: Vendor table solo check (secondary source)
      const vendorRoleNameCat = role?.name?.toLowerCase().replace(/\s+/g, '_') || '';
      const vendorCenterCapableRolesCat = ['pet_trainer', 'trainer', 'pet_groomer', 'groomer', 'veterinarian', 'vet'];
      const isVendorCenterCapableCat = vendorCenterCapableRolesCat.includes(vendorRoleNameCat);
      
      if ((vendor.vendor_configuration === 'solo' || vendor.vendorConfiguration === 'solo' || vendor.vendor_type === 'solo') && !isVendorCenterCapableCat) {
        allowedServiceStyles = allowedServiceStyles.filter((style: string) => style !== 'at_center');
        console.log(`[Service Catalog Complete] Solo vendor (${vendorRoleNameCat}) - not center-capable, filtered: ${allowedServiceStyles.join(', ')}`);
      } else if (vendor.vendor_configuration === 'solo' || vendor.vendorConfiguration === 'solo' || vendor.vendor_type === 'solo') {
        console.log(`[Service Catalog Complete] Solo vendor (${vendorRoleNameCat}) - center-capable, keeping all: ${allowedServiceStyles.join(', ')}`);
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
          specializationIds: s.specialization_ids || [],
          specialization_ids: s.specialization_ids || [],
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
      // Accept both snake_case and camelCase so admin UIs (Ecosystem Development, admin-web) work
      const service_id = body.service_id ?? body.serviceId ?? null;
      const service_name = body.service_name ?? body.serviceName ?? null;
      const display_name = body.display_name ?? body.displayName ?? body.service_name ?? body.serviceName ?? null;
      const description = body.description ?? '';
      const category_id = body.category_id ?? body.categoryId ?? null;
      const category_name = body.category_name ?? body.categoryName ?? null;
      const sub_category_id = body.sub_category_id ?? body.subCategoryId ?? null;
      const sub_category_name = body.sub_category_name ?? body.subCategoryName ?? null;
      const applicable_roles = Array.isArray(body.applicable_roles) ? body.applicable_roles : (Array.isArray(body.applicableRoles) ? body.applicableRoles : []);
      const service_style = body.service_style ?? body.serviceStyle ?? 'at_center';
      const base_price = body.base_price ?? body.basePrice ?? 0;
      const duration_minutes = body.duration_minutes ?? body.duration ?? 30;
      const metadata = body.metadata ?? {};
      const display_order = body.display_order ?? body.displayOrder ?? 0;
      const bodySpecIds = body.specialization_ids;
      const specializationIds = body.specializationIds;
      const specialization_ids = Array.isArray(bodySpecIds) ? bodySpecIds : (Array.isArray(specializationIds) ? specializationIds : []);

      // Validation
      if (!service_id || !service_name || !applicable_roles || applicable_roles.length === 0) {
        return c.json({ 
          error: 'service_id (or serviceId), service_name (or serviceName), and applicable_roles (or applicableRoles) are required' 
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
        service_style: (service_style === 'centre' ? 'at_center' : service_style) || 'at_center',
        base_price: Number(base_price) || 0,
        duration_minutes: Number(duration_minutes) || 30,
        status: 'active',
        publish_status: 'published',
        metadata: metadata || {},
        display_order: Number(display_order) || 0,
        specialization_ids: specialization_ids.length ? specialization_ids : [],
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

      // ✅ FIX: Handle UUID vs text comparison properly
      // Check if serviceId is a UUID format
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
      
      let existing;
      if (isUUID) {
        // If it's a UUID, cast both columns appropriately
        existing = await query(
          'SELECT * FROM service_catalog WHERE service_id = $1 OR id = $1::uuid',
          [serviceId]
        );
      } else {
        // If it's text (service_id), compare as text
        existing = await query(
          'SELECT * FROM service_catalog WHERE service_id = $1 OR id::text = $1',
          [serviceId]
        );
      }

      if (existing.rows.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      const service = existing.rows[0];

      // Update service — accept both snake_case and camelCase so admin UIs work
      const updateData: any = {};
      const v = (snake: any, camel: any) => snake !== undefined ? snake : camel;
      if (v(body.service_name, body.serviceName) !== undefined) updateData.service_name = v(body.service_name, body.serviceName);
      if (v(body.display_name, body.displayName) !== undefined) updateData.display_name = v(body.display_name, body.displayName);
      if (body.description !== undefined) updateData.description = body.description;
      if (v(body.category_id, body.categoryId) !== undefined) updateData.category_id = v(body.category_id, body.categoryId);
      if (v(body.category_name, body.categoryName) !== undefined) updateData.category_name = v(body.category_name, body.categoryName);
      if (v(body.sub_category_id, body.subCategoryId) !== undefined) updateData.sub_category_id = v(body.sub_category_id, body.subCategoryId);
      if (v(body.sub_category_name, body.subCategoryName) !== undefined) updateData.sub_category_name = v(body.sub_category_name, body.subCategoryName);
      const applicableRoles = Array.isArray(body.applicable_roles) ? body.applicable_roles : (Array.isArray(body.applicableRoles) ? body.applicableRoles : undefined);
      if (applicableRoles !== undefined) updateData.applicable_roles = applicableRoles;
      const serviceStyle = body.service_style ?? body.serviceStyle;
      if (serviceStyle !== undefined) updateData.service_style = serviceStyle === 'centre' ? 'at_center' : serviceStyle;
      const basePrice = body.base_price ?? body.basePrice;
      if (basePrice !== undefined) updateData.base_price = Number(basePrice);
      const durationMinutes = body.duration_minutes ?? body.duration ?? body.durationMinutes;
      if (durationMinutes !== undefined) updateData.duration_minutes = Number(durationMinutes);
      if (body.status !== undefined) updateData.status = body.status;
      if (body.publish_status !== undefined) updateData.publish_status = body.publish_status;
      if (body.metadata !== undefined) updateData.metadata = body.metadata;
      const displayOrder = body.display_order ?? body.displayOrder;
      if (displayOrder !== undefined) updateData.display_order = Number(displayOrder);
      if (v(body.tax_category_id, body.taxCategoryId) !== undefined) updateData.tax_category_id = v(body.tax_category_id, body.taxCategoryId) || null;
      if (v(body.hsn_code_id, body.hsnCodeId) !== undefined) updateData.hsn_code_id = v(body.hsn_code_id, body.hsnCodeId) || null;

      const specIds = Array.isArray(body.specialization_ids) ? body.specialization_ids : (Array.isArray(body.specializationIds) ? body.specializationIds : undefined);
      if (specIds !== undefined) {
        updateData.specialization_ids = specIds;
      } else if (updateData.category_id !== undefined) {
        // When Category is updated, dynamically infer specialization_ids so UI stays in sync
        const newCategoryId = updateData.category_id ?? service.category_id;
        const inferred = inferSpecializationIdsFromCategory(
          newCategoryId,
          updateData.service_name ?? service.service_name,
          updateData.display_name ?? service.display_name
        );
        if (inferred.length > 0) updateData.specialization_ids = inferred;
      }

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
   * POST /admin/service-catalog/ensure-roles-and-specializations
   * Ensures every service has: (1) applicable_roles from category if missing,
   * (2) valid service_style aligned with role config, (3) at least one specialization
   * inferred from category/service nature and validated against specialization_master.
   * CRUD-only: updates existing rows; does not change create/read/delete behavior.
   */
  app.post("/admin/service-catalog/ensure-roles-and-specializations", async (c) => {
    try {
      const all = await query('SELECT id, service_id, service_name, display_name, category_id, category_name, applicable_roles, service_style, specialization_ids FROM service_catalog');
      const rows = (all.rows || []) as any[];
      const updates: { id: string; applicable_roles: string[]; service_style: string; specialization_ids: string[] }[] = [];

      for (const row of rows) {
        let roles = Array.isArray(row.applicable_roles) ? row.applicable_roles.filter(Boolean) : [];
        const hadNoRoles = roles.length === 0;
        if (hadNoRoles) {
          roles = categoryToApplicableRoles(
            row.category_id,
            row.category_name,
            row.service_id,
            row.service_name
          );
        }
        if (roles.length === 0) continue;

        let style = row.service_style;
        const hadInvalidStyle = !style || !isAllowedServiceStyle(style);
        if (hadInvalidStyle) {
          style = defaultServiceStyleForRoles(roles);
        }
        style = normalizeServiceStyle(style);

        let specIds = Array.isArray(row.specialization_ids) ? row.specialization_ids.filter(Boolean) : [];
        const hadNoSpecs = specIds.length === 0;
        if (hadNoSpecs) {
          const inferred = inferSpecializationIdsFromCategory(
            row.category_id,
            row.service_name,
            row.display_name
          );
          const specCategory = CATEGORY_TO_SPEC_CATEGORY[(row.category_id || '').toLowerCase()] || (row.category_id || '').toLowerCase() || 'veterinary';
          const validSpecs = await query(
            `SELECT specialization_id FROM specialization_master WHERE is_active = true AND (category_id = $1 OR LOWER(category_id) = LOWER($1))`,
            [specCategory]
          );
          const validSet = new Set((validSpecs.rows || []).map((r: any) => (r.specialization_id || '').trim()).filter(Boolean));
          specIds = inferred.filter((id) => validSet.has((id || '').trim()));
          if (specIds.length === 0 && validSpecs.rows?.length) {
            specIds = (validSpecs.rows as any[]).slice(0, 2).map((r: any) => r.specialization_id).filter(Boolean);
          }
        }

        const needsUpdate = hadNoRoles || hadInvalidStyle || hadNoSpecs;
        if (!needsUpdate) continue;

        updates.push({
          id: row.id,
          applicable_roles: roles,
          service_style: style,
          specialization_ids: specIds,
        });
      }

      let updatedCount = 0;
      for (const u of updates) {
        await update('service_catalog', { id: u.id }, {
          applicable_roles: u.applicable_roles,
          service_style: u.service_style,
          specialization_ids: u.specialization_ids,
        });
        updatedCount += 1;
      }

      return c.json({
        success: true,
        message: 'Roles, service_style, and specializations ensured',
        total: rows.length,
        updated: updatedCount,
      });
    } catch (error: any) {
      console.error('Error ensuring roles and specializations:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /admin/service-catalog/:serviceId
   * Delete service from database completely
   */
  app.delete("/admin/service-catalog/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();

      // ✅ FIX: Handle UUID vs text comparison properly
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
      
      let existing;
      if (isUUID) {
        existing = await query(
          'SELECT * FROM service_catalog WHERE service_id = $1 OR id = $1::uuid',
          [serviceId]
        );
      } else {
        existing = await query(
          'SELECT * FROM service_catalog WHERE service_id = $1 OR id::text = $1',
          [serviceId]
        );
      }

      if (existing.rows.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      const service = existing.rows[0];

      // Hard delete: completely remove from database
      const deletedCount = await deleteRows('service_catalog', { id: service.id });

      if (deletedCount === 0) {
        return c.json({ error: 'Failed to delete service' }, 500);
      }

      return c.json({
        success: true,
        message: 'Service deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting service:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
