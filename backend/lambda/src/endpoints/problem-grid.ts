/**
 * ============================================================================
 * PROBLEM GRID ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles problem-based service discovery:
 * - Get all problems for grid display
 * - Get problems by vendor type
 * - Get services by problem
 * - Get vendors by problem
 * - Get trending problems
 * - Track problem searches
 * 
 * Date: 2026-01-12
 * Purpose: Support problem grid navigation in customer app
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

export function registerProblemGridEndpoints(app: Hono) {
  /**
   * GET /vendor/problem-grid/all
   * Get all problems for problem grid navigation
   */
  app.get("/vendor/problem-grid/all", async (c) => {
    try {
      const vendorType = c.req.query('vendorType'); // Optional filter

      let problemsQuery = `
        SELECT DISTINCT
          problem_id,
          problem_name,
          problem_display_name,
          role_id,
          MIN(order_index) as min_order
        FROM problem_grid_mappings
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (vendorType) {
        problemsQuery += ` AND role_id = $${paramIndex}`;
        params.push(vendorType);
        paramIndex++;
      }

      problemsQuery += `
        GROUP BY problem_id, problem_name, problem_display_name, role_id
        ORDER BY min_order ASC, problem_name ASC
      `;

      let problemsResult;
      try {
        problemsResult = await query(problemsQuery, params);
      } catch (dbError: any) {
        console.error('Database query error for problem-grid:', dbError.message);
        // Return empty array if table doesn't exist or query fails
        return c.json({
          success: true,
          problems: [],
          count: 0,
          message: 'Problem grid not yet populated'
        });
      }

      if (!problemsResult.rows || problemsResult.rows.length === 0) {
        // Return default problems if none exist
        return c.json({
          success: true,
          problems: [
            { id: 'health-checkup', name: 'Health Checkup', displayName: 'Health Checkup', icon: '🏥', category: 'vet' },
            { id: 'vaccination', name: 'Vaccination', displayName: 'Vaccination', icon: '💉', category: 'vet' },
            { id: 'grooming', name: 'Grooming', displayName: 'Full Grooming', icon: '✂️', category: 'grooming' },
            { id: 'bath', name: 'Bath', displayName: 'Bath & Clean', icon: '🛁', category: 'grooming' },
            { id: 'training', name: 'Training', displayName: 'Basic Training', icon: '🎓', category: 'training' },
            { id: 'walking', name: 'Walking', displayName: 'Dog Walking', icon: '🐕', category: 'walker' },
          ],
          count: 6,
          message: 'Default problems (no custom mappings yet)'
        });
      }

      // Legacy handling continues below

      // Enrich problems with vendor types and categories
      const problems = await Promise.all(
        problemsResult.rows.map(async (row: any) => {
          // Get all vendor types for this problem
          const vendorTypesResult = await query(
            `SELECT DISTINCT role_id 
             FROM problem_grid_mappings 
             WHERE problem_id = $1`,
            [row.problem_id]
          );

          // Get subcategories for this problem
          const subcategoriesResult = await query(
            `SELECT DISTINCT sub_category_id, sub_category_name 
             FROM problem_grid_mappings 
             WHERE problem_id = $1
             ORDER BY order_index ASC`,
            [row.problem_id]
          );

          return {
            problemId: row.problem_id,
            title: row.problem_display_name || row.problem_name,
            description: `${row.problem_display_name || row.problem_name} services`,
            icon: getProblemIcon(row.problem_id),
            category: getProblemCategory(row.problem_id),
            vendorTypes: vendorTypesResult.rows.map((r: any) => r.role_id),
            subcategories: subcategoriesResult.rows.map((r: any) => ({
              id: r.sub_category_id,
              name: r.sub_category_name,
            })),
          };
        })
      );

      return c.json({
        success: true,
        problems,
        total: problems.length,
      });
    } catch (error: any) {
      console.error('Error fetching problem grid:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/problem-grid/:vendorType
   * Get problems filtered by vendor type
   */
  app.get("/vendor/problem-grid/:vendorType", async (c) => {
    try {
      const { vendorType } = c.req.param();

      const problemsResult = await query(
        `SELECT DISTINCT
          problem_id,
          problem_name,
          problem_display_name,
          MIN(order_index) as min_order
        FROM problem_grid_mappings
        WHERE role_id = $1
        GROUP BY problem_id, problem_name, problem_display_name
        ORDER BY min_order ASC, problem_name ASC`,
        [vendorType]
      );

      const problems = problemsResult.rows.map((row: any) => ({
        problemId: row.problem_id,
        title: row.problem_display_name || row.problem_name,
        description: `${row.problem_display_name || row.problem_name} services`,
        icon: getProblemIcon(row.problem_id),
        category: getProblemCategory(row.problem_id),
        vendorTypes: [vendorType],
      }));

      return c.json({
        success: true,
        problems,
        total: problems.length,
      });
    } catch (error: any) {
      console.error('Error fetching problem grid by vendor type:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/services/by-problem
   * Get services that match a specific problem
   */
  app.get("/customer/services/by-problem", async (c) => {
    try {
      const problemId = c.req.query('problemId');
      const latitude = c.req.query('lat');
      const longitude = c.req.query('lng');

      if (!problemId) {
        return c.json({ error: 'problemId is required' }, 400);
      }

      // Get problem mappings to find relevant subcategories
      const mappingsResult = await query(
        `SELECT DISTINCT sub_category_id, role_id
         FROM problem_grid_mappings
         WHERE problem_id = $1`,
        [problemId]
      );

      if (mappingsResult.rows.length === 0) {
        return c.json({
          success: true,
          services: [],
          total: 0,
        });
      }

      const subCategoryIds = mappingsResult.rows.map((r: any) => r.sub_category_id);
      const roleIds = [...new Set(mappingsResult.rows.map((r: any) => r.role_id))];

      // Get vendors with matching specializations or roles
      let servicesQuery = `
        SELECT DISTINCT
          vs.id as service_id,
          vs.service_name as name,
          vs.description,
          vs.price,
          vs.duration_minutes as duration,
          vs.vendor_id,
          v.business_name as vendor_name,
          COALESCE(AVG(r.rating), 0) as vendor_rating,
          COUNT(DISTINCT r.id) as vendor_reviews,
          v.city,
          v.state
        FROM vendor_services vs
        INNER JOIN vendors v ON vs.vendor_id = v.id
        LEFT JOIN reviews r ON r.vendor_id = v.id AND r.is_approved = true
        WHERE v.status = 'approved' 
          AND v.is_active = true
          AND vs.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Match by subcategory in service name/description or vendor specializations
      if (subCategoryIds.length > 0) {
        servicesQuery += ` AND (
          vs.service_name ILIKE ANY($${paramIndex}::text[]) OR
          vs.description ILIKE ANY($${paramIndex}::text[]) OR
          vs.vendor_id IN (
            SELECT vendor_id 
            FROM vendor_specializations 
            WHERE specialization = ANY($${paramIndex}::text[])
          )
        )`;
        const searchTerms = subCategoryIds.map(id => `%${id}%`);
        params.push(searchTerms);
        paramIndex++;
      }

      // Filter by role if available
      if (roleIds.length > 0) {
        servicesQuery += ` AND v.role_id::text = ANY($${paramIndex}::text[])`;
        params.push(roleIds);
        paramIndex++;
      }

      servicesQuery += `
        GROUP BY vs.id, vs.service_name, vs.description, vs.price, vs.duration_minutes, 
                 vs.vendor_id, v.business_name, v.city, v.state
        ORDER BY vendor_rating DESC, vs.created_at DESC
        LIMIT 50
      `;

      const servicesResult = await query(servicesQuery, params);

      // Calculate distance if location provided
      let services = servicesResult.rows.map((service: any) => {
        const serviceData: any = {
          serviceId: service.service_id,
          name: service.name,
          description: service.description,
          price: parseFloat(service.price || '0'),
          duration: parseInt(service.duration || '0'),
          vendorId: service.vendor_id,
          vendorName: service.vendor_name,
          vendorRating: parseFloat(service.vendor_rating || '0'),
          vendorReviews: parseInt(service.vendor_reviews || '0'),
          distance: null as number | null,
          relevanceScore: 1.0, // Default relevance
        };

        // Calculate distance if coordinates available
        if (latitude && longitude && service.latitude && service.longitude) {
          serviceData.distance = calculateDistance(
            parseFloat(latitude),
            parseFloat(longitude),
            parseFloat(service.latitude),
            parseFloat(longitude)
          );
        }

        return serviceData;
      });

      // Sort by relevance (rating + distance if available)
      services.sort((a: any, b: any) => {
        const aScore = a.vendorRating * 0.7 + (a.distance ? (1 / (a.distance + 1)) * 0.3 : 0);
        const bScore = b.vendorRating * 0.7 + (b.distance ? (1 / (b.distance + 1)) * 0.3 : 0);
        return bScore - aScore;
      });

      return c.json({
        success: true,
        services,
        total: services.length,
        problemId,
      });
    } catch (error: any) {
      console.error('Error fetching services by problem:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/vendors/by-problem
   * Get vendors that can solve a specific problem
   */
  app.get("/customer/vendors/by-problem", async (c) => {
    try {
      const problemId = c.req.query('problemId');
      const latitude = c.req.query('lat');
      const longitude = c.req.query('lng');

      if (!problemId) {
        return c.json({ error: 'problemId is required' }, 400);
      }

      // Get problem mappings
      const mappingsResult = await query(
        `SELECT DISTINCT sub_category_id, role_id
         FROM problem_grid_mappings
         WHERE problem_id = $1`,
        [problemId]
      );

      if (mappingsResult.rows.length === 0) {
        return c.json({
          success: true,
          vendors: [],
          total: 0,
        });
      }

      const subCategoryIds = mappingsResult.rows.map((r: any) => r.sub_category_id);
      const roleIds = [...new Set(mappingsResult.rows.map((r: any) => r.role_id))];

      // Get vendors with matching specializations or roles
      let vendorsQuery = `
        SELECT DISTINCT
          v.*,
          r.name as role_name,
          r.display_name as role_display_name,
          COALESCE(AVG(rev.rating), 0) as avg_rating,
          COUNT(DISTINCT rev.id) as total_reviews,
          COUNT(DISTINCT b.id) as total_bookings
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        LEFT JOIN reviews rev ON rev.vendor_id = v.id AND rev.is_approved = true
        LEFT JOIN bookings b ON b.vendor_id = v.id AND b.status = 'completed'
        WHERE v.status = 'approved' 
          AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Match by role
      if (roleIds.length > 0) {
        vendorsQuery += ` AND (r.id::text = ANY($${paramIndex}::text[]) OR r.name = ANY($${paramIndex + 1}::text[]))`;
        params.push(roleIds, roleIds);
        paramIndex += 2;
      }

      // Match by specialization
      if (subCategoryIds.length > 0) {
        vendorsQuery += ` AND v.id IN (
          SELECT vendor_id 
          FROM vendor_specializations 
          WHERE specialization = ANY($${paramIndex}::text[])
        )`;
        params.push(subCategoryIds);
        paramIndex++;
      }

      vendorsQuery += `
        GROUP BY v.id, r.name, r.display_name
        ORDER BY avg_rating DESC, total_bookings DESC
        LIMIT 50
      `;

      const vendorsResult = await query(vendorsQuery, params);

      // Enrich vendors with distance and services
      const vendors = await Promise.all(
        vendorsResult.rows.map(async (vendor: any) => {
          // Get services for this vendor
          const servicesResult = await query(
            `SELECT id, service_name, price, duration_minutes
             FROM vendor_services
             WHERE vendor_id = $1 AND is_active = true
             LIMIT 5`,
            [vendor.id]
          );

          const vendorData: any = {
            id: vendor.id,
            name: vendor.business_name,
            ownerName: vendor.owner_name,
            role: vendor.role_name,
            roleDisplayName: vendor.role_display_name,
            city: vendor.city,
            state: vendor.state,
            address: vendor.address,
            rating: parseFloat(vendor.avg_rating || '0'),
            reviews: parseInt(vendor.total_reviews || '0'),
            bookings: parseInt(vendor.total_bookings || '0'),
            services: servicesResult.rows.map((s: any) => ({
              id: s.id,
              name: s.service_name,
              price: parseFloat(s.price || '0'),
              duration: parseInt(s.duration_minutes || '0'),
            })),
            distance: null as number | null,
          };

          // Calculate distance
          if (latitude && longitude && vendor.latitude && vendor.longitude) {
            vendorData.distance = calculateDistance(
              parseFloat(latitude),
              parseFloat(longitude),
              parseFloat(vendor.latitude),
              parseFloat(vendor.longitude)
            );
          }

          return vendorData;
        })
      );

      // Sort by rating and distance
      vendors.sort((a: any, b: any) => {
        const aScore = a.rating * 0.7 + (a.distance ? (1 / (a.distance + 1)) * 0.3 : 0);
        const bScore = b.rating * 0.7 + (b.distance ? (1 / (b.distance + 1)) * 0.3 : 0);
        return bScore - aScore;
      });

      return c.json({
        success: true,
        vendors,
        total: vendors.length,
        problemId,
      });
    } catch (error: any) {
      console.error('Error fetching vendors by problem:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/problems/trending
   * Get trending problems based on search/booking activity
   */
  app.get("/customer/problems/trending", async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '10', 10);

      // Get trending problems from search_index or booking activity
      // For now, return problems with most vendor specializations
      const trendingResult = await query(
        `SELECT 
          pgm.problem_id,
          pgm.problem_name,
          pgm.problem_display_name,
          COUNT(DISTINCT vs.vendor_id) as vendor_count,
          COUNT(DISTINCT b.id) as booking_count
        FROM problem_grid_mappings pgm
        LEFT JOIN vendor_specializations vs ON vs.specialization = pgm.problem_id
        LEFT JOIN bookings b ON b.service_id IN (
          SELECT id FROM vendor_services WHERE vendor_id = vs.vendor_id
        ) AND b.status = 'completed'
        WHERE pgm.problem_id IS NOT NULL
        GROUP BY pgm.problem_id, pgm.problem_name, pgm.problem_display_name
        ORDER BY booking_count DESC, vendor_count DESC
        LIMIT $1`,
        [limit]
      );

      const trending = trendingResult.rows.map((row: any) => row.problem_id);

      return c.json({
        success: true,
        trending,
        total: trending.length,
      });
    } catch (error: any) {
      console.error('Error fetching trending problems:', error);
      // Return empty array on error (non-critical)
      return c.json({
        success: true,
        trending: [],
        total: 0,
      });
    }
  });

  /**
   * POST /customer/search/track
   * Track problem searches for analytics
   */
  app.post("/customer/search/track", async (c) => {
    try {
      const body = await c.req.json();
      const { customerId, query: searchQuery, type } = body;

      // Log search to database (if search_tracking table exists)
      try {
        await query(
          `INSERT INTO search_tracking (customer_id, query, query_type, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT DO NOTHING`,
          [customerId || 'guest', searchQuery, type || 'problem']
        );
      } catch (dbError) {
        // Silently fail - tracking is not critical
        console.warn('Search tracking failed (table may not exist):', dbError);
      }

      return c.json({
        success: true,
        message: 'Search tracked',
      });
    } catch (error: any) {
      // Silently fail - tracking is not critical
      return c.json({
        success: true,
        message: 'Search tracking failed (non-critical)',
      });
    }
  });
}

/**
 * Helper: Get problem icon based on problem ID
 */
function getProblemIcon(problemId: string): string {
  const iconMap: Record<string, string> = {
    'surgery': 'stethoscope',
    'dermatology': 'stethoscope',
    'dentistry': 'stethoscope',
    'ophthalmology': 'stethoscope',
    'cardiology': 'stethoscope',
    'neurology': 'stethoscope',
    'medicine': 'stethoscope',
    'emergency': 'stethoscope',
    'orthopedic': 'stethoscope',
    'physiotherapy': 'stethoscope',
    'full_grooming': 'scissors',
    'bath_only': 'scissors',
    'haircut_styling': 'scissors',
    'nail_care': 'scissors',
    'deshedding': 'scissors',
    'spa_treatment': 'scissors',
    'basic_obedience': 'graduation-cap',
    'potty_training': 'graduation-cap',
    'socialization': 'graduation-cap',
    'aggression': 'heart',
    'advanced_training': 'graduation-cap',
    'leash_training': 'graduation-cap',
    'daily_walk': 'home',
    'puppy_walk': 'home',
    'senior_walk': 'home',
    'multiple_dogs': 'home',
    'long_walk': 'home',
    'separation_anxiety': 'heart',
    'barking': 'heart',
    'destructive': 'heart',
    'fear_phobia': 'heart',
    'resource_guarding': 'heart',
    'short_stay': 'home',
    'long_stay': 'home',
    'daycare': 'home',
    'luxury_boarding': 'home',
    'medical_boarding': 'home',
    'weight_management': 'bone',
    'allergies_sensitivities': 'bone',
    'digestive_issues': 'bone',
    'puppy_kitten_nutrition': 'bone',
    'senior_nutrition': 'bone',
    'medical_conditions': 'bone',
    'raw_fresh_food': 'bone',
    'performance_nutrition': 'bone',
  };

  return iconMap[problemId] || 'stethoscope';
}

/**
 * Helper: Get problem category
 */
function getProblemCategory(problemId: string): string {
  if (problemId.includes('grooming') || problemId.includes('bath') || problemId.includes('nail')) {
    return 'grooming';
  }
  if (problemId.includes('training') || problemId.includes('obedience') || problemId.includes('socialization')) {
    return 'training';
  }
  if (problemId.includes('walk') || problemId.includes('walker')) {
    return 'walking';
  }
  if (problemId.includes('boarding') || problemId.includes('stay') || problemId.includes('daycare')) {
    return 'boarding';
  }
  if (problemId.includes('nutrition') || problemId.includes('diet') || problemId.includes('food')) {
    return 'nutrition';
  }
  if (problemId.includes('anxiety') || problemId.includes('barking') || problemId.includes('behavior')) {
    return 'behavioral';
  }
  return 'veterinary';
}

/**
 * Helper: Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}
