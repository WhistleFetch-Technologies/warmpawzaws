/**
 * ============================================================================
 * SERVICE DISCOVERY ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Customer-facing service discovery and search:
 * - Multi-category search (Vet, Grooming, Training, Walker, etc.)
 * - Location-based filtering
 * - Rating filter
 * - Availability check
 * - Vendor profiles with services
 * 
 * Migrated from: supabase/functions/make-server-3dd53475/universal-service-discovery.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query, insert } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function getCategoryFromRole(roleId: string): string {
  const roleCategoryMap: Record<string, string> = {
    'vet_clinic': 'vet',
    'veterinarian': 'vet',
    'grooming_salon': 'grooming',
    'pet_groomer': 'grooming',
    'groomer': 'grooming',
    'trainer': 'training',
    'pet_trainer': 'training',
    'dog_walker': 'walker',
    'pet_walker': 'walker',
    'boarding_resort': 'boarding',
    'pet_boarding': 'boarding',
    'nutritionist': 'nutrition',
    'pet_nutritionist': 'nutrition',
    'ngo': 'adoption',
    'shelter': 'adoption',
    'breeder': 'adoption',
    'pet_store': 'marketplace',
  };
  return roleCategoryMap[roleId] || 'other';
}

export function registerServiceDiscoveryEndpoints(app: Hono) {
  /**
   * GET /customer/services
   * Get customer services list (alias for discover-services)
   */
  app.get("/customer/services", async (c) => {
    try {
      const category = c.req.query('category');
      const location = c.req.query('location');
      const minRating = c.req.query('minRating');
      const availability = c.req.query('availability');
      const petType = c.req.query('petType');
      const sortBy = c.req.query('sortBy') || 'rating';
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');

      // Build vendor query
      // ✅ LIVE STATUS FILTER: Only show vendors eligible for customer listing
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
          AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM vendor_services vs 
            WHERE vs.vendor_id = v.id 
              AND vs.is_enabled = true 
              AND vs.publish_status = 'published'
          )
          AND EXISTS (
            SELECT 1 FROM vendor_availability_v2 va 
            WHERE va.vendor_id = v.id
          )
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by category (role)
      if (category) {
        const categoryRoleMap: Record<string, string[]> = {
          'vet': ['vet_clinic', 'veterinarian', 'vet_solo', 'vet', 'Veterinarian'],
          'grooming': ['grooming_salon', 'pet_groomer', 'groomer', 'grooming_solo'],
          'training': ['trainer', 'pet_trainer', 'training_solo'],
          'walker': ['dog_walker', 'pet_walker', 'walker', 'walker_solo'],
          'boarding': ['boarding_resort', 'pet_boarding'],
          'nutrition': ['nutritionist', 'pet_nutritionist', 'nutritionist_solo'],
          'adoption': ['ngo', 'shelter', 'breeder'],
          'marketplace': ['pet_store'],
          'behaviourist': ['behaviourist', 'pet_behaviourist', 'behaviourist_solo'],
          'sitting': ['pet_sitter', 'sitter', 'sitter_solo'],
          'diagnostics': ['diagnostics_provider', 'diagnostics_solo'],
        };

        const targetRoles = categoryRoleMap[category] || [];
        if (targetRoles.length > 0) {
          vendorQuery += ` AND (r.name = ANY($${paramIndex}::text[]) OR r.id::text = $${paramIndex + 1})`;
          params.push(targetRoles, category);
          paramIndex += 2;
        }
      }

      if (roleId) {
        vendorQuery += ` AND (r.id::text = $${paramIndex} OR r.name = $${paramIndex + 1})`;
        params.push(roleId, roleId);
        paramIndex += 2;
      }

      // Get vendors
      const vendors = await query(vendorQuery, params);

      // Get services for each vendor
      const services = await Promise.all(
        vendors.rows.map(async (vendor: any) => {
          // Check if is_global column exists
          const serviceColumns = await query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'services' AND column_name = 'is_global'`
          );
          const hasIsGlobal = serviceColumns.rows.length > 0;
          
          const vendorServices = await query(
            `SELECT s.*, vs.custom_price, vs.custom_duration, vs.service_style
             FROM services s
             LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
             WHERE (vs.vendor_id = $1${hasIsGlobal ? ' OR s.is_global = true' : ''})
             AND s.is_active = true
             ${serviceStyle ? `AND vs.service_style = $2` : ''}
             ORDER BY s.name`,
            serviceStyle ? [vendor.id, serviceStyle] : [vendor.id]
          );

          return vendorServices.rows.map((service: any) => ({
            id: service.id,
            serviceId: service.id,
            serviceName: service.name,
            vendorId: vendor.id,
            vendorName: vendor.business_name,
            price: service.custom_price || service.base_price || 0,
            duration: service.custom_duration || service.duration_minutes || 30,
            serviceStyle: service.service_style || serviceStyle,
          }));
        })
      );

      return c.json({
        success: true,
        services: services.flat(),
      });
    } catch (error: any) {
      console.error('Error fetching customer services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/services/platform
   * Get platform-level services from the service catalog
   * 
   * Used for instant booking where customers select from platform-defined services
   * rather than vendor-specific services.
   * 
   * Query params:
   * - roleId: Filter by role (e.g., 'veterinarian', 'groomer')
   * - serviceStyle: Filter by style ('tele', 'at_home', 'at_center', 'all')
   * - category: Optional category filter
   */
  app.get("/customer/services/platform", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');
      const category = c.req.query('category');

      if (!roleId) {
        return c.json({
          success: false,
          error: 'roleId is required',
        }, 400);
      }

      // ✅ Check if service_catalog table exists
      const tableCheck = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'service_catalog'
        )`
      ).catch(() => ({ rows: [{ exists: false }] }));

      if (!tableCheck.rows[0]?.exists) {
        // Return fallback services from vendor_services if service_catalog doesn't exist
        console.log('[Platform Services] service_catalog table not found, using vendor_services fallback');
        
        let fallbackQuery = `
          SELECT DISTINCT 
            vs.id,
            vs.service_id,
            vs.service_name,
            vs.service_name as display_name,
            vs.custom_description as description,
            vs.category as category_name,
            vs.service_style,
            vs.price as base_price,
            vs.duration_minutes
          FROM vendor_services vs
          INNER JOIN vendors v ON vs.vendor_id = v.id
          LEFT JOIN roles r ON v.role_id = r.id
          WHERE vs.is_enabled = true
            AND vs.publish_status = 'published'
            AND (r.name = $1 OR r.id::text = $1)
        `;
        
        const fallbackParams: any[] = [roleId];
        let paramIdx = 2;
        
        if (serviceStyle && serviceStyle !== 'all') {
          fallbackQuery += ` AND vs.service_style = $${paramIdx}`;
          fallbackParams.push(serviceStyle);
          paramIdx++;
        }
        
        fallbackQuery += ` LIMIT 50`;
        
        const fallbackResult = await query(fallbackQuery, fallbackParams).catch(() => ({ rows: [] }));
        
        const services = fallbackResult.rows.map((row: any) => ({
          id: row.service_id || row.id,
          serviceId: row.service_id,
          name: row.display_name || row.service_name,
          serviceName: row.service_name,
          displayName: row.display_name,
          description: row.description,
          categoryName: row.category_name,
          serviceStyle: row.service_style,
          basePrice: parseFloat(row.base_price) || 0,
          price: parseFloat(row.base_price) || 0,
          durationMinutes: row.duration_minutes || 30,
          duration: row.duration_minutes || 30,
        }));

        return c.json({
          success: true,
          count: services.length,
          services,
          filters: { roleId, serviceStyle, category },
          _fallback: true,
        });
      }

      // Build query for service_catalog
      let queryText = `
        SELECT 
          id,
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
          display_order
        FROM service_catalog
        WHERE status = 'active'
          AND publish_status = 'published'
          AND $1 = ANY(applicable_roles)
      `;
      const params: any[] = [roleId];
      let paramIndex = 2;

      // Filter by service style
      if (serviceStyle && serviceStyle !== 'all') {
        queryText += ` AND (service_style = $${paramIndex} OR service_style = 'all')`;
        params.push(serviceStyle);
        paramIndex++;
      }

      // Filter by category
      if (category) {
        queryText += ` AND (category_id = $${paramIndex} OR category_name ILIKE $${paramIndex + 1})`;
        params.push(category);
        params.push(`%${category}%`);
        paramIndex += 2;
      }

      queryText += ` ORDER BY display_order ASC, service_name ASC`;

      const result = await query(queryText, params).catch(() => ({ rows: [] }));

      // Format services for frontend consumption
      const services = result.rows.map((row: any) => ({
        id: row.service_id || row.id,
        serviceId: row.service_id,
        name: row.display_name || row.service_name,
        serviceName: row.service_name,
        displayName: row.display_name,
        description: row.description,
        categoryId: row.category_id,
        categoryName: row.category_name,
        subCategoryId: row.sub_category_id,
        subCategoryName: row.sub_category_name,
        serviceStyle: row.service_style,
        basePrice: parseFloat(row.base_price) || 0,
        price: parseFloat(row.base_price) || 0,
        durationMinutes: row.duration_minutes || 30,
        duration: row.duration_minutes || 30,
        metadata: row.metadata,
        displayOrder: row.display_order,
        applicableRoles: row.applicable_roles,
      }));

      console.log(`[Platform Services] Found ${services.length} services for role=${roleId}, style=${serviceStyle}`);

      return c.json({
        success: true,
        count: services.length,
        services,
        filters: {
          roleId,
          serviceStyle,
          category,
        },
      });
    } catch (error: any) {
      console.error('[Platform Services] Error:', error);
      // ✅ Return empty array instead of 500 error
      return c.json({
        success: true,
        count: 0,
        services: [],
        filters: {
          roleId: c.req.query('roleId'),
          serviceStyle: c.req.query('serviceStyle'),
          category: c.req.query('category'),
        },
        _error: error.message,
      });
    }
  });

  /**
   * OPTIONS /customer/discover-services
   * Handle CORS preflight requests
   * ✅ FIX: Explicit OPTIONS handler for CORS preflight
   */
  app.options("/customer/discover-services", async (c) => {
    return c.json({}, 200);
  });

  /**
   * GET /customer/discover-services
   * Main customer entry point for service discovery
   * 
   * ⚠️ CRITICAL BUSINESS RULE:
   * - For at_home/tele services: Returns staff members (if vendor has clinic) OR individual providers
   * - For at_center services: Returns vendors/business entities
   * ✅ FIX: Improved error handling
   */
  app.get("/customer/discover-services", async (c) => {
    try {
      const category = c.req.query('category');
      const location = c.req.query('location');
      const minRating = c.req.query('minRating');
      const availability = c.req.query('availability');
      const petType = c.req.query('petType');
      const sortBy = c.req.query('sortBy') || 'rating';
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const serviceStyle = c.req.query('serviceStyle'); // ⚠️ NEW: Filter by service style
      const roleId = c.req.query('roleId'); // ⚠️ NEW: Filter by role

      // ⚠️ CRITICAL: For at_home and tele services, return staff members and vendors with these services
      if (serviceStyle === 'at_home' || serviceStyle === 'tele') {
        const allProviders: any[] = [];
        
        // ========== 1. Get staff with staff_services ==========
        const staffQuery = `
          SELECT DISTINCT s.*, 
                 COALESCE(v.business_name, s.name) as vendor_name,
                 COALESCE(v.city, '') as city,
                 COALESCE(v.state, '') as state,
                 s.default_location as location,
                 v.id as vendor_id
          FROM staff s
          LEFT JOIN vendors v ON s.vendor_id = v.id
          WHERE s.is_active = true
            AND (s.vendor_id IS NULL OR (v.status = 'approved' AND v.is_active = true))
            AND (
              EXISTS (
                SELECT 1 FROM staff_services ss 
                WHERE ss.staff_id = s.id
                  AND ss.is_active = true
                  AND $1 = ANY(ss.service_styles)
              )
              OR
              EXISTS (
                SELECT 1 FROM vendor_services vs
                WHERE vs.vendor_id = s.vendor_id
                  AND vs.is_enabled = true
                  AND vs.publish_status = 'published'
                  AND vs.service_style = $1
              )
            )
        `;
        
        const staffParamsArray: any[] = [serviceStyle];
        let staffParamIndex = 2;
        
        let staffQueryFinal = staffQuery;
        if (roleId) {
          const role = await query('SELECT name, id FROM roles WHERE name = $1 OR id = $1', [roleId]);
          if (role.rows.length > 0) {
            staffQueryFinal += ` AND s.role = $${staffParamIndex}`;
            staffParamsArray.push(role.rows[0].name);
            staffParamIndex++;
          }
        }
        
        const staffResults = await query(staffQueryFinal, staffParamsArray).catch(() => ({ rows: [] }));
        
        // Format staff as providers
        for (const staff of staffResults.rows) {
          allProviders.push({
            id: staff.id,
            vendorId: staff.vendor_id || staff.id,
            businessName: staff.vendor_name,
            name: staff.name,
            role: staff.role,
            phone: staff.phone,
            email: staff.email,
            photo: staff.photo,
            isStaffMember: true,
            isIndividualProvider: !staff.vendor_id,
            vendor: staff.vendor_id ? {
              id: staff.vendor_id,
              businessName: staff.vendor_name,
            } : null,
            location: staff.location,
            city: staff.city,
            state: staff.state,
          });
        }
        
        // ========== 2. FALLBACK: Get vendors directly with at_home/tele services (no staff required) ==========
        const vendorIdsWithStaff = new Set(allProviders.map(p => p.vendorId).filter(Boolean));
        
        const categoryRoleMap: Record<string, string[]> = {
          'vet': ['veterinarian', 'vet_clinic', 'vet_solo', 'vet', 'Veterinarian'],
          'grooming': ['groomer', 'grooming_salon', 'pet_groomer', 'grooming_solo'],
          'training': ['trainer', 'pet_trainer', 'training_solo'],
          'walker': ['walker', 'pet_walker', 'dog_walker', 'walker_solo'],
          'nutritionist': ['nutritionist', 'pet_nutritionist', 'nutritionist_solo'],
          'behaviourist': ['behaviourist', 'pet_behaviourist', 'behaviourist_solo'],
          'sitting': ['pet_sitter', 'sitter', 'sitter_solo'],
          'diagnostics': ['diagnostics_provider', 'diagnostics_solo'],
        };
        
        let vendorQuery = `
          SELECT DISTINCT v.id, v.business_name, v.owner_name, v.phone, v.city, v.state,
                 v.latitude, v.longitude, r.name as role_name, r.display_name as role_display_name
          FROM vendors v
          LEFT JOIN roles r ON v.role_id = r.id
          INNER JOIN vendor_services vs ON vs.vendor_id = v.id
          WHERE v.status = 'approved' 
            AND v.is_active = true
            AND vs.service_style = $1
            AND vs.is_enabled = true
            AND vs.publish_status = 'published'
        `;
        
        const vendorParams: any[] = [serviceStyle];
        let vendorParamIdx = 2;
        
        if (roleId && categoryRoleMap[roleId]) {
          vendorQuery += ` AND r.name = ANY($${vendorParamIdx})`;
          vendorParams.push(categoryRoleMap[roleId]);
          vendorParamIdx++;
        } else if (category) {
          const targetRoles = categoryRoleMap[category.toLowerCase()];
          if (targetRoles) {
            vendorQuery += ` AND r.name = ANY($${vendorParamIdx})`;
            vendorParams.push(targetRoles);
            vendorParamIdx++;
          }
        }
        
        vendorQuery += ` LIMIT 50`;
        
        const vendorResults = await query(vendorQuery, vendorParams).catch(() => ({ rows: [] }));
        
        for (const vendor of vendorResults.rows) {
          // Skip vendors that already have staff
          if (vendorIdsWithStaff.has(vendor.id)) continue;
          
          allProviders.push({
            id: vendor.id,
            vendorId: vendor.id,
            businessName: vendor.business_name || vendor.owner_name,
            name: vendor.business_name || vendor.owner_name,
            role: vendor.role_display_name || vendor.role_name,
            phone: vendor.phone,
            isStaffMember: false,
            isIndividualProvider: false,
            vendor: {
              id: vendor.id,
              businessName: vendor.business_name || vendor.owner_name,
            },
            city: vendor.city,
            state: vendor.state,
          });
        }
        
        console.log(`[Discover Services] Found ${allProviders.length} providers for style=${serviceStyle}`);
        
        return c.json({
          success: true,
          vendors: allProviders,
          staff: allProviders.filter(p => p.isStaffMember),
          total: allProviders.length,
        });
      }

      // Build vendor query (for at_center services or no serviceStyle specified)
      // ✅ LIVE STATUS FILTER: Only show vendors eligible for customer listing
      // ⚠️ RELAXED: Removed strict requirements for lat/lng, published services, and availability
      //    to allow vendors in onboarding phase to be discoverable
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name,
          COALESCE((SELECT COUNT(*) FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true), 0) as service_count,
          COALESCE((SELECT COUNT(*) FROM vendor_availability_v2 va WHERE va.vendor_id = v.id), 0) as availability_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // ✅ FIX: When serviceStyle=at_center, exclude solo vendors and only include vendors with at_center services
      if (serviceStyle === 'at_center') {
        // Exclude solo vendors (individual providers, not clinics/centers)
        vendorQuery += ` AND r.name NOT LIKE '%_solo'`;
        
        // Only include vendors that have at_center services
        vendorQuery += ` AND EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id = v.id
            AND vs.service_style = $${paramIndex}
            AND vs.is_enabled = true
            AND vs.publish_status = 'published'
        )`;
        params.push('at_center');
        paramIndex++;
      }

      // Filter by category (role)
      if (category) {
        const categoryRoleMap: Record<string, string[]> = {
          'vet': serviceStyle === 'at_center' 
            ? ['vet_clinic', 'veterinarian', 'vet', 'Veterinarian'] // Exclude vet_solo for at_center
            : ['vet_clinic', 'veterinarian', 'vet_solo', 'vet', 'Veterinarian'],
          'grooming': serviceStyle === 'at_center'
            ? ['grooming_salon', 'pet_groomer', 'groomer'] // Exclude grooming_solo for at_center
            : ['grooming_salon', 'pet_groomer', 'groomer', 'grooming_solo'],
          'training': serviceStyle === 'at_center'
            ? ['trainer', 'pet_trainer'] // Exclude training_solo for at_center
            : ['trainer', 'pet_trainer', 'training_solo'],
          'walker': serviceStyle === 'at_center'
            ? ['dog_walker', 'pet_walker', 'walker'] // Exclude walker_solo for at_center
            : ['dog_walker', 'pet_walker', 'walker', 'walker_solo'],
          'boarding': ['boarding_resort', 'pet_boarding'],
          'nutrition': serviceStyle === 'at_center'
            ? ['nutritionist', 'pet_nutritionist'] // Exclude nutritionist_solo for at_center
            : ['nutritionist', 'pet_nutritionist', 'nutritionist_solo'],
          'adoption': ['ngo', 'shelter', 'breeder'],
          'marketplace': ['pet_store'],
          'behaviourist': serviceStyle === 'at_center'
            ? ['behaviourist', 'pet_behaviourist'] // Exclude behaviourist_solo for at_center
            : ['behaviourist', 'pet_behaviourist', 'behaviourist_solo'],
          'sitting': serviceStyle === 'at_center'
            ? ['pet_sitter', 'sitter'] // Exclude sitter_solo for at_center
            : ['pet_sitter', 'sitter', 'sitter_solo'],
          'diagnostics': serviceStyle === 'at_center'
            ? ['diagnostics_provider'] // Exclude diagnostics_solo for at_center
            : ['diagnostics_provider', 'diagnostics_solo'],
        };

        const targetRoles = categoryRoleMap[category] || [];
        if (targetRoles.length > 0) {
          vendorQuery += ` AND r.name = ANY($${paramIndex})`;
          params.push(targetRoles);
          paramIndex++;
        }
      }

      // Filter by location (text match)
      if (location) {
        vendorQuery += ` AND (
          v.city ILIKE $${paramIndex} OR 
          v.state ILIKE $${paramIndex} OR 
          v.address ILIKE $${paramIndex}
        )`;
        params.push(`%${location}%`);
        paramIndex++;
      }

      vendorQuery += ` ORDER BY v.created_at DESC`;

      const vendorResults = await query(vendorQuery, params);
      let vendors = vendorResults.rows;

      // Enrich vendors with services, reviews, and availability
      const enrichedVendors = await Promise.all(
        vendors.map(async (vendor: any) => {
          // Get services - ✅ FIX: Filter by serviceStyle if provided
          let servicesQuery = `
            SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled, vs.service_style
             FROM services s
             LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
             WHERE vs.vendor_id = $1
             AND s.is_active = true
             AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
          `;
          const servicesParams: any[] = [vendor.id];
          
          // ✅ FIX: When serviceStyle=at_center, only show at_center services
          if (serviceStyle === 'at_center') {
            servicesQuery += ` AND vs.service_style = $2 AND vs.publish_status = 'published'`;
            servicesParams.push('at_center');
          }
          
          servicesQuery += ` LIMIT 10`;
          
          const services = await query(servicesQuery, servicesParams);

          // Get reviews and calculate rating
          const reviews = await query(
            `SELECT rating FROM reviews 
             WHERE vendor_id = $1 
             AND is_approved = true`,
            [vendor.id]
          );

          const avgRating = reviews.rows.length > 0
            ? reviews.rows.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.rows.length
            : 0;

          // Check availability (simplified - check if vendor has slots today)
          // Gracefully handle missing vendor_schedule_slots table
          let isAvailableToday = false;
          try {
            const tableCheck = await query(
              `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'vendor_schedule_slots'
              )`
            );
            
            if (tableCheck.rows[0]?.exists) {
              const today = new Date();
              const dayOfWeek = today.getDay();
              const availabilityCheck = await query(
                `SELECT 1 FROM vendor_schedule_slots 
                 WHERE vendor_id = $1 
                 AND day_of_week = $2 
                 AND is_enabled = true 
                 LIMIT 1`,
                [vendor.id, dayOfWeek]
              );
              isAvailableToday = availabilityCheck.rows.length > 0;
            }
          } catch (error: any) {
            // Table doesn't exist or query failed, assume available
            console.warn('[Discover Services] vendor_schedule_slots check failed:', error.message);
            isAvailableToday = true; // Default to available
          }

          // Calculate distance if coordinates provided
          let distance: number | null = null;
          if (latitude && longitude && vendor.latitude && vendor.longitude) {
            distance = calculateDistance(
              parseFloat(latitude),
              parseFloat(longitude),
              parseFloat(vendor.latitude),
              parseFloat(vendor.longitude)
            );
          }

          // ✅ FIX: Fetch vendor promotions for service listings
          let activePromotions: any[] = [];
          try {
            const promotionsResult = await query(
              `SELECT id, name, description, discount_type, discount_value, code, 
                      start_date, end_date, min_order_value, max_discount_amount
               FROM vendor_promotions 
               WHERE vendor_id = $1::uuid 
                 AND is_active = true 
                 AND (start_date IS NULL OR start_date <= NOW())
                 AND (end_date IS NULL OR end_date >= NOW())
               ORDER BY discount_value DESC
               LIMIT 3`,
              [vendor.id]
            );
            activePromotions = promotionsResult.rows.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              discountType: p.discount_type,
              discountValue: parseFloat(p.discount_value),
              code: p.code,
              minOrderValue: p.min_order_value ? parseFloat(p.min_order_value) : null,
              maxDiscountAmount: p.max_discount_amount ? parseFloat(p.max_discount_amount) : null,
            }));
          } catch (promoError) {
            // Promotions table might not exist, continue without promotions
            console.debug('Could not fetch vendor promotions:', promoError);
          }

          return {
            id: vendor.id,
            vendorId: vendor.id,
            businessName: vendor.business_name,
            roleId: vendor.role_id,
            roleName: vendor.role_name,
            category: getCategoryFromRole(vendor.role_name),
            address: vendor.address,
            city: vendor.city,
            state: vendor.state,
            location: vendor.latitude && vendor.longitude ? {
              coordinates: { lat: parseFloat(vendor.latitude), lng: parseFloat(vendor.longitude) },
              address: vendor.address,
            } : null,
            rating: avgRating,
            totalReviews: reviews.rows.length,
            totalOfferings: services.rows.length,
            featuredOfferings: services.rows.slice(0, 3).map((s: any) => ({
              id: s.id,
              name: s.name,
              price: s.custom_price || s.base_price || 0,
              duration: s.custom_duration || s.duration_minutes || 0,
              serviceStyle: s.service_style || (serviceStyle || 'at_home'), // Use vs.service_style or fallback
              category: s.category,
            })),
            availabilityScore: isAvailableToday ? 100 : 0,
            isAvailableToday,
            distance,
            phone: vendor.phone,
            email: vendor.email,
            operatingHours: vendor.operating_hours ? JSON.parse(vendor.operating_hours) : null,
            // ✅ NEW: Include active vendor promotions for display badges
            hasActivePromotions: activePromotions.length > 0,
            promotions: activePromotions,
            topPromotion: activePromotions[0] || null,
          };
        })
      );

      // ✅ FIX: When serviceStyle=at_center, filter out vendors with no at_center services
      let filteredVendors = enrichedVendors;
      if (serviceStyle === 'at_center') {
        filteredVendors = enrichedVendors.filter((v: any) => {
          // Only include vendors that have at least one at_center service
          return v.featuredOfferings && v.featuredOfferings.length > 0 && 
                 v.featuredOfferings.some((offering: any) => offering.serviceStyle === 'at_center');
        });
      }

      // Filter by rating
      if (minRating) {
        filteredVendors = filteredVendors.filter((v: any) => v.rating >= parseFloat(minRating));
      }

      // Sort
      if (sortBy === 'distance' && latitude && longitude) {
        filteredVendors.sort((a: any, b: any) => {
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
      } else if (sortBy === 'rating') {
        filteredVendors.sort((a: any, b: any) => b.rating - a.rating);
      } else if (sortBy === 'price') {
        filteredVendors.sort((a: any, b: any) => {
          const aPrice = a.featuredOfferings[0]?.price || 0;
          const bPrice = b.featuredOfferings[0]?.price || 0;
          return aPrice - bPrice;
        });
      }

      return c.json({
        success: true,
        vendors: filteredVendors,
        total: filteredVendors.length,
        filters: {
          category,
          location,
          minRating,
          availability,
          petType,
          sortBy,
          serviceStyle,
        },
      });
    } catch (error: any) {
      console.error('[discover-services] Error discovering services:', error);
      return c.json({ success: true, vendors: [], total: 0 }, 200);
    }
  });

  /**
   * GET /customer/vendor/:vendorId/available-slots
   * Get available time slots for a vendor based on their operating hours
   * ✅ FIX: Must be registered BEFORE /customer/vendor/:vendorId to avoid route conflict
   * ✅ FIX B6: Returns slots based on vendor timings instead of static slots
   * ✅ FIX GAP 3.3: For at_home/tele services, includes staff-specific availability
   */
  app.get("/customer/vendor/:vendorId/available-slots", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const date = c.req.query('date');
      const serviceStyle = c.req.query('serviceStyle') || 'at_home';
      const staffId = c.req.query('staffId'); // Optional: specific staff filter
      const serviceId = c.req.query('serviceId'); // Optional: specific service filter

      if (!date) {
        return c.json({ error: 'date parameter is required' }, 400);
      }

      // Get vendor with operating hours
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      
      // ✅ FIX GAP 3.3: For at_home and tele services, check staff availability instead
      if (serviceStyle === 'at_home' || serviceStyle === 'tele') {
        // Get staff-specific availability for this service style
        let staffQuery = `
          SELECT DISTINCT 
            sas.id as slot_id,
            sas.staff_id,
            s.name as staff_name,
            s.photo_url as staff_photo,
            sas.start_time,
            sas.end_time,
            sas.is_available,
            sss.lead_time_minutes,
            sss.buffer_time_minutes
          FROM staff_availability_slots sas
          INNER JOIN staff s ON sas.staff_id = s.id
          LEFT JOIN staff_slot_services sss ON sas.id = sss.slot_id
          LEFT JOIN services srv ON sss.service_id = srv.id
          WHERE s.vendor_id = $1
          AND sas.date = $2
          AND sas.is_available = true
          AND s.is_active = true
          AND s.mobile_verified = true
        `;
        const params: any[] = [vendorId, date];
        let paramIndex = 3;

        if (staffId) {
          staffQuery += ` AND s.id = $${paramIndex}`;
          params.push(staffId);
          paramIndex++;
        }

        if (serviceId) {
          staffQuery += ` AND sss.service_id = $${paramIndex}`;
          params.push(serviceId);
          paramIndex++;
        }

        // Filter by service style
        staffQuery += ` AND (srv.service_style = $${paramIndex} OR srv.service_style IS NULL)`;
        params.push(serviceStyle);
        paramIndex++;

        staffQuery += ` ORDER BY sas.start_time, s.name`;

        const staffSlotsResult = await query(staffQuery, params).catch((err) => {
          console.warn('[SLOTS] Staff availability query failed, falling back to vendor hours:', err.message);
          return { rows: [] };
        });

        if (staffSlotsResult.rows.length > 0) {
          // Get existing bookings to mark booked slots
          const existingBookingsResult = await query(
            `SELECT booking_time, staff_id FROM bookings 
             WHERE vendor_id = $1 
             AND booking_date = $2 
             AND status NOT IN ('cancelled', 'rejected')`,
            [vendorId, date]
          ).catch(() => ({ rows: [] }));

          // Group bookings by staff
          const bookedByStaff: Record<string, Set<string>> = {};
          for (const booking of existingBookingsResult.rows) {
            const sid = booking.staff_id || 'general';
            if (!bookedByStaff[sid]) {
              bookedByStaff[sid] = new Set();
            }
            const time = typeof booking.booking_time === 'string' 
              ? booking.booking_time.substring(0, 5) 
              : booking.booking_time;
            bookedByStaff[sid].add(time);
          }

          // Generate 30-minute slots for each staff availability window
          const slots: any[] = [];
          const now = new Date();
          const requestedDate = new Date(date);

          // ✅ FIX: Only check if slot is in the past if the date is TODAY
          // For future dates, all slots should be available (unless booked)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const requestedDateOnly = new Date(requestedDate);
          requestedDateOnly.setHours(0, 0, 0, 0);
          const isToday = requestedDateOnly.getTime() === today.getTime();

          for (const staffSlot of staffSlotsResult.rows) {
            const [startHour, startMin] = staffSlot.start_time.split(':').map(Number);
            const [endHour, endMin] = staffSlot.end_time.split(':').map(Number);
            const staffBookedTimes = bookedByStaff[staffSlot.staff_id] || new Set();

            let currentHour = startHour;
            let currentMin = startMin;

            while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
              const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
              
              // ✅ FIX: Only check if slot is in the past if it's TODAY
              // For future dates, don't mark slots as unavailable due to time
              let isPast = false;
              if (isToday) {
                const slotDateTime = new Date(requestedDate);
                slotDateTime.setHours(currentHour, currentMin, 0, 0);
                isPast = slotDateTime < now;
              }
              // For future dates, isPast remains false

              // Check if booked for this staff
              const isBooked = staffBookedTimes.has(timeStr);

              slots.push({
                time: timeStr,
                available: !isPast && !isBooked,
                booked: isBooked,
                staffId: staffSlot.staff_id,
                staffName: staffSlot.staff_name,
                staffPhoto: staffSlot.staff_photo,
                leadTimeMinutes: staffSlot.lead_time_minutes || 0,
                bufferTimeMinutes: staffSlot.buffer_time_minutes || 15,
              });

              currentMin += 30;
              if (currentMin >= 60) {
                currentMin -= 60;
                currentHour += 1;
              }
            }
          }

          // Remove duplicate times and sort
          const uniqueSlots = slots.reduce((acc: any[], slot) => {
            const existing = acc.find(s => s.time === slot.time && s.staffId === slot.staffId);
            if (!existing) {
              acc.push(slot);
            }
            return acc;
          }, []);

          return c.json({
            success: true,
            slots: uniqueSlots.sort((a, b) => a.time.localeCompare(b.time)),
            date,
            vendorId,
            serviceStyle,
            staffBased: true, // ✅ Flag indicating slots are staff-specific
          });
        }
        // If no staff availability found, fall through to vendor hours
      }

      // ✅ Original logic for at_center or fallback
      // Try to get operating hours from multiple sources
      let operatingHours: any = null;
      
      // 1. Try vendor.operating_hours column (if exists)
      if (vendor.operating_hours) {
        try {
          operatingHours = typeof vendor.operating_hours === 'string' 
            ? JSON.parse(vendor.operating_hours) 
            : vendor.operating_hours;
        } catch (e) {
          console.warn('[SLOTS] Failed to parse vendor.operating_hours:', e);
        }
      }

      // 2. Try metadata.operatingHours (fallback)
      if (!operatingHours && vendor.metadata) {
        try {
          const metadata = typeof vendor.metadata === 'string' 
            ? JSON.parse(vendor.metadata) 
            : vendor.metadata;
          operatingHours = metadata?.operatingHours || metadata?.operating_hours;
        } catch (e) {
          console.warn('[SLOTS] Failed to parse metadata:', e);
        }
      }
      
      // 3. Try vendor_facilities table (primary source for center profile)
      if (!operatingHours) {
        try {
          const facilities = await query(
            `SELECT operating_hours FROM vendor_facilities WHERE vendor_id = $1 LIMIT 1`,
            [vendorId]
          );
          if (facilities.rows.length > 0 && facilities.rows[0].operating_hours) {
            const facilityHours = facilities.rows[0].operating_hours;
            operatingHours = typeof facilityHours === 'string' 
              ? JSON.parse(facilityHours) 
              : facilityHours;
            console.log('[SLOTS] Loaded operating hours from vendor_facilities');
          }
        } catch (e) {
          console.warn('[SLOTS] Failed to load from vendor_facilities:', e);
        }
      }

      // Get day of week (0 = Sunday, 6 = Saturday)
      const requestedDate = new Date(date);
      const dayOfWeek = requestedDate.getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];

      // ✅ FIX: Only check if slot is in the past if the date is TODAY
      // For future dates, all slots should be available (unless booked)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const requestedDateOnly = new Date(requestedDate);
      requestedDateOnly.setHours(0, 0, 0, 0);
      const isToday = requestedDateOnly.getTime() === today.getTime();

      // Get existing bookings for this date to mark booked slots as unavailable
      const existingBookingsResult = await query(
        `SELECT booking_time FROM bookings 
         WHERE vendor_id = $1 
         AND booking_date = $2 
         AND status NOT IN ('cancelled', 'rejected')`,
        [vendorId, date]
      ).catch(() => ({ rows: [] }));
      
      const bookedTimes = new Set(
        existingBookingsResult.rows.map((b: any) => {
          // Handle different time formats (HH:MM:SS or HH:MM)
          const time = b.booking_time;
          if (typeof time === 'string') {
            return time.substring(0, 5); // Get HH:MM
          }
          return time;
        })
      );
      
      console.log(`[SLOTS] Found ${bookedTimes.size} booked slots for ${date}:`, Array.from(bookedTimes));

      // Generate slots based on operating hours
      const slots: any[] = [];
      
      if (operatingHours && operatingHours[dayName]) {
        const daySchedule = operatingHours[dayName];
        
        if (daySchedule.isOpen && daySchedule.open && daySchedule.close) {
          // Generate 30-minute slots between open and close
          const [openHour, openMin] = daySchedule.open.split(':').map(Number);
          const [closeHour, closeMin] = daySchedule.close.split(':').map(Number);
          
          let currentHour = openHour;
          let currentMin = openMin;
          
          while (currentHour < closeHour || (currentHour === closeHour && currentMin < closeMin)) {
            const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
            
            // ✅ FIX: Only check if slot is in the past if it's TODAY
            // For future dates, don't mark slots as unavailable due to time
            let isPast = false;
            if (isToday) {
              const now = new Date();
              const slotDateTime = new Date(requestedDate);
              slotDateTime.setHours(currentHour, currentMin, 0, 0);
              isPast = slotDateTime < now;
            }
            // For future dates, isPast remains false
            
            // Check if slot is already booked
            const isBooked = bookedTimes.has(timeStr);
            
            slots.push({
              time: timeStr,
              available: !isPast && !isBooked,
              booked: isBooked,
            });
            
            // Increment by 30 minutes
            currentMin += 30;
            if (currentMin >= 60) {
              currentMin -= 60;
              currentHour += 1;
            }
          }
        }
      } else {
        // Fallback: If no operating hours, return default slots (9 AM - 6 PM)
        const defaultSlots = [
          '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
          '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
        ];
        slots.push(...defaultSlots.map(time => {
          const isBooked = bookedTimes.has(time);
          return {
            time,
            available: !isBooked,
            booked: isBooked,
          };
        }));
      }

      return c.json({
        success: true,
        slots,
        date,
        vendorId,
        serviceStyle,
        staffBased: false,
      });
    } catch (error: any) {
      console.error('Error fetching available slots:', error);
      return c.json({ error: error.message || 'Failed to fetch available slots' }, 500);
    }
  });

  /**
   * GET /customer/vendor/:vendorId/services
   * Get vendor services filtered by category - used by booking routers
   * ✅ FIX: Added to support booking router service loading
   */
  app.get("/customer/vendor/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const category = c.req.query('category');
      const serviceStyle = c.req.query('serviceStyle');

      // Get vendor to verify it exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found', success: false }, 404);
      }

      // Build query for services
      let servicesQuery = `
        SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled, vs.service_style,
               sc.name as category_name, sc.slug as category_slug
        FROM services s
        LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
        LEFT JOIN service_categories sc ON s.category_id = sc.id
        WHERE (vs.vendor_id = $1 OR s.vendor_id = $1)
        AND s.is_active = true
        AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
      `;
      const queryParams: any[] = [vendorId];

      // Filter by category if provided
      if (category) {
        queryParams.push(category);
        servicesQuery += ` AND (sc.slug = $${queryParams.length} OR LOWER(sc.name) LIKE '%' || LOWER($${queryParams.length}) || '%')`;
      }

      // Filter by service style if provided
      if (serviceStyle) {
        queryParams.push(serviceStyle);
        servicesQuery += ` AND (vs.service_style = $${queryParams.length} OR s.service_style = $${queryParams.length})`;
      }

      servicesQuery += ` ORDER BY s.name`;

      const services = await query(servicesQuery, queryParams);

      // Format response
      const formattedServices = services.rows.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        base_price: s.base_price,
        price: s.custom_price || s.base_price,
        duration: s.custom_duration || s.duration || 30,
        category: s.category_name || category,
        categorySlug: s.category_slug,
        serviceStyle: s.service_style || 'at_home',
        isEnabled: s.is_enabled !== false,
        requiresPetProfile: s.requires_pet_profile !== false,
        requiresAddress: s.requires_address !== false,
      }));

      return c.json({
        success: true,
        services: formattedServices,
        count: formattedServices.length
      });

    } catch (error: any) {
      console.error('Error fetching vendor services:', error);
      return c.json({ 
        success: false, 
        error: error.message || 'Failed to fetch services',
        services: []
      }, 500);
    }
  });

  /**
   * GET /customer/vendor/:vendorId
   * Get detailed vendor profile with all services
   * ✅ FIX: Must be registered AFTER /customer/vendor/:vendorId/available-slots to avoid route conflict
   */
  app.get("/customer/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Get vendor
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Get role
      const roles = await select('roles', { id: vendor.role_id });
      const role = roles[0];

      // Get all services
      // Check if is_global column exists
      const serviceColumns = await query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'services' AND column_name = 'is_global'`
      );
      const hasIsGlobal = serviceColumns.rows.length > 0;
      
      const services = await query(
        `SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled, vs.service_style
         FROM services s
         LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
         WHERE (vs.vendor_id = $1${hasIsGlobal ? ' OR s.is_global = true' : ''})
         AND s.is_active = true
         AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
         ORDER BY s.name`,
        [vendorId]
      );

      // Get reviews
      const reviews = await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1 
         AND r.is_approved = true
         ORDER BY r.created_at DESC
         LIMIT 20`,
        [vendorId]
      );

      const avgRating = reviews.rows.length > 0
        ? reviews.rows.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.rows.length
        : 0;

      // Get staff (if applicable)
      const staff = await query(
        `SELECT s.* FROM staff s
         WHERE s.vendor_id = $1 
         AND s.is_active = true
         ORDER BY s.name`,
        [vendorId]
      );

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          roleId: vendor.role_id,
          roleName: role?.name,
          category: getCategoryFromRole(role?.name || ''),
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          phone: vendor.phone,
          email: vendor.email,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          rating: avgRating,
          totalReviews: reviews.rows.length,
          operatingHours: vendor.operating_hours ? JSON.parse(vendor.operating_hours) : null,
          description: vendor.description || '',
        },
        services: services.rows,
        reviews: reviews.rows,
        staff: staff.rows,
      });
    } catch (error: any) {
      console.error('Error fetching vendor profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/vendors/search
   * Search vendors by roleId and other filters
   * This is a compatibility endpoint for components that use /customer/vendors/search
   */
  app.get("/customer/vendors/search", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const searchQuery = c.req.query('query'); // Renamed to avoid shadowing the query function
      const location = c.req.query('location');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const serviceStyle = c.req.query('serviceStyle');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // Build vendor query
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by roleId (primary filter)
      if (roleId) {
        vendorQuery += ` AND (r.id::text = $${paramIndex} OR r.name = $${paramIndex + 1})`;
        params.push(roleId, roleId);
        paramIndex += 2;
      }

      // Filter by search query (name, business_name, specialization)
      if (searchQuery) {
        vendorQuery += ` AND (
          v.business_name ILIKE $${paramIndex} OR 
          v.owner_name ILIKE $${paramIndex} OR
          v.specialization ILIKE $${paramIndex}
        )`;
        params.push(`%${searchQuery}%`);
        paramIndex++;
      }

      // Filter by location
      if (location) {
        vendorQuery += ` AND (
          v.city ILIKE $${paramIndex} OR 
          v.state ILIKE $${paramIndex} OR 
          v.address ILIKE $${paramIndex}
        )`;
        params.push(`%${location}%`);
        paramIndex++;
      }

      vendorQuery += ` ORDER BY v.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      paramIndex += 2;

      const vendorResults = await query(vendorQuery, params);
      let vendors = vendorResults.rows;

      // Enrich vendors with additional data
      const enrichedVendors = await Promise.all(
        vendors.map(async (vendor: any) => {
          // Get average rating
          const reviews = await query(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
             FROM reviews 
             WHERE vendor_id = $1 AND is_approved = true`,
            [vendor.id]
          );

          const avgRating = reviews.rows[0]?.avg_rating || 0;
          const reviewCount = reviews.rows[0]?.review_count || 0;

          // Calculate distance if coordinates provided
          let distance = null;
          if (latitude && longitude && vendor.latitude && vendor.longitude) {
            distance = calculateDistance(
              parseFloat(latitude),
              parseFloat(longitude),
              parseFloat(vendor.latitude),
              parseFloat(vendor.longitude)
            );
          }

          // Get services count
          const servicesCount = await query(
            `SELECT COUNT(*) as count
             FROM vendor_services vs
             INNER JOIN services s ON vs.service_id = s.id
             WHERE vs.vendor_id = $1 AND s.is_active = true AND vs.is_enabled = true`,
            [vendor.id]
          );

          return {
            ...vendor,
            id: vendor.id,
            vendorId: vendor.id,
            businessName: vendor.business_name,
            name: vendor.business_name || vendor.owner_name,
            rating: parseFloat(avgRating) || 0,
            reviewCount: parseInt(reviewCount) || 0,
            distance: distance ? parseFloat(distance.toFixed(2)) : null,
            servicesCount: parseInt(servicesCount.rows[0]?.count || '0'),
            priceRange: vendor.price_range || null,
            address: vendor.address,
            city: vendor.city,
            state: vendor.state,
          };
        })
      );

      // If serviceStyle is 'at_home' or 'tele', also return staff
      let staff: any[] = [];
      if (serviceStyle && ['at_home', 'tele'].includes(serviceStyle) && roleId) {
        const staffQuery = `
          SELECT s.*, v.business_name as vendor_name, v.city, v.state
          FROM staff s
          INNER JOIN vendors v ON s.vendor_id = v.id
          INNER JOIN roles r ON v.role_id = r.id
          WHERE s.is_active = true
            AND v.status = 'approved'
            AND v.is_active = true
            AND (r.id::text = $1 OR r.name = $2)
          LIMIT $3
        `;
        const staffResults = await query(staffQuery, [roleId, roleId, limit]);
        staff = staffResults.rows.map((s: any) => ({
          ...s,
          id: s.id,
          vendorId: s.vendor_id,
          name: s.name,
          rating: s.rating || 0,
        }));
      }

      return c.json({
        success: true,
        vendors: enrichedVendors,
        staff: staff.length > 0 ? staff : undefined,
        total: enrichedVendors.length,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error in /customer/vendors/search:', error);
      return c.json({ 
        success: false,
        error: error.message || 'Failed to search vendors',
        vendors: [],
        total: 0
      }, 500);
    }
  });

  /**
   * GET /customer/autocomplete
   * Search autocomplete suggestions
   */
  app.get("/customer/autocomplete", async (c) => {
    try {
      const q = c.req.query('q') || '';
      const limit = parseInt(c.req.query('limit') || '10', 10);

      if (!q || q.length < 2) {
        return c.json({ success: true, suggestions: [] });
      }

      // Search vendors
      const vendors = await query(
        `SELECT DISTINCT business_name as name, 'vendor' as type, id
         FROM vendors
         WHERE business_name ILIKE $1 AND status = 'approved' AND is_active = true
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      // Search services
      const services = await query(
        `SELECT DISTINCT name, 'service' as type, id
         FROM services
         WHERE name ILIKE $1 AND is_active = true
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      // Search problems
      const problems = await query(
        `SELECT DISTINCT problem_name as name, 'problem' as type, id
         FROM problem_grid
         WHERE problem_name ILIKE $1
         LIMIT $2`,
        [`%${q}%`, limit]
      );

      const suggestions = [
        ...vendors.rows.map((v: any) => ({ text: v.name, type: v.type, id: v.id })),
        ...services.rows.map((s: any) => ({ text: s.name, type: s.type, id: s.id })),
        ...problems.rows.map((p: any) => ({ text: p.name, type: p.type, id: p.id })),
      ].slice(0, limit);

      return c.json({ success: true, suggestions });
    } catch (error: any) {
      console.error('Error in autocomplete:', error);
      return c.json({ success: true, suggestions: [] });
    }
  });

  /**
   * GET /customer/radar/providers
   * Get providers within radar radius
   */
  app.get("/customer/radar/providers", async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = parseFloat(c.req.query('radius') || '10'); // km
      const serviceType = c.req.query('serviceType') || '';

      if (!lat || !lng) {
        return c.json({ error: 'lat and lng are required' }, 400);
      }

      // Get vendors with location within radius
      const vendors = await query(
        `SELECT v.*, r.name as role_name,
         (6371 * acos(
           cos(radians($1)) * cos(radians(CAST(v.latitude AS FLOAT))) *
           cos(radians(CAST(v.longitude AS FLOAT)) - radians($2)) +
           sin(radians($1)) * sin(radians(CAST(v.latitude AS FLOAT)))
         )) AS distance_km
         FROM vendors v
         INNER JOIN roles r ON v.role_id = r.id
         WHERE v.status = 'approved' AND v.is_active = true
           AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
           ${serviceType ? `AND r.name ILIKE $3` : ''}
         HAVING distance_km <= $4
         ORDER BY distance_km ASC
         LIMIT 50`,
        serviceType ? [lat, lng, `%${serviceType}%`, radius] : [lat, lng, radius]
      );

      return c.json({
        success: true,
        providers: vendors.rows.map((v: any) => ({
          id: v.id,
          name: v.business_name,
          role: v.role_name,
          distance: parseFloat(v.distance_km?.toFixed(2) || '0'),
          latitude: v.latitude,
          longitude: v.longitude,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching radar providers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/vendors/discover-by-problem
   * Enhanced vendor discovery by problem
   */
  app.get("/customer/vendors/discover-by-problem", async (c) => {
    try {
      const problem = c.req.query('problem');
      const roleId = c.req.query('roleId');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');

      if (!problem) {
        return c.json({ error: 'problem is required' }, 400);
      }

      // Get vendors that handle this problem
      let queryText = `
        SELECT DISTINCT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIdx = 1;

      // Filter by problem (check specializations, services, or problem_grid)
      queryText += ` AND (
        v.specializations::text ILIKE $${paramIdx} OR
        EXISTS (
          SELECT 1 FROM services s
          WHERE s.vendor_id = v.id
          AND (s.name ILIKE $${paramIdx} OR s.description ILIKE $${paramIdx})
        )
      )`;
      params.push(`%${problem}%`);
      paramIdx++;

      if (roleId) {
        queryText += ` AND (r.id::text = $${paramIdx} OR r.name = $${paramIdx})`;
        params.push(roleId, roleId);
        paramIdx += 2;
      }

      // Add distance calculation if location provided
      if (latitude && longitude) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        queryText = `
          SELECT *, 
          (6371 * acos(
            cos(radians($${paramIdx})) * cos(radians(CAST(latitude AS FLOAT))) *
            cos(radians(CAST(longitude AS FLOAT)) - radians($${paramIdx + 1})) +
            sin(radians($${paramIdx})) * sin(radians(CAST(latitude AS FLOAT)))
          )) AS distance_km
          FROM (${queryText}) subquery
          WHERE latitude IS NOT NULL AND longitude IS NOT NULL
          ORDER BY distance_km ASC
        `;
        params.push(lat, lng);
        paramIdx += 2;
      } else {
        queryText += ` ORDER BY v.created_at DESC`;
      }

      queryText += ` LIMIT 20`;

      const result = await query(queryText, params);

      return c.json({
        success: true,
        results: result.rows,
        roleConfig: roleId ? { roleId } : null,
      });
    } catch (error: any) {
      console.error('Error in discover-by-problem:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/facility
   * Get vendor facility details
   */
  app.get("/vendor/:vendorId/facility", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ CRITICAL FIX: Check both vendors table and vendor_identity table
      // If vendor only exists in vendor_identity (approved), we need to find or create the vendor record
      let actualVendorId = vendorId;
      let vendors = await select('vendors', { id: vendorId });
      
      if (vendors.length === 0) {
        console.log(`[FACILITY] Vendor ${vendorId} not found in vendors table, checking vendor_identity...`);
        const identities = await select('vendor_identity', { id: vendorId });
        if (identities.length > 0) {
          const identity = identities[0];
          if (identity.onboarding_status === 'APPROVED' || identity.onboarding_status === 'ACTIVATED') {
            // Check if vendor exists by phone (there might be an existing vendor with different ID)
            const vendorByPhone = await select('vendors', { phone: identity.phone });
            if (vendorByPhone.length > 0) {
              actualVendorId = vendorByPhone[0].id;
              vendors = vendorByPhone;
              console.log(`[FACILITY] Found existing vendor by phone: ${actualVendorId}`);
            } else {
              // Get application data for vendor details
              const applications = await select('vendor_onboarding_applications', { vendor_identity_id: vendorId });
              const application = applications.length > 0 ? applications[0] : null;
              const payload = application?.application_payload || {};
              
              // Create vendors record
              console.log(`[FACILITY] Auto-creating vendor record for approved vendor ${vendorId}`);
              const newVendor = await insert('vendors', {
                id: vendorId,
                phone: identity.phone,
                email: payload.email || `vendor-${identity.phone}@warmpawz.app`,
                business_name: payload.businessName || payload.business_name || `Vendor ${identity.phone}`,
                owner_name: payload.contactPersonName || payload.ownerName || 'Vendor Owner',
                role_id: identity.selected_role_id,
                category: 'general',
                address: payload.address || 'Not specified',
                city: payload.city || 'Not specified',
                state: payload.state || 'Not specified',
                pincode: payload.pin || payload.pincode || '000000',
                status: 'active',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              vendors = newVendor;
              console.log(`[FACILITY] Created vendor record for ${vendorId}`);
            }
          } else {
            return c.json({ error: 'Vendor not approved or activated' }, 403);
          }
        } else {
          return c.json({ error: 'Vendor not found' }, 404);
        }
      }

      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Get services
      // Check if is_global column exists
      const serviceColumns = await query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'services' AND column_name = 'is_global'`
      );
      const hasIsGlobal = serviceColumns.rows.length > 0;
      
      const services = await query(
        `SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled, vs.service_style
         FROM services s
         LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
         WHERE (vs.vendor_id = $1${hasIsGlobal ? ' OR s.is_global = true' : ''})
         AND s.is_active = true
         AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
         ORDER BY s.name`,
        [vendor.id]
      );

      // Get rating
      const ratingResult = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
         FROM reviews
         WHERE vendor_id = $1 AND is_approved = true`,
        [vendor.id]
      );

      // Get recent reviews
      const recentReviews = await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1 AND r.is_approved = true
         ORDER BY r.created_at DESC
         LIMIT 5`,
        [vendor.id]
      );

      // ✅ FIX: Extract facility data from vendor metadata and operating_hours
      const metadata = (vendor.metadata as any) || {};
      const operatingHours = vendor.operating_hours 
        ? (typeof vendor.operating_hours === 'string' 
            ? JSON.parse(vendor.operating_hours) 
            : vendor.operating_hours)
        : null;

      // ✅ FIX: Generate presigned URLs for photos on-demand (since bucket has public access blocked)
      const rawPhotos = metadata.facility_photos || [];
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
      const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
      
      console.log(`[FACILITY-PHOTOS] Found ${rawPhotos.length} photos in metadata for vendor ${vendor.id}`);
      
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const s3Client = new S3Client({ region: AWS_REGION });
      
      const photos = await Promise.all(
        rawPhotos.map(async (photoItem: string) => {
          try {
            if (!photoItem || typeof photoItem !== 'string') {
              console.warn(`[FACILITY-PHOTOS] Invalid photo item:`, photoItem);
              return null;
            }
            
            let fileKey = photoItem.trim();
            
            // Extract key from various formats
            if (photoItem.includes('.s3.') && photoItem.includes('.amazonaws.com/')) {
              // Extract key from full S3 URL (e.g., https://bucket.s3.region.amazonaws.com/vendors/...)
              const urlParts = photoItem.split('.amazonaws.com/');
              if (urlParts.length > 1) {
                fileKey = urlParts[1].split('?')[0].split('#')[0]; // Remove query params and fragments
              }
            } else if (photoItem.includes('?') && (photoItem.includes('X-Amz') || photoItem.includes('AWSAccessKeyId'))) {
              // Extract key from presigned URL
              const urlParts = photoItem.split('?')[0];
              if (urlParts.includes('vendors/') && urlParts.includes('/facility/')) {
                const keyMatch = urlParts.match(/vendors\/[^/]+\/facility\/(.+)$/);
                if (keyMatch && keyMatch[1]) {
                  fileKey = `vendors/${vendor.id}/facility/${keyMatch[1]}`;
                } else {
                  // Try to extract from any path containing vendors/
                  const vendorsIndex = urlParts.indexOf('vendors/');
                  if (vendorsIndex >= 0) {
                    fileKey = urlParts.substring(vendorsIndex);
                  }
                }
              }
            } else if (photoItem.startsWith('vendors/')) {
              // Already a key - ensure it's for this vendor
              if (!fileKey.startsWith(`vendors/${vendor.id}/`)) {
                // If key is for different vendor or missing vendor ID, fix it
                const keyParts = fileKey.split('/');
                if (keyParts.length >= 3 && keyParts[0] === 'vendors') {
                  // Replace vendor ID in key
                  fileKey = `vendors/${vendor.id}/${keyParts.slice(2).join('/')}`;
                }
              }
            } else if (photoItem.startsWith('http://') || photoItem.startsWith('https://')) {
              // Full URL but not S3 - might be CloudFront or other CDN
              // Try to extract key or return as-is for public URLs
              console.log(`[FACILITY-PHOTOS] Photo is a full URL (non-S3), returning as-is:`, photoItem);
              return photoItem;
            }
            
            if (!fileKey || fileKey.length === 0) {
              console.warn(`[FACILITY-PHOTOS] Could not extract file key from:`, photoItem);
              return null;
            }
            
            console.log(`[FACILITY-PHOTOS] Generating presigned URL for key: ${fileKey}`);
            
            // ✅ FIX: Verify the object exists before generating presigned URL
            try {
              const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
              const headCommand = new HeadObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileKey,
              });
              await s3Client.send(headCommand);
            } catch (headError: any) {
              if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
                console.warn(`[FACILITY-PHOTOS] Object not found in S3: ${fileKey}`);
                return null;
              }
              console.warn(`[FACILITY-PHOTOS] Error checking object existence: ${fileKey}`, headError?.message);
            }
            
            // Generate fresh presigned URL (valid for 7 days)
            const command = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: fileKey,
            });
            
            const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 });
            
            // ✅ FIX: Validate presigned URL format
            if (!presignedUrl || typeof presignedUrl !== 'string' || !presignedUrl.startsWith('https://')) {
              console.error(`[FACILITY-PHOTOS] Invalid presigned URL generated for ${fileKey}`);
              return null;
            }
            
            console.log(`[FACILITY-PHOTOS] Generated presigned URL for ${fileKey} (length: ${presignedUrl.length})`);
            return presignedUrl;
          } catch (error: any) {
            console.error(`[FACILITY-PHOTOS] Error generating presigned URL for ${photoItem}:`, error?.message || error);
            // ✅ FIX: If presigned URL generation fails, try returning the original URL if it's already a valid URL
            if (photoItem && (photoItem.startsWith('http://') || photoItem.startsWith('https://'))) {
              console.log(`[FACILITY-PHOTOS] Returning original URL as fallback:`, photoItem);
              return photoItem;
            }
            return null;
          }
        })
      );
      
      const validPhotos = photos.filter((url): url is string => url !== null && url !== undefined && url.length > 0);
      console.log(`[FACILITY-PHOTOS] Returning ${validPhotos.length} valid photos out of ${rawPhotos.length} total`);

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          business_name: vendor.business_name,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          phone: vendor.phone,
          email: vendor.email,
          roleId: vendor.role_id, // ✅ FIX: Include roleId for CenterProfileManager
          role_id: vendor.role_id,
        },
        facility: {
          centerName: vendor.business_name, // ✅ FIX: Include centerName
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode || '', // ✅ FIX: Ensure pincode is returned
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          description: metadata.description || vendor.description || '', // ✅ FIX: Get description from metadata
          amenities: metadata.amenities || [],
          customAmenities: metadata.customAmenities || [], // ✅ FIX: Include custom amenities
          photos: validPhotos, // ✅ FIX: Use presigned URLs generated on-demand
          specializations: metadata.specializations || [],
          operatingHours: operatingHours || null,
          roleId: vendor.role_id, // ✅ FIX: Include roleId for SpecializationSelector
        },
        services: services.rows || [],
        rating: {
          average: parseFloat(ratingResult.rows[0]?.avg_rating || '0'),
          count: parseInt(ratingResult.rows[0]?.review_count || '0', 10),
        },
        recentReviews: recentReviews.rows || [],
      });
    } catch (error: any) {
      console.error('Error fetching vendor facility:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/facility/:vendorId
   * Update vendor facility details (address, timings, amenities, etc.)
   * ✅ FIX: This endpoint was missing, causing 404 errors in UAT
   */
  app.put("/vendor/facility/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const facilityData = await c.req.json();

      // Verify vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // ✅ FIX: Build update data object, mapping frontend fields to database columns
      const updateData: any = {};
      
      // Address fields
      if (facilityData.address !== undefined) updateData.address = facilityData.address;
      if (facilityData.city !== undefined) updateData.city = facilityData.city;
      if (facilityData.state !== undefined) updateData.state = facilityData.state;
      if (facilityData.pincode !== undefined) updateData.pincode = facilityData.pincode;
      if (facilityData.country !== undefined) updateData.country = facilityData.country;
      
      // Location coordinates
      if (facilityData.latitude !== undefined) updateData.latitude = facilityData.latitude;
      if (facilityData.longitude !== undefined) updateData.longitude = facilityData.longitude;
      
      // Operating hours (stored as JSONB)
      if (facilityData.operatingHours !== undefined || facilityData.operating_hours !== undefined) {
        updateData.operating_hours = facilityData.operatingHours || facilityData.operating_hours;
      }
      
      // ✅ FIX: Build metadata object once to avoid overwriting
      const existingMetadata = (vendor.metadata as any) || {};
      const updatedMetadata: any = { ...existingMetadata };
      let metadataChanged = false;
      
      // Amenities (stored in metadata)
      if (facilityData.amenities !== undefined) {
        updatedMetadata.amenities = facilityData.amenities;
        metadataChanged = true;
      }
      
      // Custom amenities
      if (facilityData.customAmenities !== undefined) {
        updatedMetadata.customAmenities = facilityData.customAmenities;
        metadataChanged = true;
      }
      
      // Specializations (stored in metadata)
      if (facilityData.specializations !== undefined) {
        updatedMetadata.specializations = facilityData.specializations;
        metadataChanged = true;
      }
      
      // Facility photos (stored in metadata)
      if (facilityData.photos !== undefined || facilityData.facility_photos !== undefined) {
        const photosInput = facilityData.photos || facilityData.facility_photos || [];
        // ✅ FIX: Normalize photos - extract S3 keys from presigned URLs or full URLs
        const normalizedPhotos = photosInput.map((photoItem: string) => {
          if (!photoItem || typeof photoItem !== 'string') {
            return null;
          }
          
          // If it's already a key (starts with vendors/), return as-is
          if (photoItem.startsWith('vendors/')) {
            return photoItem;
          }
          
          // If it's a presigned URL or full S3 URL, extract the key
          if (photoItem.includes('.s3.') && photoItem.includes('.amazonaws.com/')) {
            // Extract key from full S3 URL
            const urlParts = photoItem.split('.amazonaws.com/');
            if (urlParts.length > 1) {
              return urlParts[1].split('?')[0].split('#')[0];
            }
          } else if (photoItem.includes('?') && (photoItem.includes('X-Amz') || photoItem.includes('AWSAccessKeyId'))) {
            // Extract key from presigned URL
            const urlParts = photoItem.split('?')[0];
            if (urlParts.includes('vendors/')) {
              const vendorsIndex = urlParts.indexOf('vendors/');
              return urlParts.substring(vendorsIndex);
            }
          }
          
          // If we can't extract a key, return null (invalid photo)
          console.warn(`[FACILITY-SAVE] Could not normalize photo, skipping:`, photoItem);
          return null;
        }).filter((key): key is string => key !== null && key.length > 0);
        
        console.log(`[FACILITY-SAVE] Normalized ${normalizedPhotos.length} photos from ${photosInput.length} input photos`);
        updatedMetadata.facility_photos = normalizedPhotos;
        metadataChanged = true;
      }
      
      // ✅ FIX: Store description in metadata (column doesn't exist in vendors table)
      if (facilityData.description !== undefined) {
        updatedMetadata.description = facilityData.description;
        metadataChanged = true;
      }
      
      // Update metadata if any metadata fields changed
      if (metadataChanged) {
        // ✅ FIX B1: Check if metadata column exists before trying to update it
        // If column doesn't exist, we'll use a raw SQL query to add it first
        try {
          // Check if metadata column exists
          const { query } = await import('../database/rds-connection');
          const columnCheck = await query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'vendors' AND column_name = 'metadata'`
          );
          
          if (columnCheck.rows.length === 0) {
            // Column doesn't exist, add it
            console.log('[FACILITY] Metadata column missing, adding it...');
            await query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS metadata JSONB');
            console.log('[FACILITY] Metadata column added successfully');
          }
          
          updateData.metadata = updatedMetadata;
        } catch (metadataError: any) {
          console.error('[FACILITY] Error handling metadata column:', metadataError);
          // If metadata update fails, continue with other fields but log the error
          // Don't fail the entire request if metadata column is missing
          if (!metadataError.message?.includes('does not exist')) {
            throw metadataError;
          }
          // Skip metadata update if column truly doesn't exist
          console.warn('[FACILITY] Skipping metadata update - column may not exist');
        }
      }
      
      // ✅ FIX: Validate that at least one field is being updated
      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'No valid fields to update. Please provide at least one facility field' }, 400);
      }

      // Always update the updated_at timestamp
      updateData.updated_at = new Date().toISOString();

      // Update vendor record with facility information
      const { update } = await import('../database/rds-connection');
      const updated = await update('vendors', { id: vendorId }, updateData);

      if (updated.length === 0) {
        return c.json({ error: 'Failed to update facility' }, 500);
      }

      return c.json({
        success: true,
        message: 'Facility updated successfully',
        facility: {
          address: updated[0].address,
          city: updated[0].city,
          state: updated[0].state,
          pincode: updated[0].pincode,
          latitude: updated[0].latitude,
          longitude: updated[0].longitude,
          operating_hours: updated[0].operating_hours,
          amenities: (updated[0].metadata as any)?.amenities || [],
          photos: (updated[0].metadata as any)?.facility_photos || [],
        },
      });
    } catch (error: any) {
      console.error('Error updating vendor facility:', error);
      return c.json({ error: error.message || 'Failed to update facility' }, 500);
    }
  });

  /**
   * POST /vendor/facility/:vendorId/upload-photos
   * Upload facility photos for a vendor
   * ✅ FIX: This endpoint was missing, causing 404 errors
   */
  app.post("/vendor/facility/:vendorId/upload-photos", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`📸 [FACILITY-PHOTOS] Uploading photos for vendor: ${vendorId}`);
      
      // Verify vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Parse the multipart form data
      const formData = await c.req.formData();
      const photos = formData.getAll('photos') as File[];
      
      if (!photos || photos.length === 0) {
        return c.json({ error: 'No photos provided' }, 400);
      }

      console.log(`📸 [FACILITY-PHOTOS] Processing ${photos.length} photos`);
      
      // Upload photos to S3
      const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
      
      const photoUrls: string[] = [];
      const photoKeys: string[] = [];
      
      for (const photo of photos) {
        try {
          // Generate a unique filename
          const timestamp = Date.now();
          const ext = photo.name.split('.').pop() || 'jpg';
          const fileKey = `vendors/${vendorId}/facility/facility_${timestamp}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
          
          // Convert File to ArrayBuffer and upload to S3
          const arrayBuffer = await photo.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileKey,
            Body: uint8Array,
            ContentType: photo.type || 'image/jpeg',
            // ✅ FIX: No ACL needed - bucket has public access blocked, we'll use presigned URLs
          }));
          
          // ✅ FIX: Store S3 key only (not URL) - we'll generate presigned URLs on-demand when retrieving
          photoUrls.push(fileKey); // Store key, not URL
          photoKeys.push(fileKey);
          
          console.log(`📸 [FACILITY-PHOTOS] Uploaded to S3: ${fileKey}`);
        } catch (photoError: any) {
          console.error(`❌ [FACILITY-PHOTOS] Error processing photo ${photo.name}:`, photoError);
          // Continue with other photos
        }
      }

      // Update vendor metadata with new photos
      const vendor = vendors[0];
      const existingMetadata = (vendor.metadata as any) || {};
      const existingPhotos = existingMetadata.facility_photos || [];
      const allPhotos = [...existingPhotos, ...photoUrls];
      
      const { update } = await import('../database/rds-connection');
      await update('vendors', { id: vendorId }, {
        metadata: { ...existingMetadata, facility_photos: allPhotos },
        updated_at: new Date().toISOString(),
      });

      console.log(`✅ [FACILITY-PHOTOS] Uploaded ${photoUrls.length} photos for vendor ${vendorId}`);

      return c.json({
        success: true,
        photoUrls: photoUrls,
        totalPhotos: allPhotos.length,
      });
    } catch (error: any) {
      console.error('Error uploading facility photos:', error);
      return c.json({ error: error.message || 'Failed to upload photos' }, 500);
    }
  });


  /**
   * GET /customer/facility/:vendorId
   * Customer-facing endpoint to get vendor/clinic facility details
   */
  app.get("/customer/facility/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      if (!vendorId || !isValidUUID(vendorId)) {
        return c.json({ error: 'Valid vendor ID is required' }, 400);
      }

      // Get vendor details
      const vendorResult = await query(
        `SELECT v.*, r.name as role_name, r.display_name as role_display_name,
                r.config as role_config
         FROM vendors v
         LEFT JOIN roles r ON v.role_id = r.id
         WHERE v.id = $1`,
        [vendorId]
      );

      if (vendorResult.rows.length === 0) {
        return c.json({ error: 'Vendor not found', success: false }, 404);
      }

      const vendor = vendorResult.rows[0];

      // Get rating
      const ratingResult = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
         FROM reviews WHERE vendor_id = $1`,
        [vendorId]
      );

      // Get recent reviews
      const reviewsResult = await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1
         ORDER BY r.created_at DESC LIMIT 5`,
        [vendorId]
      );

      // Get staff
      const staffResult = await query(
        `SELECT id, name, role, experience_years, is_active
         FROM staff WHERE vendor_id = $1 AND is_active = true`,
        [vendorId]
      );

      // ✅ FIX: Extract metadata for description, custom amenities, and photos
      const metadata = (vendor.metadata as any) || {};
      const operatingHours = vendor.operating_hours 
        ? (typeof vendor.operating_hours === 'string' 
            ? JSON.parse(vendor.operating_hours) 
            : vendor.operating_hours)
        : null;

      // ✅ FIX: Generate presigned URLs for photos on-demand (since bucket has public access blocked)
      const rawPhotos = metadata.facility_photos || [];
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
      const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
      
      console.log(`[FACILITY-PHOTOS] Found ${rawPhotos.length} photos in metadata for vendor ${vendor.id}`);
      
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const s3Client = new S3Client({ region: AWS_REGION });
      
      const photos = await Promise.all(
        rawPhotos.map(async (photoItem: string) => {
          try {
            if (!photoItem || typeof photoItem !== 'string') {
              console.warn(`[FACILITY-PHOTOS] Invalid photo item:`, photoItem);
              return null;
            }
            
            let fileKey = photoItem.trim();
            
            // Extract key from various formats
            if (photoItem.includes('.s3.') && photoItem.includes('.amazonaws.com/')) {
              // Extract key from full S3 URL (e.g., https://bucket.s3.region.amazonaws.com/vendors/...)
              const urlParts = photoItem.split('.amazonaws.com/');
              if (urlParts.length > 1) {
                fileKey = urlParts[1].split('?')[0].split('#')[0]; // Remove query params and fragments
              }
            } else if (photoItem.includes('?') && (photoItem.includes('X-Amz') || photoItem.includes('AWSAccessKeyId'))) {
              // Extract key from presigned URL
              const urlParts = photoItem.split('?')[0];
              if (urlParts.includes('vendors/') && urlParts.includes('/facility/')) {
                const keyMatch = urlParts.match(/vendors\/[^/]+\/facility\/(.+)$/);
                if (keyMatch && keyMatch[1]) {
                  fileKey = `vendors/${vendor.id}/facility/${keyMatch[1]}`;
                } else {
                  // Try to extract from any path containing vendors/
                  const vendorsIndex = urlParts.indexOf('vendors/');
                  if (vendorsIndex >= 0) {
                    fileKey = urlParts.substring(vendorsIndex);
                  }
                }
              }
            } else if (photoItem.startsWith('vendors/')) {
              // Already a key - ensure it's for this vendor
              if (!fileKey.startsWith(`vendors/${vendor.id}/`)) {
                // If key is for different vendor or missing vendor ID, fix it
                const keyParts = fileKey.split('/');
                if (keyParts.length >= 3 && keyParts[0] === 'vendors') {
                  // Replace vendor ID in key
                  fileKey = `vendors/${vendor.id}/${keyParts.slice(2).join('/')}`;
                }
              }
            } else if (photoItem.startsWith('http://') || photoItem.startsWith('https://')) {
              // Full URL but not S3 - might be CloudFront or other CDN
              // Try to extract key or return as-is for public URLs
              console.log(`[FACILITY-PHOTOS] Photo is a full URL (non-S3), returning as-is:`, photoItem);
              return photoItem;
            }
            
            if (!fileKey || fileKey.length === 0) {
              console.warn(`[FACILITY-PHOTOS] Could not extract file key from:`, photoItem);
              return null;
            }
            
            console.log(`[FACILITY-PHOTOS] Generating presigned URL for key: ${fileKey}`);
            
            // ✅ FIX: Verify the object exists before generating presigned URL
            try {
              const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
              const headCommand = new HeadObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileKey,
              });
              await s3Client.send(headCommand);
            } catch (headError: any) {
              if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
                console.warn(`[FACILITY-PHOTOS] Object not found in S3: ${fileKey}`);
                return null;
              }
              console.warn(`[FACILITY-PHOTOS] Error checking object existence: ${fileKey}`, headError?.message);
            }
            
            // Generate fresh presigned URL (valid for 7 days)
            const command = new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: fileKey,
            });
            
            const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 });
            
            // ✅ FIX: Validate presigned URL format
            if (!presignedUrl || typeof presignedUrl !== 'string' || !presignedUrl.startsWith('https://')) {
              console.error(`[FACILITY-PHOTOS] Invalid presigned URL generated for ${fileKey}`);
              return null;
            }
            
            console.log(`[FACILITY-PHOTOS] Generated presigned URL for ${fileKey} (length: ${presignedUrl.length})`);
            return presignedUrl;
          } catch (error: any) {
            console.error(`[FACILITY-PHOTOS] Error generating presigned URL for ${photoItem}:`, error?.message || error);
            // ✅ FIX: If presigned URL generation fails, try returning the original URL if it's already a valid URL
            if (photoItem && (photoItem.startsWith('http://') || photoItem.startsWith('https://'))) {
              console.log(`[FACILITY-PHOTOS] Returning original URL as fallback:`, photoItem);
              return photoItem;
            }
            return null;
          }
        })
      );
      
      const validPhotos = photos.filter((url): url is string => url !== null && url !== undefined && url.length > 0);
      console.log(`[FACILITY-PHOTOS] Returning ${validPhotos.length} valid photos out of ${rawPhotos.length} total`);

      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          ownerName: vendor.owner_name,
          phone: vendor.phone,
          email: vendor.email,
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode || '', // ✅ FIX: Ensure pincode is returned
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          description: metadata.description || vendor.description || '', // ✅ FIX: Get description from metadata
          logoUrl: vendor.logo_url,
          coverImageUrl: vendor.cover_image_url,
          role: vendor.role_name,
          roleDisplayName: vendor.role_display_name,
        },
        facility: {
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode || '', // ✅ FIX: Include pincode
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          photos: validPhotos, // ✅ FIX: Use presigned URLs generated on-demand
          amenities: metadata.amenities || vendor.amenities || [], // ✅ FIX: Get from metadata
          customAmenities: metadata.customAmenities || [], // ✅ FIX: Include custom amenities
          description: metadata.description || vendor.description || '', // ✅ FIX: Include description
          operatingHours: operatingHours, // ✅ FIX: Parse operating hours
          specializations: metadata.specializations || [], // ✅ FIX: Include specializations
        },
        rating: {
          average: parseFloat(ratingResult.rows[0]?.avg_rating || '0').toFixed(1),
          count: parseInt(ratingResult.rows[0]?.review_count || '0', 10),
        },
        recentReviews: reviewsResult.rows.map(r => ({
          id: r.id,
          customerName: r.customer_name || 'Anonymous',
          rating: r.rating,
          comment: r.comment,
          date: r.created_at,
        })),
        staff: staffResult.rows.map(s => ({
          id: s.id,
          name: s.name,
          role: s.role,
          experienceYears: s.experience_years,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching facility:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * GET /customer/clinic/:vendorId/services
   * Get services for a specific clinic/vendor
   */
  app.get("/customer/clinic/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const serviceStyle = c.req.query('style') || c.req.query('serviceStyle');
      
      if (!vendorId || !isValidUUID(vendorId)) {
        return c.json({ error: 'Valid vendor ID is required', success: false }, 400);
      }

      // Get vendor services from vendor_services table
      let servicesQuery = `
        SELECT 
          vs.id,
          vs.service_id,
          vs.service_name,
          vs.service_style,
          vs.price,
          vs.duration_minutes as duration,
          vs.custom_description as description,
          vs.is_enabled,
          vs.publish_status,
          vs.category as category_name,
          vs.sub_category as sub_category_name,
          vs.is_custom_service as is_package,
          vs.metadata as package_details,
          s.name as base_service_name,
          s.description as base_description
        FROM vendor_services vs
        LEFT JOIN services s ON vs.service_id = s.id
        WHERE vs.vendor_id = $1 
          AND vs.is_enabled = true 
          AND vs.publish_status = 'published'
      `;
      
      const params: any[] = [vendorId];
      
      if (serviceStyle) {
        servicesQuery += ` AND vs.service_style = $2`;
        params.push(serviceStyle);
      }
      
      servicesQuery += ` ORDER BY vs.category, vs.service_name`;

      const servicesResult = await query(servicesQuery, params);

      const services = servicesResult.rows.map(s => ({
        id: s.id,
        serviceId: s.service_id,
        serviceName: s.service_name || s.base_service_name,
        description: s.description || s.base_description || '',
        price: parseFloat(s.price || 0),
        duration: s.duration || 30,
        serviceStyle: s.service_style,
        categoryName: s.category_name || s.category,
        subCategoryName: s.sub_category_name || s.sub_category,
        isPackage: s.is_package,
        packageDetails: s.package_details,
        isEnabled: s.is_enabled,
        publishStatus: s.publish_status,
      }));

      // Group by service style
      const groupedServices = {
        at_center: services.filter(s => s.serviceStyle === 'at_center'),
        at_home: services.filter(s => s.serviceStyle === 'at_home'),
        tele: services.filter(s => s.serviceStyle === 'tele'),
      };

      return c.json({
        success: true,
        services,
        grouped: groupedServices,
        total: services.length,
      });
    } catch (error: any) {
      console.error('Error fetching clinic services:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * GET /customer/services/by-style
   * Get available services filtered by style (tele, at_home, at_center)
   * 
   * ⚠️ CRITICAL BUSINESS RULE for at_home and tele:
   * - For BUSINESS ENTITIES (clinics, grooming centers): Return only VERIFIED STAFF MEMBERS
   * - For INDIVIDUAL PROVIDERS (home groomers, individual vets): Return the provider directly
   * - Only verified providers (mobile_verified = true) appear in results
   */
  app.get("/customer/services/by-style", async (c) => {
    try {
      const serviceStyle = c.req.query('style');
      const category = c.req.query('category');
      const roleId = c.req.query('roleId'); // ✅ FIX: Support roleId parameter
      const specialization = c.req.query('specialization'); // ✅ FIX: Support specialization parameter
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const radius = parseInt(c.req.query('radius') || '50', 10); // km
      
      if (!serviceStyle) {
        return c.json({ error: 'Service style is required (tele, at_home, at_center)', success: false }, 400);
      }

      const customerLat = latitude ? parseFloat(latitude) : null;
      const customerLng = longitude ? parseFloat(longitude) : null;

      // ========== FOR AT_CENTER: Return vendors directly ==========
      if (serviceStyle === 'at_center') {
        let vendorsQuery = `
          SELECT DISTINCT ON (v.id)
            v.id as vendor_id,
            v.business_name,
            v.owner_name,
            v.phone,
            v.address,
            v.city,
            v.latitude,
            v.longitude,
            r.name as role_name,
            r.display_name as role_display_name,
            (SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id) as avg_rating,
            (SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id) as review_count,
            'vendor' as provider_type
          FROM vendors v
          LEFT JOIN roles r ON v.role_id = r.id
          INNER JOIN vendor_services vs ON vs.vendor_id = v.id
          WHERE v.status = 'approved' 
            AND v.is_active = true
            AND vs.service_style = $1
            AND vs.is_enabled = true
            AND vs.publish_status = 'published'
            AND (r.name IS NULL OR r.name NOT LIKE '%_solo')
        `;
        
        const params: any[] = [serviceStyle];
        let paramIndex = 2;

        if (category) {
          // ✅ FIX: For at_center (clinics), exclude solo vendors - they are individual providers, not organizations
          const categoryRoles: Record<string, string[]> = {
            'vet': ['veterinarian', 'vet_clinic', 'vet', 'Veterinarian'], // Excluded 'vet_solo'
            'grooming': ['groomer', 'grooming_salon', 'pet_groomer'], // Excluded 'grooming_solo'
            'training': ['trainer', 'pet_trainer'], // Excluded 'training_solo'
            'nutritionist': ['nutritionist', 'pet_nutritionist'], // Excluded 'nutritionist_solo'
            'walker': ['walker', 'pet_walker', 'dog_walker'], // Excluded 'walker_solo'
            'behaviourist': ['behaviourist', 'pet_behaviourist'], // Excluded 'behaviourist_solo'
            'sitting': ['pet_sitter', 'sitter'], // Excluded 'sitter_solo'
            'diagnostics': ['diagnostics_provider'], // Excluded 'diagnostics_solo'
          };
          const roles = categoryRoles[category.toLowerCase()];
          if (roles) {
            vendorsQuery += ` AND r.name = ANY($${paramIndex})`;
            params.push(roles);
            paramIndex++;
          }
        }

        // ✅ FIX: Filter by specialization if provided
        if (specialization) {
          // Check if vendors table has specialization column
          const hasSpecializationColumn = await query(`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'vendors' AND column_name = 'specialization'
            )
          `).then(r => r.rows[0]?.exists).catch(() => false);

          // Check if vendors table has metadata column with specializations
          const hasMetadataColumn = await query(`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'vendors' AND column_name = 'metadata'
            )
          `).then(r => r.rows[0]?.exists).catch(() => false);

          if (hasSpecializationColumn) {
            vendorsQuery += ` AND (
              v.specialization ILIKE $${paramIndex} OR
              v.specialization = $${paramIndex}
            )`;
            params.push(`%${specialization}%`);
            paramIndex++;
          } else if (hasMetadataColumn) {
            // Check metadata JSON for specializations array
            vendorsQuery += ` AND (
              v.metadata::text ILIKE $${paramIndex} OR
              EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(v.metadata->'specializations') AS spec
                WHERE spec ILIKE $${paramIndex}
              )
            )`;
            params.push(`%${specialization}%`);
            paramIndex++;
          }
        }

        vendorsQuery += ` ORDER BY v.id, avg_rating DESC NULLS LAST LIMIT 50`;

        const vendorsResult = await query(vendorsQuery, params);

        const vendorsWithServices = await Promise.all(
          vendorsResult.rows.map(async (vendor) => {
            const servicesResult = await query(
              `SELECT 
                vs.id,
                vs.service_id,
                vs.service_name,
                vs.price,
                vs.duration_minutes as duration,
                vs.custom_description as description,
                vs.category as category_name
               FROM vendor_services vs
               WHERE vs.vendor_id = $1 
                 AND vs.service_style = $2
                 AND vs.is_enabled = true
                 AND vs.publish_status = 'published'
               ORDER BY vs.price ASC`,
              [vendor.vendor_id, serviceStyle]
            );

            let distance = null;
            if (customerLat && customerLng && vendor.latitude && vendor.longitude) {
              distance = calculateDistance(customerLat, customerLng, parseFloat(vendor.latitude), parseFloat(vendor.longitude));
            }

            return {
              providerId: vendor.vendor_id,
              providerType: 'vendor',
              vendorId: vendor.vendor_id,
              name: vendor.business_name || vendor.owner_name,
              phone: vendor.phone,
              address: vendor.address,
              city: vendor.city,
              role: vendor.role_display_name || vendor.role_name,
              rating: parseFloat(vendor.avg_rating || '0').toFixed(1),
              reviewCount: parseInt(vendor.review_count || '0', 10),
              distance: distance ? parseFloat(distance.toFixed(2)) : null,
              isVerified: true, // Vendors don't need mobile verification
              services: servicesResult.rows.map(s => ({
                id: s.id,
                serviceId: s.service_id,
                name: s.service_name,
                price: parseFloat(s.price || 0),
                duration: s.duration || 30,
                description: s.description,
                category: s.category_name,
              })),
            };
          })
        );

        const filteredVendors = vendorsWithServices.filter(v => v.services.length > 0);

        return c.json({
          success: true,
          style: serviceStyle,
          providers: filteredVendors,
          total: filteredVendors.length,
        });
      }

      // ========== FOR AT_HOME and TELE: Return verified staff/individual providers ==========
      // 1. Get individual providers (staff with vendor_id = NULL and is_individual_provider = true)
      // 2. Get verified staff members from clinics/centers who are assigned to this service style

      const providers: any[] = [];

      // Check column existence for robust query building
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'photo') as has_photo,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'experience_years') as has_experience,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'qualifications') as has_qualifications,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'mobile_verified') as has_mobile_verified,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'default_location') as has_default_location,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'is_individual_provider') as has_individual_provider,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_services' AND column_name = 'enabled_by_staff') as has_enabled_by_staff,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_services' AND column_name = 'service_styles') as has_service_styles,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') as has_reviews_table,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'staff_id') as has_reviews_staff_id
      `);

      const {
        has_photo,
        has_experience,
        has_qualifications,
        has_mobile_verified,
        has_default_location,
        has_individual_provider,
        has_enabled_by_staff,
        has_service_styles,
        has_reviews_table,
        has_reviews_staff_id
      } = schemaCheck.rows[0] || {};

      // Build dynamic column selections based on schema availability
      const photoColumn = has_photo ? 's.photo' : 'NULL';
      const experienceColumn = has_experience ? 's.experience_years' : 'NULL';
      const qualificationsColumn = has_qualifications ? 's.qualifications' : 'NULL';
      const defaultLocationColumn = has_default_location ? 's.default_location' : 'NULL';
      const mobileVerifiedCondition = has_mobile_verified ? 'AND s.mobile_verified = true' : '';
      const individualProviderCondition = has_individual_provider ? 'AND s.is_individual_provider = true' : '';
      const enabledByStaffCondition = has_enabled_by_staff ? 'AND ss.enabled_by_staff = true' : '';
      const serviceStyleFilter = has_service_styles ? '$PARAM = ANY(ss.service_styles)' : 'TRUE';
      const avgRatingSubquery = (has_reviews_table && has_reviews_staff_id) 
        ? 'COALESCE((SELECT AVG(rating) FROM reviews WHERE staff_id = s.id), 0)' 
        : '0';
      const reviewCountSubquery = (has_reviews_table && has_reviews_staff_id) 
        ? 'COALESCE((SELECT COUNT(*) FROM reviews WHERE staff_id = s.id), 0)' 
        : '0';

      // Category role mapping - comprehensive list including solo providers
      const categoryRoles: Record<string, string[]> = {
        'vet': ['Veterinarian', 'veterinarian', 'vet', 'vet_clinic', 'vet_solo'],
        'grooming': ['Groomer', 'groomer', 'pet_groomer', 'grooming_salon', 'grooming_solo'],
        'training': ['Trainer', 'trainer', 'pet_trainer', 'training_solo'],
        'walker': ['Walker', 'walker', 'pet_walker', 'dog_walker', 'walker_solo'],
        'nutritionist': ['nutritionist', 'pet_nutritionist', 'nutritionist_solo'],
        'behaviourist': ['behaviourist', 'pet_behaviourist', 'behaviourist_solo'],
        'sitting': ['pet_sitter', 'sitter', 'sitter_solo'],
        'diagnostics': ['diagnostics_provider', 'diagnostics_solo'],
      };

      // ✅ FIX: Use roleId if provided, otherwise use category mapping
      // If both category and roleId are provided, combine them for better matching
      let targetRoles: string[] = [];
      if (roleId) {
        // If roleId is provided, try to get role name from database
        try {
          const roles = await query(
            `SELECT name, display_name FROM roles WHERE id = $1 OR name = $1`,
            [roleId]
          );
          if (roles.rows.length > 0) {
            const role = roles.rows[0];
            targetRoles = [role.name, role.display_name, roleId];
            // Also add common variations based on role name
            if (role.name.toLowerCase().includes('vet') || role.name.toLowerCase().includes('veterinarian')) {
              targetRoles.push(...categoryRoles['vet']);
            }
          } else {
            // If not found in DB, use roleId as-is and add common variations
            targetRoles = [roleId];
            if (roleId.toLowerCase().includes('vet') || roleId.toLowerCase().includes('veterinarian')) {
              targetRoles.push(...categoryRoles['vet']);
            }
          }
        } catch (err) {
          console.warn('Error fetching role:', err);
          // Fallback: use roleId as-is and add category roles if category matches
          targetRoles = [roleId];
          if (roleId.toLowerCase().includes('vet') || roleId.toLowerCase().includes('veterinarian')) {
            targetRoles.push(...categoryRoles['vet']);
          }
        }
      }
      
      // ✅ FIX: Also include category roles if category is provided (combine with roleId results)
      if (category) {
        const categoryRoleList = categoryRoles[category.toLowerCase()] || [];
        // Merge category roles with existing targetRoles, avoiding duplicates
        const combinedRoles = [...new Set([...targetRoles, ...categoryRoleList])];
        targetRoles = combinedRoles;
      }
      
      // ✅ FIX: If no roles found, use category as fallback
      if (targetRoles.length === 0 && category) {
        targetRoles = categoryRoles[category.toLowerCase()] || [];
      }
      
      console.log(`[Services By Style] Target roles for roleId=${roleId}, category=${category}:`, targetRoles);

      // ========== 1. Get Individual Providers (no vendor_id, verified) ==========
      let individualQuery = `
        SELECT 
          s.id,
          s.name,
          s.phone,
          s.email,
          ${photoColumn} as photo,
          s.role,
          ${experienceColumn} as experience_years,
          ${qualificationsColumn} as qualifications,
          ${defaultLocationColumn} as default_location,
          ${has_individual_provider ? 's.is_individual_provider' : 'false'} as is_individual_provider,
          ${has_mobile_verified ? 's.mobile_verified' : 'true'} as mobile_verified,
          ${avgRatingSubquery} as avg_rating,
          ${reviewCountSubquery} as review_count
        FROM staff s
        WHERE s.is_active = true
          ${mobileVerifiedCondition}
          AND s.vendor_id IS NULL
          ${individualProviderCondition}
      `;

      const individualParams: any[] = [];
      let individualParamIdx = 1;

      if (targetRoles.length > 0) {
        individualQuery += ` AND s.role = ANY($${individualParamIdx})`;
        individualParams.push(targetRoles);
        individualParamIdx++;
      }

      // Check if staff has services with this style enabled (check both staff_services AND vendor_services)
      const styleFilterWithParam = has_service_styles 
        ? `$${individualParamIdx} = ANY(ss.service_styles)` 
        : 'TRUE';
      
      individualQuery += ` AND (
        EXISTS (
          SELECT 1 FROM staff_services ss 
          WHERE ss.staff_id = s.id 
            ${enabledByStaffCondition}
            AND ss.is_active = true
            AND ${styleFilterWithParam}
        )
        OR
        -- Fallback: Check if individual provider has vendor_services with this style enabled
        EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id = s.vendor_id
            AND vs.is_enabled = true
            AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
            AND vs.service_style = $${individualParamIdx}
        )
      )`;
      individualParams.push(serviceStyle);
      individualParamIdx++;

      // ✅ FIX: Filter by specialization if provided (check staff_specializations table)
      if (specialization) {
        const hasStaffSpecializationsTable = await query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'staff_specializations'
          )
        `).then(r => r.rows[0]?.exists).catch(() => false);

        if (hasStaffSpecializationsTable) {
          individualQuery += ` AND EXISTS (
            SELECT 1 FROM staff_specializations ss
            WHERE ss.staff_id = s.id
              AND (ss.specialization ILIKE $${individualParamIdx} OR ss.specialization = $${individualParamIdx})
          )`;
          individualParams.push(`%${specialization}%`);
          individualParamIdx++;
        }
      }

      const individualResult = await query(individualQuery, individualParams);

      for (const ind of individualResult.rows) {
        // Get services for this individual - first try staff_services
        let servicesResult = await query(
          `SELECT 
            ss.id,
            ss.service_id,
            ss.price,
            ss.duration_minutes as duration,
            ss.service_styles,
            s.name as service_name,
            s.description,
            s.category
           FROM staff_services ss
           INNER JOIN services s ON ss.service_id = s.id
           WHERE ss.staff_id = $1 
             AND ss.enabled_by_staff = true 
             AND ss.is_active = true
             AND $2 = ANY(ss.service_styles)
           ORDER BY ss.price ASC`,
          [ind.id, serviceStyle]
        ).catch(() => ({ rows: [] }));

        // ✅ FIX: If no staff_services found, try vendor_services (for individual providers who use vendor_services)
        if (servicesResult.rows.length === 0 && ind.vendor_id) {
          servicesResult = await query(
            `SELECT 
              vs.id,
              vs.service_id,
              vs.price,
              vs.duration_minutes as duration,
              vs.service_name,
              vs.custom_description as description,
              vs.category
             FROM vendor_services vs
             WHERE vs.vendor_id = $1 
               AND vs.service_style = $2
               AND vs.is_enabled = true
               AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
             ORDER BY vs.price ASC`,
            [ind.vendor_id, serviceStyle]
          ).catch(() => ({ rows: [] }));
        }

        // Calculate distance if location available
        let distance = null;
        if (customerLat && customerLng && ind.default_location) {
          const loc = typeof ind.default_location === 'string' 
            ? JSON.parse(ind.default_location) 
            : ind.default_location;
          if (loc.lat && loc.lng) {
            distance = calculateDistance(customerLat, customerLng, parseFloat(loc.lat), parseFloat(loc.lng));
          }
        }

        providers.push({
          providerId: ind.id,
          providerType: 'individual',
          staffId: ind.id,
          vendorId: ind.vendor_id || null,
          name: ind.name,
          phone: ind.phone,
          photo: ind.photo,
          role: ind.role,
          experienceYears: ind.experience_years,
          qualifications: ind.qualifications,
          rating: parseFloat(ind.avg_rating || '0').toFixed(1),
          reviewCount: parseInt(ind.review_count || '0', 10),
          distance: distance ? parseFloat(distance.toFixed(2)) : null,
          isVerified: true,
          isIndividualProvider: true,
          services: servicesResult.rows.map(s => ({
            id: s.id,
            serviceId: s.service_id,
            name: s.service_name,
            price: parseFloat(s.price || 0),
            duration: s.duration || 30,
            description: s.description,
            category: s.category,
          })),
        });
      }

      // ========== 2. Get Verified Staff from Clinics/Centers ==========
      let staffQuery = `
        SELECT 
          s.id,
          s.name,
          s.phone,
          s.email,
          ${photoColumn} as photo,
          s.role,
          ${experienceColumn} as experience_years,
          ${qualificationsColumn} as qualifications,
          ${defaultLocationColumn} as default_location,
          ${has_mobile_verified ? 's.mobile_verified' : 'true'} as mobile_verified,
          s.vendor_id,
          v.business_name as vendor_name,
          v.address as vendor_address,
          v.city as vendor_city,
          v.latitude as vendor_lat,
          v.longitude as vendor_lng,
          r.display_name as vendor_role_display,
          ${avgRatingSubquery} as avg_rating,
          ${reviewCountSubquery} as review_count
        FROM staff s
        INNER JOIN vendors v ON s.vendor_id = v.id
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE s.is_active = true
          ${mobileVerifiedCondition}
          AND v.status = 'approved'
          AND v.is_active = true
          AND s.vendor_id IS NOT NULL
      `;

      const staffParams: any[] = [];
      let staffParamIdx = 1;

      // Filter by role
      if (targetRoles.length > 0) {
        staffQuery += ` AND s.role = ANY($${staffParamIdx})`;
        staffParams.push(targetRoles);
        staffParamIdx++;
      }

      // Check if staff has services with this style enabled (check both staff_services AND vendor_services)
      const staffStyleFilterWithParam = has_service_styles 
        ? `$${staffParamIdx} = ANY(ss.service_styles)` 
        : 'TRUE';
        
      staffQuery += ` AND (
        EXISTS (
          SELECT 1 FROM staff_services ss 
          WHERE ss.staff_id = s.id 
            ${enabledByStaffCondition}
            AND ss.is_active = true
            AND ${staffStyleFilterWithParam}
        )
        OR
        -- Fallback: Check if vendor has published services with this style
        EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id = s.vendor_id
            AND vs.is_enabled = true
            AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
            AND vs.service_style = $${staffParamIdx}
        )
      )`;
      staffParams.push(serviceStyle);
      staffParamIdx++;

      // ✅ FIX: Filter by specialization if provided (check staff_specializations table)
      if (specialization) {
        const hasStaffSpecializationsTable = await query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'staff_specializations'
          )
        `).then(r => r.rows[0]?.exists).catch(() => false);

        if (hasStaffSpecializationsTable) {
          staffQuery += ` AND EXISTS (
            SELECT 1 FROM staff_specializations ss
            WHERE ss.staff_id = s.id
              AND (ss.specialization ILIKE $${staffParamIdx} OR ss.specialization = $${staffParamIdx})
          )`;
          staffParams.push(`%${specialization}%`);
          staffParamIdx++;
        }
      }

      const staffResult = await query(staffQuery, staffParams);

      for (const staff of staffResult.rows) {
        // Get services for this staff - first try staff_services
        let servicesResult = await query(
          `SELECT 
            ss.id,
            ss.service_id,
            ss.price,
            ss.duration_minutes as duration,
            ss.service_styles,
            s.name as service_name,
            s.description,
            s.category
           FROM staff_services ss
           INNER JOIN services s ON ss.service_id = s.id
           WHERE ss.staff_id = $1 
             AND ss.enabled_by_staff = true 
             AND ss.is_active = true
             AND $2 = ANY(ss.service_styles)
           ORDER BY ss.price ASC`,
          [staff.id, serviceStyle]
        ).catch(() => ({ rows: [] }));

        // ✅ FIX: If no staff_services found, fallback to vendor_services
        if (servicesResult.rows.length === 0 && staff.vendor_id) {
          servicesResult = await query(
            `SELECT 
              vs.id,
              vs.service_id,
              vs.price,
              vs.duration_minutes as duration,
              vs.service_name,
              vs.custom_description as description,
              vs.category
             FROM vendor_services vs
             WHERE vs.vendor_id = $1 
               AND vs.service_style = $2
               AND vs.is_enabled = true
               AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
             ORDER BY vs.price ASC`,
            [staff.vendor_id, serviceStyle]
          ).catch(() => ({ rows: [] }));
        }

        // Calculate distance
        let distance = null;
        if (customerLat && customerLng) {
          // First try staff's default_location, then vendor's location
          let lat = null, lng = null;
          if (staff.default_location) {
            const loc = typeof staff.default_location === 'string' 
              ? JSON.parse(staff.default_location) 
              : staff.default_location;
            lat = loc.lat;
            lng = loc.lng;
          } else if (staff.vendor_lat && staff.vendor_lng) {
            lat = parseFloat(staff.vendor_lat);
            lng = parseFloat(staff.vendor_lng);
          }
          if (lat && lng) {
            distance = calculateDistance(customerLat, customerLng, lat, lng);
          }
        }

        providers.push({
          providerId: staff.id,
          providerType: 'staff',
          staffId: staff.id,
          vendorId: staff.vendor_id,
          vendorName: staff.vendor_name,
          name: staff.name,
          phone: staff.phone,
          photo: staff.photo,
          role: staff.role,
          experienceYears: staff.experience_years,
          qualifications: staff.qualifications,
          address: staff.vendor_address,
          city: staff.vendor_city,
          vendorRoleDisplay: staff.vendor_role_display,
          rating: parseFloat(staff.avg_rating || '0').toFixed(1),
          reviewCount: parseInt(staff.review_count || '0', 10),
          distance: distance ? parseFloat(distance.toFixed(2)) : null,
          isVerified: true,
          isIndividualProvider: false,
          services: servicesResult.rows.map(s => ({
            id: s.id,
            serviceId: s.service_id,
            name: s.service_name,
            price: parseFloat(s.price || 0),
            duration: s.duration || 30,
            description: s.description,
            category: s.category,
          })),
        });
      }

      // ========== 3. FALLBACK: Get vendors directly with at_home/tele services (no staff required) ==========
      // ✅ FIX: Some vendors publish at_home/tele services but don't have staff set up
      // Include them as providers so they appear in discovery
      const vendorIdsWithStaff = new Set(providers.map(p => p.vendorId).filter(Boolean));
      
      let vendorFallbackQuery = `
        SELECT DISTINCT ON (v.id)
          v.id as vendor_id,
          v.business_name,
          v.owner_name,
          v.phone,
          v.address,
          v.city,
          v.latitude,
          v.longitude,
          r.name as role_name,
          r.display_name as role_display_name,
          (SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id) as avg_rating,
          (SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id) as review_count
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE v.status = 'approved' 
          AND v.is_active = true
          AND vs.service_style = $1
          AND vs.is_enabled = true
          AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
      `;
      
      const vendorFallbackParams: any[] = [serviceStyle];
      let vendorFallbackParamIdx = 2;

      if (targetRoles.length > 0) {
        // ✅ FIX: Use OR condition to also match role_id if it's in the targetRoles
        vendorFallbackQuery += ` AND (
          r.name = ANY($${vendorFallbackParamIdx}) 
          OR v.role_id::text = ANY($${vendorFallbackParamIdx})
          OR r.display_name = ANY($${vendorFallbackParamIdx})
        )`;
        vendorFallbackParams.push(targetRoles);
        vendorFallbackParamIdx++;
      }

      vendorFallbackQuery += ` ORDER BY v.id, avg_rating DESC NULLS LAST LIMIT 50`;

      console.log(`[Services By Style] Vendor fallback query:`, vendorFallbackQuery.substring(0, 200));
      console.log(`[Services By Style] Vendor fallback params:`, vendorFallbackParams);
      
      const vendorFallbackResult = await query(vendorFallbackQuery, vendorFallbackParams).catch((err) => {
        console.error('[Services By Style] Vendor fallback query error:', err);
        return { rows: [] };
      });
      
      console.log(`[Services By Style] Vendor fallback found ${vendorFallbackResult.rows.length} vendors`);

      for (const vendor of vendorFallbackResult.rows) {
        // Skip vendors that already have staff in providers list
        if (vendorIdsWithStaff.has(vendor.vendor_id)) continue;

        // Get services for this vendor
        const servicesResult = await query(
          `SELECT 
            vs.id,
            vs.service_id,
            vs.price,
            vs.duration_minutes as duration,
            vs.service_name,
            vs.custom_description as description,
            vs.category
           FROM vendor_services vs
           WHERE vs.vendor_id = $1 
             AND vs.service_style = $2
             AND vs.is_enabled = true
             AND (vs.publish_status = 'published' OR vs.publish_status = 'draft')
           ORDER BY vs.price ASC`,
          [vendor.vendor_id, serviceStyle]
        ).catch(() => ({ rows: [] }));

        let distance = null;
        if (customerLat && customerLng && vendor.latitude && vendor.longitude) {
          distance = calculateDistance(customerLat, customerLng, parseFloat(vendor.latitude), parseFloat(vendor.longitude));
        }

        providers.push({
          providerId: vendor.vendor_id,
          providerType: 'vendor',
          vendorId: vendor.vendor_id,
          vendorName: vendor.business_name || vendor.owner_name,
          name: vendor.business_name || vendor.owner_name,
          phone: vendor.phone,
          photo: null,
          role: vendor.role_display_name || vendor.role_name,
          experienceYears: null,
          qualifications: null,
          address: vendor.address,
          city: vendor.city,
          rating: parseFloat(vendor.avg_rating || '0').toFixed(1),
          reviewCount: parseInt(vendor.review_count || '0', 10),
          distance: distance ? parseFloat(distance.toFixed(2)) : null,
          isVerified: true,
          isIndividualProvider: false,
          services: servicesResult.rows.map(s => ({
            id: s.id,
            serviceId: s.service_id,
            name: s.service_name,
            price: parseFloat(s.price || 0),
            duration: s.duration || 30,
            description: s.description,
            category: s.category,
          })),
        });
      }

      // Filter providers with at least one service and sort by distance
      const filteredProviders = providers
        .filter(p => p.services.length > 0)
        .sort((a, b) => {
          // Sort by distance if available, otherwise by rating
          if (a.distance !== null && b.distance !== null) {
            return a.distance - b.distance;
          }
          return parseFloat(b.rating) - parseFloat(a.rating);
        });

      console.log(`[Services By Style] Found ${filteredProviders.length} providers for style=${serviceStyle}, category=${category}`);

      return c.json({
        success: true,
        style: serviceStyle,
        providers: filteredProviders,
        total: filteredProviders.length,
        // Also return as vendors for backward compatibility
        vendors: filteredProviders,
      });
    } catch (error: any) {
      console.error('Error fetching services by style:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });

  /**
   * GET /vendors
   * List vendors by role (for customer app clinic/groomer listing)
   * Query params: role, city, status, limit
   */
  app.get("/vendors", async (c) => {
    try {
      const role = c.req.query('role');
      const city = c.req.query('city');
      const status = c.req.query('status') || 'approved';
      const limit = parseInt(c.req.query('limit') || '50', 10);

      let vendorQuery = `
        SELECT 
          v.id,
          v.business_name,
          v.owner_name,
          v.phone,
          v.address,
          v.city,
          v.latitude,
          v.longitude,
          v.status,
          v.role_id,
          r.name as role_name,
          r.display_name as role_display_name,
          COALESCE(
            (SELECT AVG(rating)::numeric(3,1) FROM reviews WHERE vendor_id = v.id),
            4.5
          ) as avg_rating,
          COALESCE(
            (SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id),
            0
          ) as review_count,
          COALESCE(
            (SELECT COUNT(*) FROM bookings WHERE vendor_id = v.id AND status = 'completed'),
            0
          ) as completed_bookings
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by status
      if (status) {
        vendorQuery += ` AND v.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      // Filter by role name
      if (role) {
        vendorQuery += ` AND (r.name = $${paramIndex} OR r.display_name ILIKE $${paramIndex + 1})`;
        params.push(role, `%${role}%`);
        paramIndex += 2;
      }

      // Filter by city
      if (city) {
        vendorQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      vendorQuery += ` ORDER BY avg_rating DESC, completed_bookings DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await query(vendorQuery, params);

      const vendors = result.rows.map((v: any) => ({
        id: v.id,
        businessName: v.business_name || v.owner_name,
        ownerName: v.owner_name,
        phone: v.phone,
        address: v.address,
        city: v.city,
        latitude: v.latitude,
        longitude: v.longitude,
        status: v.status,
        roleId: v.role_id,
        roleName: v.role_name,
        roleDisplayName: v.role_display_name,
        rating: parseFloat(v.avg_rating || '4.5').toFixed(1),
        reviewCount: parseInt(v.review_count || '0', 10),
        completedBookings: parseInt(v.completed_bookings || '0', 10),
      }));

      return c.json({
        success: true,
        vendors: vendors,
        total: vendors.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendors:', error);
      return c.json({ error: error.message, success: false }, 500);
    }
  });
}

