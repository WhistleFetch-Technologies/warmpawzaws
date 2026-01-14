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
import { select, query } from '../database/rds-connection';

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
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by category (role)
      if (category) {
        const categoryRoleMap: Record<string, string[]> = {
          'vet': ['vet_clinic', 'veterinarian'],
          'grooming': ['grooming_salon', 'pet_groomer', 'groomer'],
          'training': ['trainer', 'pet_trainer'],
          'walker': ['dog_walker', 'pet_walker'],
          'boarding': ['boarding_resort', 'pet_boarding'],
          'nutrition': ['nutritionist'],
          'adoption': ['ngo', 'shelter', 'breeder'],
          'marketplace': ['pet_store'],
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
   * GET /customer/discover-services
   * Main customer entry point for service discovery
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

      // Build vendor query
      let vendorQuery = `
        SELECT v.*, r.name as role_name, r.display_name as role_display_name
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by category (role)
      if (category) {
        const categoryRoleMap: Record<string, string[]> = {
          'vet': ['vet_clinic', 'veterinarian'],
          'grooming': ['grooming_salon', 'pet_groomer', 'groomer'],
          'training': ['trainer', 'pet_trainer'],
          'walker': ['dog_walker', 'pet_walker'],
          'boarding': ['boarding_resort', 'pet_boarding'],
          'nutrition': ['nutritionist'],
          'adoption': ['ngo', 'shelter', 'breeder'],
          'marketplace': ['pet_store'],
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
          // Get services
          const services = await query(
            `SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled
             FROM services s
             LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
             WHERE vs.vendor_id = $1
             AND s.is_active = true
             AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
             LIMIT 10`,
            [vendor.id]
          );

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
              serviceStyle: s.service_style,
              category: s.category,
            })),
            availabilityScore: isAvailableToday ? 100 : 0,
            isAvailableToday,
            distance,
            phone: vendor.phone,
            email: vendor.email,
            operatingHours: vendor.operating_hours ? JSON.parse(vendor.operating_hours) : null,
          };
        })
      );

      // Filter by rating
      if (minRating) {
        enrichedVendors.filter((v: any) => v.rating >= parseFloat(minRating));
      }

      // Sort
      if (sortBy === 'distance' && latitude && longitude) {
        enrichedVendors.sort((a: any, b: any) => {
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
      } else if (sortBy === 'rating') {
        enrichedVendors.sort((a: any, b: any) => b.rating - a.rating);
      } else if (sortBy === 'price') {
        enrichedVendors.sort((a: any, b: any) => {
          const aPrice = a.featuredOfferings[0]?.price || 0;
          const bPrice = b.featuredOfferings[0]?.price || 0;
          return aPrice - bPrice;
        });
      }

      return c.json({
        success: true,
        vendors: enrichedVendors,
        total: enrichedVendors.length,
        filters: {
          category,
          location,
          minRating,
          availability,
          petType,
          sortBy,
        },
      });
    } catch (error: any) {
      console.error('Error discovering services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/vendor/:vendorId
   * Get detailed vendor profile with all services
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

      // Get vendor
      const vendors = await select('vendors', { id: vendorId });
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
        [vendorId]
      );

      // Get rating
      const ratingResult = await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
         FROM reviews
         WHERE vendor_id = $1 AND is_approved = true`,
        [vendorId]
      );

      // Get recent reviews
      const recentReviews = await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1 AND r.is_approved = true
         ORDER BY r.created_at DESC
         LIMIT 5`,
        [vendorId]
      );

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
        },
        facility: {
          address: vendor.address,
          city: vendor.city,
          state: vendor.state,
          pincode: vendor.pincode,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
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
}

