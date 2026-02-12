/**
 * ============================================================================
 * SPECIALIZED SERVICES ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles special configuration requirements for different vendor types:
 * - Ambulance: Vehicle fleet, drivers
 * - Diagnostics: Test catalog, equipment
 * - Pharmacy: Medicine inventory
 * - Nutritionist: Meal plans
 * - Cafe: Tables, PAX capacity
 * - Breeder/Adoption: Puppy/Pet profiles
 * - Pet Resort/Boarding: Room configuration, pricing
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { checkVendorCapability } from '../middleware/capability-enforcement';
import { resolveVendorById } from './vendor-profile';
import { resolveVendorId } from '../utils/vendor-resolve';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { getDiscoveryRules } from '../lib/rule-engine';

export function registerSpecializedServicesEndpoints(app: Hono) {
  // ============================================
  // CUSTOMER-FACING DISCOVERY ENDPOINTS (PUBLIC)
  // ============================================

  /**
   * GET /discover/meal-plans
   * Customer-facing: Discover available meal plans
   * Public endpoint - no capability check
   */
  app.get("/discover/meal-plans", async (c) => {
    try {
      const city = c.req.query('city');
      const petType = c.req.query('petType');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let mealPlanQuery = `
        SELECT mp.*, v.business_name as vendor_name, v.city as vendor_city, v.rating as vendor_rating
        FROM meal_plans mp
        INNER JOIN vendors v ON mp.vendor_id = v.id
        WHERE mp.is_active = true
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (city) {
        mealPlanQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      mealPlanQuery += ` ORDER BY v.rating DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const mealPlans = await query(mealPlanQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        mealPlans: mealPlans.rows,
        total: mealPlans.rows.length,
      });
    } catch (error: any) {
      console.error('Error discovering meal plans:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /discover/training-programs
   * Customer-facing: Discover available training programs
   * Public endpoint - no capability check
   */
  /**
   * GET /public/diagnostics/categories
   * Diagnostic test categories/specializations for vendor test creation and customer filter.
   * Sourced from service_catalog (diagnostics) + "Other". Admin Catalog & Service updates flow here.
   */
  app.get("/public/diagnostics/categories", async (c) => {
    try {
      const rows = await query(`
        SELECT DISTINCT COALESCE(sc.category_name, sc.category_id, '') AS id,
               COALESCE(sc.category_name, sc.category_id, 'Other') AS name
        FROM service_catalog sc
        WHERE (sc.status = 'active' OR sc.status IS NULL)
          AND (sc.category_id = 'diagnostic'
               OR 'diagnostics_center' = ANY(COALESCE(sc.applicable_roles, ARRAY[]::text[]))
               OR 'diagnostic_center' = ANY(COALESCE(sc.applicable_roles, ARRAY[]::text[]))
               OR LOWER(COALESCE(sc.category_name, '')) LIKE '%diagnostic%'
               OR LOWER(COALESCE(sc.category_name, '')) LIKE '%lab%'
               OR LOWER(COALESCE(sc.category_name, '')) IN ('blood tests', 'imaging', 'allergy', 'hormone', 'urine', 'stool', 'biopsy'))
        ORDER BY name
      `).catch(() => ({ rows: [] }));
      const list = (rows.rows || []).map((r: any) => ({ id: (r.id || '').toLowerCase().replace(/\s+/g, '_'), name: r.name || r.id }));
      const seen = new Set(list.map((x: any) => x.id));
      if (!seen.has('blood') && !seen.has('blood_test')) {
        list.unshift({ id: 'blood', name: 'Blood Test' });
      }
      if (!seen.has('other')) {
        list.push({ id: 'other', name: 'Other' });
      }
      return c.json({ success: true, categories: list });
    } catch (error: any) {
      console.error('Error fetching diagnostics categories:', error);
      return c.json({
        success: true,
        categories: [
          { id: 'blood', name: 'Blood Test' },
          { id: 'urine', name: 'Urine Test' },
          { id: 'stool', name: 'Stool Test' },
          { id: 'imaging', name: 'Imaging' },
          { id: 'biopsy', name: 'Biopsy' },
          { id: 'allergy', name: 'Allergy Tests' },
          { id: 'hormone', name: 'Hormone Tests' },
          { id: 'other', name: 'Other' },
        ],
      });
    }
  });

  app.get("/discover/training-programs", async (c) => {
    try {
      const city = c.req.query('city');
      const skillLevel = c.req.query('skillLevel');
      const category = c.req.query('category');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let programQuery = `
        SELECT tp.*, v.business_name as vendor_name, v.city as vendor_city, v.rating as vendor_rating
        FROM training_programs tp
        INNER JOIN vendors v ON tp.vendor_id = v.id
        WHERE tp.is_active = true
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (city) {
        programQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      if (skillLevel) {
        programQuery += ` AND tp.skill_level = $${paramIndex}`;
        params.push(skillLevel);
        paramIndex++;
      }

      if (category) {
        programQuery += ` AND tp.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      programQuery += ` ORDER BY v.rating DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const programs = await query(programQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        programs: programs.rows,
        total: programs.rows.length,
      });
    } catch (error: any) {
      console.error('Error discovering training programs:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /discover/holiday-packages
   * Customer-facing: Discover available holiday packages
   * Public endpoint - no capability check
   */
  app.get("/discover/holiday-packages", async (c) => {
    try {
      const destination = c.req.query('destination');
      const maxDays = c.req.query('maxDays');
      const maxPrice = c.req.query('maxPrice');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let packageQuery = `
        SELECT hp.*, v.business_name as vendor_name, v.city as vendor_city, v.rating as vendor_rating
        FROM holiday_packages hp
        INNER JOIN vendors v ON hp.vendor_id = v.id
        WHERE hp.is_active = true
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (destination) {
        packageQuery += ` AND hp.destination ILIKE $${paramIndex}`;
        params.push(`%${destination}%`);
        paramIndex++;
      }

      if (maxDays) {
        packageQuery += ` AND hp.duration_days <= $${paramIndex}`;
        params.push(parseInt(maxDays, 10));
        paramIndex++;
      }

      if (maxPrice) {
        packageQuery += ` AND hp.price <= $${paramIndex}`;
        params.push(parseFloat(maxPrice));
        paramIndex++;
      }

      packageQuery += ` ORDER BY hp.next_departure ASC NULLS LAST, v.rating DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const packages = await query(packageQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        packages: packages.rows,
        total: packages.rows.length,
      });
    } catch (error: any) {
      console.error('Error discovering holiday packages:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /discover/adoption-pets
   * Customer-facing: Discover pets available for adoption
   * Public endpoint - no capability check
   */
  app.get("/discover/adoption-pets", async (c) => {
    try {
      const city = c.req.query('city');
      const petType = c.req.query('petType');
      const breed = c.req.query('breed');
      const gender = c.req.query('gender');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let petQuery = `
        SELECT p.*, v.business_name as vendor_name, v.city as vendor_city
        FROM pets p
        INNER JOIN vendors v ON p.vendor_id = v.id
        WHERE p.listing_type IN ('adoption', 'breeding')
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (city) {
        petQuery += ` AND (v.city ILIKE $${paramIndex} OR p.location_city ILIKE $${paramIndex})`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      if (petType) {
        petQuery += ` AND p.pet_type = $${paramIndex}`;
        params.push(petType);
        paramIndex++;
      }

      if (breed) {
        petQuery += ` AND p.breed ILIKE $${paramIndex}`;
        params.push(`%${breed}%`);
        paramIndex++;
      }

      if (gender) {
        petQuery += ` AND p.gender = $${paramIndex}`;
        params.push(gender);
        paramIndex++;
      }

      petQuery += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const pets = await query(petQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        pets: pets.rows,
        total: pets.rows.length,
      });
    } catch (error: any) {
      console.error('Error discovering adoption pets:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /discover/boarding-rooms
   * Customer-facing: Discover available boarding rooms
   * Public endpoint - no capability check
   */
  app.get("/discover/boarding-rooms", async (c) => {
    try {
      const city = c.req.query('city');
      const roomType = c.req.query('roomType');
      const checkInDate = c.req.query('checkInDate');
      const checkOutDate = c.req.query('checkOutDate');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let roomQuery = `
        SELECT br.*, v.business_name as vendor_name, v.city as vendor_city, v.rating as vendor_rating
        FROM boarding_rooms br
        INNER JOIN vendors v ON br.vendor_id = v.id
        WHERE br.is_available = true
        AND v.status = 'approved'
        AND v.is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (city) {
        roomQuery += ` AND v.city ILIKE $${paramIndex}`;
        params.push(`%${city}%`);
        paramIndex++;
      }

      if (roomType) {
        roomQuery += ` AND br.room_type = $${paramIndex}`;
        params.push(roomType);
        paramIndex++;
      }

      roomQuery += ` ORDER BY v.rating DESC NULLS LAST, br.price_per_night ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const rooms = await query(roomQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        rooms: rooms.rows,
        total: rooms.rows.length,
      });
    } catch (error: any) {
      console.error('Error discovering boarding rooms:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // AMBULANCE: VEHICLE FLEET MANAGEMENT
  // ============================================

  /**
   * GET /vendor/:vendorId/ambulance/vehicles
   * Get all vehicles for an ambulance service
   * Requires 'ambulance' capability
   */
  app.get("/vendor/:vendorId/ambulance/vehicles", async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      
      // Check if vendor has ambulance capability
      const hasAmbulanceCapability = await checkVendorCapability(vendorId, 'ambulance');
      if (!hasAmbulanceCapability) {
        return c.json({ error: 'Vendor does not have ambulance capability' }, 403);
      }
      
      const vehicles = await select('ambulance_vehicles', 
        { vendor_id: vendorId },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );
      
      return c.json({ success: true, vehicles, total: vehicles.length });
    } catch (error: any) {
      console.error('Error fetching ambulance vehicles:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/ambulance/vehicles
   * Add a new vehicle
   * Requires 'ambulance' capability
   */
  app.post("/vendor/:vendorId/ambulance/vehicles", async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      
      // Check if vendor has ambulance capability
      const hasAmbulanceCapability = await checkVendorCapability(vendorId, 'ambulance');
      if (!hasAmbulanceCapability) {
        return c.json({ error: 'Vendor does not have ambulance capability' }, 403);
      }
      
      const vehicleData = await c.req.json();
      
      const vehicle = await insert('ambulance_vehicles', {
        vendor_id: vendorId,
        vehicle_number: vehicleData.vehicleNumber || vehicleData.vehicle_number || `VEH-${Date.now()}`,
        vehicle_type: vehicleData.vehicleType || vehicleData.vehicle_type || 'basic',
        capacity: vehicleData.capacity || 2,
        equipment: vehicleData.equipment || [],
        current_location: vehicleData.currentLocation || vehicleData.current_location || null,
        is_available: vehicleData.isAvailable !== false,
        rating: 5.0,
        total_trips: 0,
      });
      
      return c.json({ success: true, vehicle: vehicle[0], message: 'Vehicle added successfully' });
    } catch (error: any) {
      console.error('Error adding ambulance vehicle:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/ambulance/vehicles/:vehicleId
   * Update vehicle details
   * Requires 'ambulance' capability
   */
  app.put("/vendor/:vendorId/ambulance/vehicles/:vehicleId", async (c) => {
    try {
      const p = c.req.param();
      const vendorId = await resolveVendorId(p.vendorId);
      const vehicleId = p.vehicleId;
      
      // Check if vendor has ambulance capability
      const hasAmbulanceCapability = await checkVendorCapability(vendorId, 'ambulance');
      if (!hasAmbulanceCapability) {
        return c.json({ error: 'Vendor does not have ambulance capability' }, 403);
      }
      
      const vehicleData = await c.req.json();
      
      const updated = await update('ambulance_vehicles', 
        { id: vehicleId },
        {
          vehicle_type: vehicleData.vehicleType || vehicleData.vehicle_type,
          capacity: vehicleData.capacity,
          equipment: vehicleData.equipment,
          current_location: vehicleData.currentLocation || vehicleData.current_location,
          is_available: vehicleData.isAvailable,
          rating: vehicleData.rating,
          total_trips: vehicleData.totalTrips || vehicleData.total_trips,
        }
      );
      
      if (updated.length === 0) {
        return c.json({ error: 'Vehicle not found' }, 404);
      }
      
      return c.json({ success: true, vehicle: updated[0], message: 'Vehicle updated successfully' });
    } catch (error: any) {
      console.error('Error updating ambulance vehicle:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // DIAGNOSTICS: TEST CATALOG
  // ============================================

  /**
   * GET /vendor/:vendorId/diagnostics/tests
   * Get all diagnostic tests offered by this center.
   * Requires diagnostics capability (diagnostics, diagnostic_results, test_catalog, or diagnostic_lab).
   * Optional query publishedOnly=true returns only is_available=true (for customer booking flow).
   */
  app.get("/vendor/:vendorId/diagnostics/tests", async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) return c.json({ error: 'Vendor not found' }, 404);
      const actualVendorId = vendor.id;
      const publishedOnly = c.req.query('publishedOnly') === 'true';

      // Check if vendor has diagnostics capability (include diagnostic_lab for vet clinics; 'diagnostic lab' with space for admin-stored display name)
      const hasDiagnosticsCapability = await checkVendorCapability(vendorId, 'diagnostic_results') ||
                                       await checkVendorCapability(vendorId, 'diagnostics') ||
                                       await checkVendorCapability(vendorId, 'test_catalog') ||
                                       await checkVendorCapability(vendorId, 'diagnostic_lab') ||
                                       await checkVendorCapability(vendorId, 'diagnostic lab');
      if (!hasDiagnosticsCapability) {
        return c.json({ error: 'Vendor does not have diagnostics capability' }, 403);
      }

      // ✅ FIX: Use actualVendorId (resolved vendors.id) - POST saves with actualVendorId, so GET must query same.
      // Raw vendorId can be vendor_identity.id for old vendors; diagnostic_tests.vendor_id = vendors.id.
      const filter: Record<string, any> = { vendor_id: actualVendorId };
      if (publishedOnly) {
        filter.is_available = true;
      }
      const rows = await select('diagnostic_tests',
        filter,
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );
      // Normalize: some DBs use test_category (migration 057), frontend expects category
      const tests = rows.map((r: any) => ({
        ...r,
        category: r.category ?? r.test_category,
      }));

      return c.json({ success: true, tests, total: tests.length });
    } catch (error: any) {
      console.error('Error fetching diagnostic tests:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/diagnostics/vendors-with-tests
   * Discovery: vendors with published diagnostic tests (diagnostics centers + vet clinics with lab tests enabled).
   * Includes: diagnostics_center, diagnostic_center, and vet_clinic/veterinary_clinic/vet with diagnostics capability.
   * Only vendors that have at least one published (is_available = true) test are returned.
   */
  app.get("/customer/diagnostics/vendors-with-tests", async (c) => {
    try {
      const category = c.req.query('category');
      const serviceStyle = c.req.query('serviceStyle');
      const lat = c.req.query('lat') ? parseFloat(c.req.query('lat')!) : null;
      const lng = c.req.query('lng') ? parseFloat(c.req.query('lng')!) : null;
      const maxDistance = c.req.query('maxDistance') ? parseFloat(c.req.query('maxDistance')!) : 50;

      let vendorQuery = `
        SELECT v.id, v.business_name, v.city, v.state, v.address, v.latitude, v.longitude, v.rating
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved' AND v.is_active = true
          AND (
            (LOWER(r.name) IN ('diagnostics_center', 'diagnostic_center'))
            OR (
              (
                LOWER(r.name) IN ('vet_clinic', 'veterinary_clinic', 'vet')
                OR (LOWER(TRIM(r.name)) LIKE '%vet%' AND LOWER(TRIM(r.name)) LIKE '%clinic%')
                OR LOWER(REPLACE(TRIM(r.name), ' ', '_')) IN ('vet_clinic', 'veterinary_clinic')
              )
              AND EXISTS (
                SELECT 1 FROM role_permissions rp
                WHERE rp.role_id = v.role_id
                AND (
                  LOWER(rp.permission_name) IN ('diagnostics', 'diagnostic_results', 'test_catalog', 'diagnostic_lab')
                  OR REPLACE(LOWER(TRIM(rp.permission_name)), ' ', '_') = 'diagnostic_lab'
                )
              )
            )
          )
          AND EXISTS (
            SELECT 1 FROM diagnostic_tests dt
            WHERE dt.vendor_id = v.id AND dt.is_available = true
          )
      `;
      const vendorParams: any[] = [];
      let pi = 1;
      if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        vendorQuery += `
          AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
          AND (6371 * acos(cos(radians($${pi})) * cos(radians(CAST(v.latitude AS FLOAT))) * cos(radians(CAST(v.longitude AS FLOAT)) - radians($${pi + 1})) + sin(radians($${pi})) * sin(radians(CAST(v.latitude AS FLOAT))))) <= $${pi + 2}
        `;
        vendorParams.push(lat, lng, maxDistance);
        pi += 3;
      }
      vendorQuery += ` ORDER BY v.business_name`;
      const vendorsResult = await query(vendorQuery, vendorParams);
      const vendors = vendorsResult.rows || [];

      const out: any[] = [];
      for (const v of vendors) {
        let testQuery = `
          SELECT id, test_name, price, duration_minutes,
                 COALESCE(category, test_category) AS category,
                 COALESCE(service_style, 'at_center') AS service_style,
                 is_free_home_collection, home_collection_fee
          FROM diagnostic_tests
          WHERE vendor_id = $1 AND is_available = true
        `;
        const testParams: any[] = [v.id];
        let ti = 2;
        if (category) {
          testQuery += ` AND (LOWER(COALESCE(category, test_category, '')) = LOWER($${ti}) OR COALESCE(category, test_category, '') ILIKE $${ti + 1})`;
          testParams.push(category, `%${category}%`);
          ti += 2;
        }
        if (serviceStyle) {
          testQuery += ` AND COALESCE(service_style, 'at_center') = $${ti}`;
          testParams.push(serviceStyle);
        }
        testQuery += ` ORDER BY test_name`;
        const testsResult = await query(testQuery, testParams);
        const tests = (testsResult.rows || []).map((t: any) => ({
          id: t.id,
          test_name: t.test_name,
          price: parseFloat(t.price) || 0,
          duration_minutes: t.duration_minutes,
          category: t.category,
          service_style: t.service_style,
          is_free_home_collection: t.is_free_home_collection,
          home_collection_fee: t.home_collection_fee,
        }));
        if (tests.length === 0 && (category || serviceStyle)) continue;
        const distanceKm = (v.latitude != null && v.longitude != null && lat != null && lng != null)
          ? (6371 * Math.acos(
              Math.cos(lat * Math.PI / 180) * Math.cos(Number(v.latitude) * Math.PI / 180) *
              Math.cos(Number(v.longitude) * Math.PI / 180 - lng * Math.PI / 180) +
              Math.sin(lat * Math.PI / 180) * Math.sin(Number(v.latitude) * Math.PI / 180)
            ))
          : null;
        out.push({
          id: v.id,
          businessName: v.business_name,
          city: v.city,
          state: v.state,
          address: v.address,
          latitude: v.latitude,
          longitude: v.longitude,
          rating: v.rating,
          distance: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
          homeCollectionAvailable: tests.some((t: any) => t.service_style === 'at_home'),
          tests,
        });
      }

      return c.json({ success: true, vendors: out });
    } catch (error: any) {
      console.error('Error fetching diagnostics vendors-with-tests:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/diagnostics/tests
   * Add a new diagnostic test
   * Requires diagnostics capability (diagnostics, diagnostic_results, test_catalog, or diagnostic_lab)
   */
  app.post("/vendor/:vendorId/diagnostics/tests", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) return c.json({ error: 'Vendor not found' }, 404);
      const actualVendorId = vendor.id;

      const hasDiagnosticsCapability = await checkVendorCapability(vendorId, 'diagnostic_results') ||
                                       await checkVendorCapability(vendorId, 'diagnostics') ||
                                       await checkVendorCapability(vendorId, 'test_catalog') ||
                                       await checkVendorCapability(vendorId, 'diagnostic_lab') ||
                                       await checkVendorCapability(vendorId, 'diagnostic lab');
      if (!hasDiagnosticsCapability) {
        return c.json({ error: 'Vendor does not have diagnostics capability' }, 403);
      }

      const testData = await c.req.json();

      // ✅ FIX: Use raw SQL with only guaranteed columns first, then try with extended columns
      // This handles the case where migration 503 hasn't been run yet
      try {
        // First try with all columns (if migration has been applied)
        const categoryVal = testData.category === 'other' && (testData.otherCategoryName || testData.other_category_name)
          ? (testData.otherCategoryName || testData.other_category_name)
          : (testData.category || testData.test_category);
        const test = await insert('diagnostic_tests', {
          vendor_id: actualVendorId,
          test_name: testData.testName || testData.test_name || testData.name,
          test_code: testData.testCode || testData.test_code,
          category: categoryVal,
          description: testData.description,
          price: testData.price,
          duration_minutes: testData.durationMinutes || testData.duration_minutes,
          sample_type: testData.sampleType || testData.sample_type,
          preparation_instructions: testData.preparationInstructions || testData.preparation_instructions,
          is_available: testData.isAvailable !== false,
          service_style: testData.serviceStyle || testData.service_style || 'at_center',
          // Extended fields (may not exist if migration not applied)
          is_free_home_collection: testData.isFreeHomeCollection || testData.is_free_home_collection || false,
          home_collection_fee: testData.homeCollectionFee || testData.home_collection_fee || 0,
          terms_conditions: testData.termsConditions || testData.terms_conditions,
          turnaround_time_hours: testData.turnaroundTimeHours || testData.turnaround_time_hours,
          is_package_available: testData.isPackageAvailable || testData.is_package_available || false,
          package_price: testData.packagePrice || testData.package_price,
          package_test_count: testData.packageTestCount || testData.package_test_count,
        });
        
        return c.json({ success: true, test: test[0], message: 'Diagnostic test added successfully' });
      } catch (insertError: any) {
        // ✅ FIX: If column doesn't exist error, retry with schema-aware fallback
        // Migration 057 uses test_category; 021 uses category. Some DBs have 057 schema.
        if (insertError.message?.includes('column') && insertError.message?.includes('does not exist')) {
          console.warn('⚠️ Column mismatch, retrying with schema-aware insert. Error:', insertError.message);
          
          // Try with test_category (057 schema) - minimal columns that exist in 057
          try {
            const categoryVal = testData.category === 'other' && (testData.otherCategoryName || testData.other_category_name)
              ? (testData.otherCategoryName || testData.other_category_name)
              : (testData.category || testData.test_category);
            const testCore = await insert('diagnostic_tests', {
              vendor_id: actualVendorId,
              test_name: testData.testName || testData.test_name || testData.name,
              test_category: categoryVal,
              description: testData.description,
              price: testData.price,
              duration_minutes: testData.durationMinutes || testData.duration_minutes,
              is_available: testData.isAvailable !== false,
            });
            const row = testCore[0] as any;
            // Normalize response to use category for frontend
            if (row && row.test_category != null && row.category == null) {
              row.category = row.test_category;
            }
            return c.json({ 
              success: true, 
              test: row, 
              message: 'Diagnostic test added successfully'
            });
          } catch (fallbackError: any) {
            // Last resort: absolute minimal insert (vendor_id, test_name, price required)
            if (fallbackError.message?.includes('column') && fallbackError.message?.includes('does not exist')) {
              const catVal = testData.category === 'other' && (testData.otherCategoryName || testData.other_category_name)
                ? (testData.otherCategoryName || testData.other_category_name)
                : (testData.category || testData.test_category);
              const testMin = await insert('diagnostic_tests', {
                vendor_id: actualVendorId,
                test_name: testData.testName || testData.test_name || testData.name,
                test_category: catVal,
                price: testData.price ?? 0,
                is_available: testData.isAvailable !== false,
              });
              const row = testMin[0] as any;
              if (row && row.test_category != null) row.category = row.test_category;
              return c.json({ success: true, test: row, message: 'Diagnostic test added successfully' });
            }
            throw fallbackError;
          }
        }
        
        throw insertError;
      }
    } catch (error: any) {
      console.error('Error adding diagnostic test:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/diagnostics/tests/:testId
   * Update diagnostic test
   * Requires 'diagnostics' or 'test_catalog' capability
   */
  app.put("/vendor/:vendorId/diagnostics/tests/:testId", async (c) => {
    try {
      const { vendorId, testId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) return c.json({ error: 'Vendor not found' }, 404);
      const actualVendorId = vendor.id;
      
      // Check if vendor has diagnostics capability (try multiple capability names)
      const hasDiagnosticsCapability = await checkVendorCapability(vendorId, 'diagnostic_results') ||
                                       await checkVendorCapability(vendorId, 'diagnostics') ||
                                       await checkVendorCapability(vendorId, 'test_catalog') ||
                                       await checkVendorCapability(vendorId, 'diagnostic_lab') ||
                                       await checkVendorCapability(vendorId, 'diagnostic lab');
      if (!hasDiagnosticsCapability) {
        return c.json({ error: 'Vendor does not have diagnostics capability' }, 403);
      }

      const testData = await c.req.json();

      // Build update object with only provided fields - core fields first
      const coreUpdateFields: any = {};
      const extendedUpdateFields: any = {};
      
      // Core fields (guaranteed to exist)
      if (testData.testName !== undefined || testData.test_name !== undefined) {
        coreUpdateFields.test_name = testData.testName || testData.test_name;
      }
      if (testData.category !== undefined) {
        coreUpdateFields.category = testData.category === 'other' && (testData.otherCategoryName || testData.other_category_name)
          ? (testData.otherCategoryName || testData.other_category_name)
          : testData.category;
      }
      if (testData.serviceStyle !== undefined || testData.service_style !== undefined) {
        extendedUpdateFields.service_style = testData.serviceStyle ?? testData.service_style;
      }
      if (testData.description !== undefined) {
        coreUpdateFields.description = testData.description;
      }
      if (testData.price !== undefined) {
        coreUpdateFields.price = testData.price;
      }
      if (testData.durationMinutes !== undefined || testData.duration_minutes !== undefined) {
        coreUpdateFields.duration_minutes = testData.durationMinutes || testData.duration_minutes;
      }
      if (testData.sampleType !== undefined || testData.sample_type !== undefined) {
        coreUpdateFields.sample_type = testData.sampleType || testData.sample_type;
      }
      if (testData.preparationInstructions !== undefined || testData.preparation_instructions !== undefined) {
        coreUpdateFields.preparation_instructions = testData.preparationInstructions || testData.preparation_instructions;
      }
      if (testData.isAvailable !== undefined) {
        coreUpdateFields.is_available = testData.isAvailable;
      }
      
      // Extended fields (may not exist - added in migration 503)
      if (testData.testCode !== undefined || testData.test_code !== undefined) {
        extendedUpdateFields.test_code = testData.testCode || testData.test_code;
      }
      if (testData.isFreeHomeCollection !== undefined || testData.is_free_home_collection !== undefined) {
        extendedUpdateFields.is_free_home_collection = testData.isFreeHomeCollection || testData.is_free_home_collection;
      }
      if (testData.homeCollectionFee !== undefined || testData.home_collection_fee !== undefined) {
        extendedUpdateFields.home_collection_fee = testData.homeCollectionFee || testData.home_collection_fee;
      }
      if (testData.termsConditions !== undefined || testData.terms_conditions !== undefined) {
        extendedUpdateFields.terms_conditions = testData.termsConditions || testData.terms_conditions;
      }
      if (testData.turnaroundTimeHours !== undefined || testData.turnaround_time_hours !== undefined) {
        extendedUpdateFields.turnaround_time_hours = testData.turnaroundTimeHours || testData.turnaround_time_hours;
      }
      if (testData.isPackageAvailable !== undefined || testData.is_package_available !== undefined) {
        extendedUpdateFields.is_package_available = testData.isPackageAvailable || testData.is_package_available;
      }
      if (testData.packagePrice !== undefined || testData.package_price !== undefined) {
        extendedUpdateFields.package_price = testData.packagePrice || testData.package_price;
      }
      if (testData.packageTestCount !== undefined || testData.package_test_count !== undefined) {
        extendedUpdateFields.package_test_count = testData.packageTestCount || testData.package_test_count;
      }
      
      // ✅ FIX: Try with all fields first, fallback to core fields only
      try {
        const updateFields = { ...coreUpdateFields, ...extendedUpdateFields };
        const updated = await update('diagnostic_tests',
          { id: testId, vendor_id: actualVendorId },
          updateFields
        );
        
        if (updated.length === 0) {
          return c.json({ error: 'Test not found or access denied' }, 404);
        }
        
        return c.json({ success: true, test: updated[0], message: 'Test updated successfully' });
      } catch (updateError: any) {
        // ✅ FIX: If column doesn't exist error, retry with only core columns
        if (updateError.message?.includes('column') && updateError.message?.includes('does not exist')) {
          console.warn('⚠️ Extended columns not found, retrying with core columns only. Run migration 503 to add missing columns.');
          
          const updatedCore = await update('diagnostic_tests',
            { id: testId, vendor_id: actualVendorId },
            coreUpdateFields
          );
          
          if (updatedCore.length === 0) {
            return c.json({ error: 'Test not found or access denied' }, 404);
          }
          
          return c.json({ 
            success: true, 
            test: updatedCore[0], 
            message: 'Test updated successfully (some fields may be unavailable)',
            warning: 'Extended columns not available. Please run migration 503 to enable all features.'
          });
        }
        
        throw updateError;
      }
    } catch (error: any) {
      console.error('Error updating diagnostic test:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/diagnostics/bookings
   * Get all diagnostics bookings for a vendor
   * Requires 'diagnostics' or 'diagnostic_results' capability
   */
  app.get("/vendor/:vendorId/diagnostics/bookings", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { status, date } = c.req.query();

      const hasDiagnosticsCapability = await checkVendorCapability(vendorId, 'diagnostic_results') ||
                                       await checkVendorCapability(vendorId, 'diagnostics') ||
                                       await checkVendorCapability(vendorId, 'test_catalog') ||
                                       await checkVendorCapability(vendorId, 'diagnostic_lab') ||
                                       await checkVendorCapability(vendorId, 'diagnostic lab');
      if (!hasDiagnosticsCapability) {
        return c.json({ error: 'Vendor does not have diagnostics capability' }, 403);
      }

      // Build query conditions: diagnostics bookings have notes with "tests" array (from DiagnosticsBookingFlow)
      // or may use service_id from diagnostics vendor_services; service_id is UUID so we match by notes
      let conditions = `b.vendor_id = $1 AND (b.notes IS NOT NULL AND (b.notes::text LIKE '%"tests"%' OR b.notes::text LIKE '%"test_name"%'))`;
      const params: any[] = [vendorId];
      let paramIndex = 2;
      
      if (status) {
        conditions += ` AND b.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
      
      if (date) {
        conditions += ` AND b.booking_date = $${paramIndex}`;
        params.push(date);
        paramIndex++;
      }
      
      const { rows: bookings } = await query(`
        SELECT 
          b.*,
          c.full_name as customer_name,
          c.phone as customer_phone,
          p.name as pet_name,
          p.species as pet_type,
          sca.staff_id as assigned_staff_id,
          COALESCE(sca.staff_name, sca.agent_name) as assigned_staff_name,
          COALESCE(sca.staff_phone, sca.agent_phone) as assigned_staff_phone,
          sca.agent_name as assigned_agent_name,
          sca.agent_phone as assigned_agent_phone,
          sca.collection_otp,
          sca.status as collection_status
        FROM bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN pets p ON p.id = b.pet_id
        LEFT JOIN sample_collection_assignments sca ON sca.booking_id = b.id
        WHERE ${conditions}
        ORDER BY b.booking_date DESC, b.booking_time DESC
      `, params);
      
      // Get reports for each booking (schema-aware: booking_id or diagnostic_booking_id)
      const bookingIds = bookings.map(b => b.id);
      let reports: any[] = [];
      
      if (bookingIds.length > 0) {
        try {
          const { rows: reportRows } = await query(`
            SELECT * FROM diagnostic_reports 
            WHERE booking_id = ANY($1)
          `, [bookingIds]);
          reports = reportRows;
        } catch (drErr: any) {
          if (drErr?.message?.includes('booking_id')) {
            try {
              const { rows: reportRows } = await query(`
                SELECT *, diagnostic_booking_id as booking_id FROM diagnostic_reports 
                WHERE diagnostic_booking_id = ANY($1)
              `, [bookingIds]);
              reports = reportRows;
            } catch {
              // diagnostic_reports may not exist or have different schema
            }
          }
        }
      }
      
      // Format response - enrich pet/patient from notes when pet_id is null (e.g. diagnostics patientName/patientAge)
      const formattedBookings = bookings.map((b: any) => {
        let pet_name = b.pet_name;
        let pet_type = b.pet_type;
        let pet_age: string | undefined;
        if ((!pet_name || pet_name === 'Unknown Pet') && b.notes) {
          try {
            const notesObj = typeof b.notes === 'string' ? JSON.parse(b.notes) : b.notes;
            if (notesObj && typeof notesObj === 'object') {
              if (notesObj.patientName) pet_name = notesObj.patientName;
              if (notesObj.petType || notesObj.pet_type) pet_type = notesObj.petType || notesObj.pet_type;
              if (notesObj.patientAge != null || notesObj.petAge != null) pet_age = String(notesObj.patientAge ?? notesObj.petAge ?? '');
            }
          } catch {
            // notes not JSON
          }
        }
        return {
          ...b,
          pet_name: pet_name || 'Patient',
          pet_type: pet_type || '',
          pet_age: pet_age ?? b.pet_age ?? undefined,
          reports: reports.filter((r: any) => (r.booking_id || r.diagnostic_booking_id) === b.id),
          assigned_staff: (b.assigned_staff_id || b.assigned_staff_name || b.assigned_agent_name) ? {
            id: b.assigned_staff_id,
            name: b.assigned_staff_name || b.assigned_agent_name,
            phone: b.assigned_staff_phone || b.assigned_agent_phone
          } : null,
          collection_otp: b.collection_otp,
          collection_status: b.collection_status
        };
      });
      
      return c.json({ 
        success: true, 
        bookings: formattedBookings,
        count: formattedBookings.length 
      });
    } catch (error: any) {
      console.error('Error getting diagnostics bookings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // PHARMACY: MEDICINE INVENTORY
  // ============================================

  /**
   * GET /vendor/:vendorId/pharmacy/medicines
   * Get pharmacy inventory
   * Requires 'pharmacy' or 'inventory' capability
   */
  app.get("/vendor/:vendorId/pharmacy/medicines", async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      
      // Handle test IDs - return empty medicines
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({ success: true, medicines: [], total: 0 });
      }
      
      // Check if vendor has pharmacy capability
      const hasPharmacyCapability = await checkVendorCapability(vendorId, 'pharmacy');
      const hasInventoryCapability = await checkVendorCapability(vendorId, 'inventory');
      if (!hasPharmacyCapability && !hasInventoryCapability) {
        return c.json({ error: 'Vendor does not have pharmacy capability' }, 403);
      }
      
      // Get products filtered by category (medicine/pharmacy)
      let medicines;
      try {
        medicines = await query(`
          SELECT * FROM products 
          WHERE vendor_id = $1 
          AND (category = 'medicine' OR category = 'pharmacy' OR category ILIKE '%medicine%')
          ORDER BY created_at DESC
        `, [vendorId]);
      } catch (error: any) {
        // If UUID validation fails, return empty medicines
        if (error.message?.includes('invalid input syntax for type uuid')) {
          return c.json({ success: true, medicines: [], total: 0 });
        }
        throw error;
      }
      
      return c.json({ success: true, medicines: medicines.rows, total: medicines.rows.length });
    } catch (error: any) {
      console.error('Error fetching pharmacy inventory:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/pharmacy/medicines
   * Add medicine to inventory
   * Requires 'pharmacy' or 'inventory' capability
   */
  app.post("/vendor/:vendorId/pharmacy/medicines", async (c) => {
    try {
      const vendorId = await resolveVendorId(c.req.param('vendorId'));
      
      // Check if vendor has pharmacy capability
      const hasPharmacyCapability = await checkVendorCapability(vendorId, 'pharmacy');
      const hasInventoryCapability = await checkVendorCapability(vendorId, 'inventory');
      if (!hasPharmacyCapability && !hasInventoryCapability) {
        return c.json({ error: 'Vendor does not have pharmacy capability' }, 403);
      }
      
      const medicineData = await c.req.json();
      
      const medicine = await insert('products', {
        vendor_id: vendorId,
        name: medicineData.name,
        description: medicineData.description,
        category: 'medicine',
        subcategory: medicineData.subcategory,
        price: medicineData.price,
        stock: medicineData.stock || 0,
        images: medicineData.images || [],
        hsn_code: medicineData.hsnCode || medicineData.hsn_code,
        gst_rate: medicineData.gstRate || medicineData.gst_rate,
      });
      
      return c.json({ success: true, medicine: medicine[0], message: 'Medicine added to inventory' });
    } catch (error: any) {
      console.error('Error adding medicine:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // NUTRITIONIST: MEAL PLANS
  // ============================================

  /**
   * GET /vendor/:vendorId/nutritionist/meal-plans
   * Get all meal plans
   * Requires 'meal_plans' capability
   */
  app.get("/vendor/:vendorId/nutritionist/meal-plans", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      
      // Check if vendor has meal_plans capability
      const hasMealPlansCapability = await checkVendorCapability(vendorId, 'meal_plans');
      if (!hasMealPlansCapability) {
        return c.json({ error: 'Vendor does not have meal plans capability' }, 403);
      }
      
      const rows = await select('meal_plans',
        { vendor_id: vendorId },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );
      const mealPlans = (rows || []).map((r: any) => ({
        ...r,
        name: r.plan_name || r.name,
        pet_types: (() => {
          try {
            const d = typeof r.dietary_requirements === 'string' ? JSON.parse(r.dietary_requirements) : r.dietary_requirements;
            return d?.pet_types || d?.petTypes || ['Dog', 'Cat'];
          } catch { return ['Dog', 'Cat']; }
        })(),
      }));
      return c.json({ success: true, mealPlans, plans: mealPlans, total: mealPlans.length });
    } catch (error: any) {
      console.error('Error fetching meal plans:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/nutritionist/meal-plans
   * Create a new meal plan
   * Requires 'meal_plans' capability
   * Resolves vendorId to fix meal_plans_vendor_id_fkey FK violation
   */
  app.post("/vendor/:vendorId/nutritionist/meal-plans", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({
          error: 'Vendor not found',
          hint: 'The vendor ID may be invalid. Please ensure you are logged in with a valid vendor account.',
        }, 404);
      }
      
      // Check if vendor has meal_plans capability
      const hasMealPlansCapability = await checkVendorCapability(vendorId, 'meal_plans');
      if (!hasMealPlansCapability) {
        return c.json({ error: 'Vendor does not have meal plans capability' }, 403);
      }
      
      const mealPlanData = await c.req.json();
      const planName = mealPlanData.planName || mealPlanData.plan_name || mealPlanData.name || 'Meal Plan';
      const durationDays = mealPlanData.duration_days ?? mealPlanData.durationDays ?? 7;
      const price = mealPlanData.price ?? mealPlanData.pricePerWeek ?? 0;
      
      const mealPlan = await insert('meal_plans', {
        vendor_id: vendorId,
        plan_name: planName,
        description: mealPlanData.description || null,
        duration_days: durationDays,
        price,
        meals_per_day: mealPlanData.meals_per_day ?? mealPlanData.mealsPerDay ?? 2,
        dietary_requirements: JSON.stringify({
          pet_types: mealPlanData.pet_types || mealPlanData.petTypes || ['Dog', 'Cat'],
          meals: mealPlanData.meals || [],
          nutritional_goals: mealPlanData.nutritionalGoals || mealPlanData.nutritional_goals || {},
        }),
        is_active: mealPlanData.isActive !== false,
      });
      
      return c.json({ success: true, mealPlan: mealPlan[0], message: 'Meal plan created successfully' });
    } catch (error: any) {
      console.error('Error creating meal plan:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/nutritionist/meal-plans/:planId
   * Update a meal plan
   */
  app.put("/vendor/:vendorId/nutritionist/meal-plans/:planId", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const { planId } = c.req.param();
      const mealPlanData = await c.req.json();
      
      const check = await query(
        `SELECT id FROM meal_plans WHERE id = $1 AND vendor_id = $2`,
        [planId, vendorId]
      );
      if (!check.rows?.length) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }
      
      const planName = mealPlanData.planName ?? mealPlanData.plan_name ?? mealPlanData.name;
      const durationDays = mealPlanData.duration_days ?? mealPlanData.durationDays;
      const price = mealPlanData.price;
      const mealsPerDay = mealPlanData.meals_per_day ?? mealPlanData.mealsPerDay;
      const description = mealPlanData.description;
      const isActive = mealPlanData.isActive;
      const petTypes = mealPlanData.pet_types ?? mealPlanData.petTypes;
      
      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;
      if (planName != null) { updates.push(`plan_name = $${idx}`); params.push(planName); idx++; }
      if (description != null) { updates.push(`description = $${idx}`); params.push(description); idx++; }
      if (durationDays != null) { updates.push(`duration_days = $${idx}`); params.push(durationDays); idx++; }
      if (price != null) { updates.push(`price = $${idx}`); params.push(price); idx++; }
      if (mealsPerDay != null) { updates.push(`meals_per_day = $${idx}`); params.push(mealsPerDay); idx++; }
      if (isActive !== undefined) { updates.push(`is_active = $${idx}`); params.push(isActive); idx++; }
      if (petTypes != null) {
        updates.push(`dietary_requirements = $${idx}::jsonb`);
        params.push(JSON.stringify({ pet_types: petTypes }));
        idx++;
      }
      if (updates.length === 0) {
        return c.json({ success: true, message: 'No changes' });
      }
      params.push(planId, vendorId);
      await query(
        `UPDATE meal_plans SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} AND vendor_id = $${idx + 1}`,
        params
      );
      return c.json({ success: true, message: 'Meal plan updated' });
    } catch (error: any) {
      console.error('Error updating meal plan:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/nutritionist/meal-plans/:planId
   * Delete a meal plan
   */
  app.delete("/vendor/:vendorId/nutritionist/meal-plans/:planId", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const { planId } = c.req.param();
      const del = await query(`DELETE FROM meal_plans WHERE id = $1 AND vendor_id = $2 RETURNING id`, [planId, vendorId]);
      if (!del.rows?.length) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }
      return c.json({ success: true, message: 'Meal plan deleted' });
    } catch (error: any) {
      console.error('Error deleting meal plan:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /nutrition/delivery-orders
   * Create meal plan delivery order
   */
  app.post("/nutrition/delivery-orders", async (c) => {
    try {
      const orderData = await c.req.json();
      const {
        vendorId,
        customerId,
        mealPlanId,
        petId,
        addressId,
        deliveryDate,
        deliveryTime,
        quantity,
        totalAmount,
      } = orderData;

      if (!vendorId || !customerId || !mealPlanId || !petId || !addressId || !deliveryDate || !deliveryTime) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Get address details
      const addresses = await select('addresses', { id: addressId });
      if (addresses.length === 0) {
        return c.json({ error: 'Address not found' }, 404);
      }
      const address = addresses[0];

      // Get meal plan: by id first; if not found (e.g. mobile sent service id), use first meal plan for vendor
      let mealPlans = await select('meal_plans', { id: mealPlanId });
      if (mealPlans.length === 0 && vendorId) {
        const fallback = await query(
          `SELECT * FROM meal_plans WHERE vendor_id = $1 AND (is_active IS NULL OR is_active = true) ORDER BY created_at DESC LIMIT 1`,
          [vendorId]
        ).catch(() => ({ rows: [] }));
        if ((fallback as any).rows?.length > 0) {
          mealPlans = (fallback as any).rows;
        }
      }
      if (mealPlans.length === 0) {
        return c.json({ error: 'Meal plan not found' }, 404);
      }
      const mealPlan = mealPlans[0];
      const effectiveMealPlanId = mealPlan.id;
      const unitPrice = parseFloat(mealPlan.price_per_meal || mealPlan.price || totalAmount || 0);
      const qty = quantity || 1;
      const subtotalVal = unitPrice * qty;
      const totalVal = totalAmount != null ? Number(totalAmount) : subtotalVal;

      const customers = await select('customers', { id: customerId });
      const customerPhone = customers[0]?.phone || '';

      const orderNumber = `MP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const shippingAddrStr = typeof address.address === 'string'
        ? address.address
        : [address.address, address.addressLine1, address.city, address.pincode].filter(Boolean).join(', ');

      const orderPayload: Record<string, any> = {
        customer_id: customerId,
        vendor_id: vendorId,
        order_number: orderNumber,
        order_status: 'pending',
        subtotal: subtotalVal,
        tax_amount: 0,
        shipping_amount: 0,
        discount_amount: 0,
        total_amount: totalVal,
        shipping_address: shippingAddrStr || JSON.stringify({ address: address.address, city: address.city, pincode: address.pincode, state: address.state || '' }),
        shipping_city: address.city || address.address_city || '',
        shipping_state: address.state || address.address_state || '',
        shipping_pincode: address.pincode || address.address_pincode || '',
        shipping_phone: customerPhone,
        payment_method: 'online',
        order_type: 'meal_plan_delivery',
        delivery_date: deliveryDate,
        delivery_time: typeof deliveryTime === 'string' ? deliveryTime : JSON.stringify(deliveryTime || {}),
      };

      const order = await insert('orders', orderPayload);

      await insert('order_items', {
        order_id: order[0].id,
        service_id: effectiveMealPlanId,
        name: mealPlan.name || 'Meal Plan',
        quantity: qty,
        unit_price: unitPrice,
        total_price: unitPrice * qty,
      });

      await insert('meal_plan_orders', {
        order_id: order[0].id,
        meal_plan_id: effectiveMealPlanId,
        pet_id: petId,
        quantity: qty,
        delivery_date: deliveryDate,
        delivery_time: typeof deliveryTime === 'string' ? deliveryTime : JSON.stringify(deliveryTime || {}),
      }).catch(() => {});

      return c.json({
        success: true,
        order: order[0],
        order_id: order[0].id,
        orderId: order[0].id,
        message: 'Meal plan order created successfully',
      });
    } catch (error: any) {
      console.error('Error creating meal plan delivery order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /nutrition/delivery-orders
   * Get delivery orders for a vendor
   */
  app.get("/nutrition/delivery-orders", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      if (!vendorId) {
        return c.json({ error: 'vendorId is required' }, 400);
      }

      let ordersQuery = `
        SELECT 
          o.*,
          c.full_name as customer_name,
          c.phone as customer_phone,
          mp.name as meal_plan_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN meal_plan_orders mpo ON o.id = mpo.order_id
        LEFT JOIN meal_plans mp ON mpo.meal_plan_id = mp.id
        WHERE o.vendor_id = $1
        AND o.order_type = 'meal_plan_delivery'
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (status && status !== 'all') {
        ordersQuery += ` AND o.order_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      ordersQuery += ` ORDER BY o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const orders = await query(ordersQuery, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        orders: orders.rows,
        total: orders.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching delivery orders:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/nutrition/meal-plans
   * Get meal plans (alternative endpoint for customer app)
   * ✅ FIX GAP-9.1 & 9.2: Supports maxRadius and filters
   */
  app.get("/vendor/:vendorId/nutrition/meal-plans", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const rules = await getDiscoveryRules('pet_nutritionist', 'meal_search');
      const defaultRadiusKm = rules.discovery_radius_km ?? 10;
      const maxRadius = c.req.query('maxRadius') ? parseFloat(c.req.query('maxRadius')!) : defaultRadiusKm;
      const filters = c.req.query('filters')?.split(',') || [];
      
      // Base query
      let queryStr = `
        SELECT mp.*, v.latitude, v.longitude, v.business_name as vendor_name
        FROM meal_plans mp
        LEFT JOIN vendors v ON mp.vendor_id = v.id
        WHERE mp.is_active = true
      `;
      const params: any[] = [];
      let paramIndex = 1;
      
      // Filter by vendor if specified
      if (vendorId) {
        queryStr += ` AND mp.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }
      
      // ✅ FIX GAP-9.1: Filter by 10km radius if location provided
      if (lat && lng && maxRadius) {
        queryStr += `
          AND (
            6371 * acos(
              cos(radians($${paramIndex})) * 
              cos(radians(COALESCE(v.latitude, 0))) * 
              cos(radians(COALESCE(v.longitude, 0)) - radians($${paramIndex + 1})) + 
              sin(radians($${paramIndex})) * 
              sin(radians(COALESCE(v.latitude, 0)))
            )
          ) <= $${paramIndex + 2}
        `;
        params.push(lat, lng, maxRadius);
        paramIndex += 3;
      }
      
      // ✅ FIX GAP-9.2: Apply filters (weight_management, daily_nutrition, fresh_food, frozen_food)
      if (filters.length > 0) {
        const filterConditions: string[] = [];
        filters.forEach((filter) => {
          if (filter === 'weight_management') {
            filterConditions.push(`(mp.diet_type::text LIKE '%weight_loss%' OR mp.diet_type::text LIKE '%weight_management%')`);
          } else if (filter === 'daily_nutrition') {
            filterConditions.push(`(mp.diet_type::text LIKE '%daily%' OR mp.diet_type::text LIKE '%nutrition%')`);
          } else if (filter === 'fresh_food') {
            filterConditions.push(`mp.meal_type = 'fresh_daily' OR mp.meal_type = 'fresh_weekly'`);
          } else if (filter === 'frozen_food') {
            filterConditions.push(`mp.meal_type = 'frozen'`);
          }
        });
        if (filterConditions.length > 0) {
          queryStr += ` AND (${filterConditions.join(' OR ')})`;
        }
      }
      
      queryStr += ` ORDER BY mp.created_at DESC`;
      
      const result = await query(queryStr, params);
      const mealPlans = result.rows || [];
      
      return c.json({ 
        success: true, 
        plans: mealPlans, 
        mealPlans, 
        total: mealPlans.length,
        filters: filters,
        maxRadius: maxRadius,
      });
    } catch (error: any) {
      console.error('Error fetching meal plans:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // NUTRITIONIST: MEAL PRODUCTS & ORDERS
  // ============================================

  /**
   * GET /vendor/:vendorId/meal-products
   * Get meal products for a nutritionist vendor (merged from products + meal_plans for consistent list)
   * Resolves vendorId (identity id → vendors id) for correct vendor lookup
   */
  app.get("/vendor/:vendorId/meal-products", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const list: any[] = [];

      // 1) Products table (meal_plan / nutrition / food); fallback if category column missing
      try {
        let productsResult: any;
        try {
          productsResult = await query(
            `SELECT * FROM products 
             WHERE vendor_id = $1 AND (category = 'meal_plan' OR category = 'nutrition' OR category = 'food')
             ORDER BY created_at DESC`,
            [vendorId]
          );
        } catch (colErr: any) {
          if (colErr?.message?.includes('category') || colErr?.message?.includes('does not exist')) {
            productsResult = await query(`SELECT * FROM products WHERE vendor_id = $1 ORDER BY created_at DESC`, [vendorId]);
            if (productsResult?.rows?.length) {
              productsResult.rows = productsResult.rows.filter((p: any) => ['meal_plan', 'nutrition', 'food'].includes(p.category));
            }
          } else throw colErr;
        }
        const rows = productsResult?.rows || [];
        for (const p of rows) {
          let meta: any = {};
          try {
            meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : (p.metadata || {});
          } catch (_) {}
          list.push({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            category: p.category || 'meal_plan',
            metadata: meta,
            petTypes: meta.petTypes || [],
            dietType: meta.dietType,
            ingredients: meta.ingredients || [],
            nutritionalValue: meta.nutritionalValue || {},
            sku: p.sku,
            stock_quantity: p.stock_quantity,
            is_active: p.is_active,
            created_at: p.created_at,
            updated_at: p.updated_at,
            _source: 'products',
          });
        }
      } catch (err: any) {
        console.warn('Products query failed:', err?.message);
      }

      // 2) meal_plans table (unified shape so names display in list)
      try {
        const mealPlansResult = await query(
          `SELECT * FROM meal_plans WHERE vendor_id = $1 ORDER BY created_at DESC`,
          [vendorId]
        );
        const rows = mealPlansResult.rows || [];
        for (const mp of rows) {
          let dietaryReqs: any = {};
          try {
            dietaryReqs = typeof mp.dietary_requirements === 'string'
              ? JSON.parse(mp.dietary_requirements)
              : (mp.dietary_requirements || {});
          } catch (_) {}
          list.push({
            id: mp.id,
            name: mp.plan_name,
            plan_name: mp.plan_name,
            description: mp.description,
            price: mp.price,
            category: 'meal_plan',
            metadata: dietaryReqs,
            petTypes: dietaryReqs.petTypes || [],
            dietType: dietaryReqs.dietType,
            ingredients: dietaryReqs.ingredients || [],
            nutritionalValue: dietaryReqs.nutritionalValue || {},
            duration_days: mp.duration_days,
            meals_per_day: mp.meals_per_day,
            is_active: mp.is_active,
            created_at: mp.created_at,
            updated_at: mp.updated_at,
            _source: 'meal_plans',
          });
        }
      } catch (err: any) {
        console.warn('meal_plans query failed:', err?.message);
      }

      // Sort by created_at desc (newest first)
      list.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });

      return c.json({ success: true, products: list, total: list.length });
    } catch (error: any) {
      console.error('Error fetching meal products:', error);
      return c.json({ success: true, products: [], total: 0 });
    }
  });

  /**
   * POST /vendor/:vendorId/meal-products
   * Create a meal product for a nutritionist vendor (products or meal_plans; metadata optional)
   * Resolves vendorId (identity id → vendors id) to fix meal_plans_vendor_id_fkey FK violation
   */
  app.post("/vendor/:vendorId/meal-products", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({
          error: 'Vendor not found',
          hint: 'The vendor ID may be invalid or the vendor record does not exist. Please ensure you are logged in with a valid vendor account.',
        }, 404);
      }
      const data = await c.req.json();
      const dietaryPayload = {
        petTypes: data.petTypes || ['Dog', 'Cat'],
        dietType: data.dietType,
        suitableFor: data.suitableFor || [],
        ingredients: data.ingredients || [],
        nutritionalValue: data.nutritionalValue || {},
        preparationLeadTime: data.preparationLeadTime,
        storageInstructions: data.storageInstructions,
        shelfLife: data.shelfLife,
        packSize: data.packSize,
      };

      // Try products table first (with metadata if column exists)
      const hasMetadata = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'metadata'`
      ).then((r: any) => (r?.rows?.length ?? 0) > 0);

      try {
        const productPayload: any = {
          vendor_id: vendorId,
          name: data.name,
          description: data.description,
          price: data.price,
          category: 'meal_plan',
          sku: `MP-${Date.now()}`,
          stock_quantity: data.stockQuantity || 100,
          is_active: true,
        };
        if (hasMetadata) productPayload.metadata = JSON.stringify(dietaryPayload);
        const product = await insert('products', productPayload);
        return c.json({ success: true, product: product[0] });
      } catch (productsErr: any) {
        if (!productsErr?.message?.includes('does not exist') && !productsErr?.message?.includes('metadata')) {
          throw productsErr;
        }
      }

      // Fallback to meal_plans table
      const mealPlan = await insert('meal_plans', {
        vendor_id: vendorId,
        plan_name: data.name,
        description: data.description,
        price: data.price,
        duration_days: data.durationDays || 7,
        meals_per_day: data.mealsPerDay || 2,
        dietary_requirements: JSON.stringify(dietaryPayload),
        is_active: true,
      });
      const transformedProduct = {
        ...mealPlan[0],
        name: mealPlan[0].plan_name,
        category: 'meal_plan',
        metadata: mealPlan[0].dietary_requirements,
      };
      return c.json({ success: true, product: transformedProduct });
    } catch (error: any) {
      console.error('Error creating meal product:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/meal-products/:productId
   * Update a meal product (supports both products and meal_plans; products.metadata optional)
   */
  app.put("/vendor/:vendorId/meal-products/:productId", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const { productId } = c.req.param();
      const data = await c.req.json();
      const meta = data.metadata || {};
      const dietaryPayload = {
        petTypes: data.petTypes || meta.petTypes || ['Dog', 'Cat'],
        dietType: data.dietType ?? meta.dietType,
        suitableFor: data.suitableFor ?? meta.suitableFor ?? [],
        ingredients: data.ingredients ?? meta.ingredients ?? [],
        nutritionalValue: data.nutritionalValue ?? meta.nutritionalValue ?? {},
        preparationLeadTime: data.preparationLeadTime ?? meta.preparationLeadTime,
        storageInstructions: data.storageInstructions ?? meta.storageInstructions,
        shelfLife: data.shelfLife ?? meta.shelfLife,
        packSize: data.packSize ?? meta.packSize,
      };

      // 1) Try updating meal_plans (id may be from meal_plans when products insert failed or wasn't used)
      const mealPlanCheck = await query(
        `SELECT id FROM meal_plans WHERE id = $1 AND vendor_id = $2`,
        [productId, vendorId]
      );
      if (mealPlanCheck.rows?.length > 0) {
        await query(
          `UPDATE meal_plans SET 
            plan_name = COALESCE($1, plan_name),
            description = COALESCE($2, description),
            price = COALESCE($3, price),
            dietary_requirements = COALESCE($4, dietary_requirements),
            updated_at = NOW()
           WHERE id = $5 AND vendor_id = $6`,
          [
            data.name ?? data.plan_name,
            data.description,
            data.price,
            JSON.stringify(dietaryPayload),
            productId,
            vendorId,
          ]
        );
        return c.json({ success: true, message: 'Product updated' });
      }

      // 2) Update products table (avoid metadata if column doesn't exist)
      const hasMetadata = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'metadata'`
      ).then((r: any) => (r?.rows?.length ?? 0) > 0);

      if (hasMetadata) {
        await query(
          `UPDATE products SET 
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            price = COALESCE($3, price),
            metadata = COALESCE($4::jsonb, metadata),
            updated_at = NOW()
           WHERE id = $5 AND vendor_id = $6`,
          [
            data.name,
            data.description,
            data.price,
            JSON.stringify({ ...meta, ...dietaryPayload }),
            productId,
            vendorId,
          ]
        );
      } else {
        await query(
          `UPDATE products SET 
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            price = COALESCE($3, price),
            updated_at = NOW()
           WHERE id = $4 AND vendor_id = $5`,
          [data.name, data.description, data.price, productId, vendorId]
        );
      }

      return c.json({ success: true, message: 'Product updated' });
    } catch (error: any) {
      console.error('Error updating meal product:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/meal-products/:productId
   * Delete a meal product (from products or meal_plans)
   */
  app.delete("/vendor/:vendorId/meal-products/:productId", async (c) => {
    try {
      const paramVendorId = c.req.param('vendorId');
      const vendorId = await resolveVendorId(paramVendorId);
      const { productId } = c.req.param();
      let del = await query(`DELETE FROM products WHERE id = $1 AND vendor_id = $2 RETURNING id`, [productId, vendorId]);
      if (del.rows?.length === 0) {
        del = await query(`DELETE FROM meal_plans WHERE id = $1 AND vendor_id = $2 RETURNING id`, [productId, vendorId]);
      }
      if (del.rows?.length === 0) {
        return c.json({ error: 'Meal product not found' }, 404);
      }
      return c.json({ success: true, message: 'Product deleted' });
    } catch (error: any) {
      console.error('Error deleting meal product:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/meal-orders
   * Get meal/nutrition delivery orders for a vendor.
   * Returns from BOTH meal_orders (MealOrderCheckout flow) AND orders table (MealPlanBookingFlow /nutrition/delivery-orders flow).
   */
  app.get("/vendor/:vendorId/meal-orders", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');

      const allOrders: any[] = [];

      // 1. From meal_orders table (MealOrderCheckout /meal/orders/create flow)
      let mealOrdersQuery = `
        SELECT mo.id, mo.customer_id, mo.vendor_id, mo.meal_plan_id, mo.pet_id,
               mo.order_type, mo.quantity, mo.special_instructions, mo.subtotal, mo.delivery_fee,
               mo.platform_fee, mo.total_amount, mo.status, mo.payment_status,
               mo.scheduled_delivery_date, mo.scheduled_delivery_slot, mo.delivery_address,
               mo.preparation_eta_minutes, mo.estimated_preparation_time, mo.accepted_at,
               mo.prep_started_at, mo.ready_at, mo.created_at,
               c.full_name as customer_name, c.phone as customer_phone,
               mp.name as meal_name
        FROM meal_orders mo
        LEFT JOIN customers c ON mo.customer_id = c.id
        LEFT JOIN meal_plans mp ON mo.meal_plan_id = mp.id
        WHERE mo.vendor_id = $1
      `;
      const mealParams: any[] = [vendorId];
      if (status) {
        mealParams.push(status);
        mealOrdersQuery += ` AND mo.status = $${mealParams.length}`;
      }
      mealOrdersQuery += ` ORDER BY mo.created_at DESC LIMIT 100`;

      const mealResult = await query(mealOrdersQuery, mealParams).catch(() => ({ rows: [] }));
      for (const o of mealResult.rows) {
        allOrders.push({
          ...o,
          source: 'meal_orders',
          order_number: o.id?.toString().slice(-8) || '',
          items: [],
          delivery_address: typeof o.delivery_address === 'string' ? (() => { try { return JSON.parse(o.delivery_address); } catch { return {}; } })() : o.delivery_address,
        });
      }

      // 2. From orders table (MealPlanBookingFlow /nutrition/delivery-orders flow)
      try {
        const hasOrderType = await query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type' LIMIT 1`
        ).then((r: any) => (r?.rows?.length || 0) > 0);
        if (hasOrderType) {
          let ordQuery = `
            SELECT o.id, o.customer_id, o.vendor_id, o.order_number, o.order_status as status,
                   o.total_amount, o.shipping_address as delivery_address, o.created_at,
                   o.delivery_date as scheduled_delivery_date, o.delivery_time as scheduled_delivery_slot,
                   c.full_name as customer_name, c.phone as customer_phone,
                   (SELECT mp.name FROM meal_plan_orders mpo LEFT JOIN meal_plans mp ON mpo.meal_plan_id = mp.id WHERE mpo.order_id = o.id LIMIT 1) as meal_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.vendor_id = $1 AND o.order_type = 'meal_plan_delivery'
          `;
          const ordParams: any[] = [vendorId];
          if (status) {
            ordParams.push(status);
            ordQuery += ` AND o.order_status = $${ordParams.length}`;
          }
          ordQuery += ` ORDER BY o.created_at DESC LIMIT 100`;

          const ordResult = await query(ordQuery, ordParams).catch(() => ({ rows: [] }));
          for (const o of ordResult.rows) {
            const parsedAddr = typeof o.delivery_address === 'string' ? (() => { try { return JSON.parse(o.delivery_address); } catch { return {}; } })() : o.delivery_address;
            allOrders.push({
              id: o.id,
              customer_id: o.customer_id,
              vendor_id: o.vendor_id,
              meal_plan_id: null,
              pet_id: null,
              order_type: 'meal_plan_delivery',
              quantity: 1,
              special_instructions: null,
              subtotal: o.total_amount,
              delivery_fee: 0,
              platform_fee: 0,
              total_amount: o.total_amount,
              status: o.status,
              payment_status: 'pending',
              scheduled_delivery_date: o.scheduled_delivery_date,
              scheduled_delivery_slot: o.scheduled_delivery_slot,
              delivery_address: parsedAddr,
              customer_name: o.customer_name,
              customer_phone: o.customer_phone,
              meal_name: o.meal_name || 'Meal Plan',
              created_at: o.created_at,
              source: 'orders',
              order_number: o.order_number || o.id?.toString().slice(-8) || '',
              items: [],
            });
          }
        }
      } catch (ordErr) {
        console.warn('[meal-orders] Could not fetch from orders table:', (ordErr as Error)?.message);
      }

      // Dedupe by id and sort by created_at desc
      const seen = new Set<string>();
      const deduped = allOrders
        .filter((o) => { const k = String(o.id); if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 100);

      return c.json({ success: true, orders: deduped, total: deduped.length });
    } catch (error: any) {
      console.error('Error fetching meal orders:', error);
      return c.json({ success: true, orders: [], total: 0 });
    }
  });

  /**
   * PUT /vendor/:vendorId/meal-orders/:orderId/status
   * Update meal order status (Phase 3: updates meal_orders, supports accepted)
   */
  app.put("/vendor/:vendorId/meal-orders/:orderId/status", async (c) => {
    try {
      const { vendorId, orderId } = c.req.param();
      const { status } = await c.req.json();

      const updatePayload: Record<string, any> = { status };
      if (status === 'accepted') {
        updatePayload.accepted_at = new Date().toISOString();
      }

      const existing = await select('meal_orders', { id: orderId, vendor_id: vendorId });
      if (existing.length === 0) {
        return c.json({ error: 'Order not found or not owned by vendor' }, 404);
      }
      await update('meal_orders', { id: orderId, vendor_id: vendorId }, updatePayload);

      return c.json({ success: true, message: 'Order status updated' });
    } catch (error: any) {
      console.error('Error updating meal order status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // CAFE: TABLE & PAX CONFIGURATION
  // ============================================

  /**
   * GET /vendor/:vendorId/cafe/menu
   * Get cafe menu items
   */
  app.get("/vendor/:vendorId/cafe/menu", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const menuItems = await query(
        `SELECT * FROM cafe_menu_items 
         WHERE vendor_id = $1 
         AND is_active = true
         ORDER BY category, name ASC
        `, [vendorId]).catch(async () => {
        // Fallback: return empty if table doesn't exist yet
        return { rows: [] };
      });
      
      return c.json({ 
        success: true, 
        menu_items: menuItems.rows,
        menu: menuItems.rows, // Alias for compatibility
        total: menuItems.rows.length 
      });
    } catch (error: any) {
      console.error('Error fetching cafe menu:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/cafe/tables
   * Get cafe table configuration
   * Requires 'cafe_tables' or 'reservations' capability
   */
  app.get("/vendor/:vendorId/cafe/tables", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Handle test IDs - return empty tables
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({ success: true, tables: [], totalSeats: 0 });
      }
      
      // Check if vendor has cafe_tables capability
      const hasCafeTablesCapability = await checkVendorCapability(vendorId, 'cafe_tables');
      const hasReservationsCapability = await checkVendorCapability(vendorId, 'reservations');
      if (!hasCafeTablesCapability && !hasReservationsCapability) {
        return c.json({ error: 'Vendor does not have cafe tables capability' }, 403);
      }
      
      // Check if cafe_tables table exists, if not use a generic approach
      // For now, we'll assume the table exists from migration
      const tables = await query(`
        SELECT * FROM cafe_tables 
        WHERE vendor_id = $1 
        ORDER BY created_at DESC
      `, [vendorId]).catch(async () => {
        // Fallback: return empty if table doesn't exist yet
        return { rows: [] };
      });
      
      const totalSeats = tables.rows.reduce((sum: number, table: any) => sum + (table.capacity || 0), 0);
      
      return c.json({ success: true, tables: tables.rows, totalSeats });
    } catch (error: any) {
      console.error('Error fetching cafe tables:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/cafe/tables/availability
   * Get cafe table availability for a specific date
   */
  app.get("/vendor/:vendorId/cafe/tables/availability", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const date = c.req.query('date') || new Date().toISOString().split('T')[0];
      const timeSlot = c.req.query('timeSlot');
      const numberOfPax = parseInt(c.req.query('numberOfPax') || '1', 10);

      // Handle test IDs - return empty availability
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          date,
          availableTables: [],
          totalTables: 0,
        });
      }

      // Get all tables
      const allTables = await query(`
        SELECT * FROM cafe_tables
        WHERE vendor_id = $1 AND is_active = true
        ORDER BY table_number ASC
      `, [vendorId]).catch(() => ({ rows: [] }));

      // Get bookings for the date
      const bookings = await query(`
        SELECT 
          b.id,
          b.table_id,
          b.booking_time,
          b.duration_minutes,
          b.number_of_pax,
          b.status
        FROM bookings b
        WHERE b.vendor_id = $1
          AND b.booking_date = $2
          AND b.service_type = 'pet_cafe'
          AND b.status IN ('confirmed', 'in_progress')
      `, [vendorId, date]).catch(() => ({ rows: [] }));

      // Calculate availability
      const availableTables = allTables.rows.map((table: any) => {
        const tableBookings = bookings.rows.filter((b: any) => b.table_id === table.id);
        const isAvailable = tableBookings.length === 0 || 
          (table.max_concurrent_bookings && tableBookings.length < table.max_concurrent_bookings);
        
        return {
          ...table,
          isAvailable,
          currentBookings: tableBookings.length,
          bookings: tableBookings,
        };
      });

      // Filter by time slot if provided
      let filteredTables = availableTables;
      if (timeSlot) {
        filteredTables = availableTables.filter((table: any) => {
          const hasConflict = table.bookings.some((b: any) => {
            const bookingStart = new Date(`${date}T${b.booking_time}`);
            const bookingEnd = new Date(bookingStart.getTime() + (b.duration_minutes || 60) * 60000);
            const slotStart = new Date(`${date}T${timeSlot}`);
            const slotEnd = new Date(slotStart.getTime() + 60 * 60000); // 1 hour default
            
            return (slotStart >= bookingStart && slotStart < bookingEnd) ||
                   (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
                   (slotStart <= bookingStart && slotEnd >= bookingEnd);
          });
          return !hasConflict;
        });
      }

      // Filter by capacity if numberOfPax provided
      if (numberOfPax > 0) {
        filteredTables = filteredTables.filter((table: any) => 
          table.capacity >= numberOfPax
        );
      }

      return c.json({
        success: true,
        date,
        availableTables: filteredTables.filter(t => t.isAvailable),
        allTables: availableTables,
        totalTables: allTables.rows.length,
        availableCount: filteredTables.filter(t => t.isAvailable).length,
      });
    } catch (error: any) {
      console.error('Error fetching table availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/cafe/tables
   * Update cafe table configuration
   * Requires 'cafe_tables' or 'reservations' capability
   */
  app.post("/vendor/:vendorId/cafe/tables", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has cafe_tables capability
      const hasCafeTablesCapability = await checkVendorCapability(vendorId, 'cafe_tables');
      const hasReservationsCapability = await checkVendorCapability(vendorId, 'reservations');
      if (!hasCafeTablesCapability && !hasReservationsCapability) {
        return c.json({ error: 'Vendor does not have cafe tables capability' }, 403);
      }
      
      const tableData = await c.req.json();
      
      // This endpoint expects an array of tables
      const tables = tableData.tables || [];
      const results = [];
      
      for (const table of tables) {
        if (table.id) {
          // Update existing table
          const updated = await update('cafe_tables',
            { id: table.id },
            {
              capacity: table.capacity,
              section: table.section,
              location: table.location,
              is_outdoor: table.isOutdoor || table.is_outdoor,
              amenities: table.amenities,
              status: table.status,
            }
          );
          if (updated.length > 0) results.push(updated[0]);
        } else {
          // Create new table
          const created = await insert('cafe_tables', {
            vendor_id: vendorId,
            table_number: table.tableNumber || table.table_number || `T-${Date.now()}`,
            capacity: table.capacity,
            section: table.section,
            location: table.location,
            is_outdoor: table.isOutdoor || table.is_outdoor || false,
            amenities: table.amenities || [],
          });
          if (created.length > 0) results.push(created[0]);
        }
      }
      
      const totalSeats = results.reduce((sum: number, table: any) => sum + (table.capacity || 0), 0);
      
      return c.json({ success: true, tables: results, totalSeats, message: 'Table configuration updated' });
    } catch (error: any) {
      console.error('Error updating cafe tables:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/cafe/tables/:tableId
   * Update a specific cafe table
   */
  app.put("/vendor/:vendorId/cafe/tables/:tableId", async (c) => {
    try {
      const { vendorId, tableId } = c.req.param();
      const tableData = await c.req.json();
      
      const updated = await update('cafe_tables', 
        { id: tableId, vendor_id: vendorId },
        {
          table_number: tableData.number || tableData.table_number,
          capacity: tableData.capacity,
          location: tableData.location,
          is_outdoor: tableData.location === 'outdoor',
          status: tableData.isAvailable ? 'available' : 'unavailable',
          is_active: tableData.isAvailable !== false,
          updated_at: new Date(),
        }
      );
      
      if (updated.length === 0) {
        return c.json({ error: 'Table not found' }, 404);
      }
      
      return c.json({ success: true, table: updated[0], message: 'Table updated successfully' });
    } catch (error: any) {
      console.error('Error updating cafe table:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/cafe/tables/:tableId
   * Delete a cafe table
   */
  app.delete("/vendor/:vendorId/cafe/tables/:tableId", async (c) => {
    try {
      const { vendorId, tableId } = c.req.param();
      
      await query(`DELETE FROM cafe_tables WHERE id = $1 AND vendor_id = $2`, [tableId, vendorId]);
      
      return c.json({ success: true, message: 'Table deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting cafe table:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/cafe/menu
   * Add a new cafe menu item
   */
  app.post("/vendor/:vendorId/cafe/menu", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const menuData = await c.req.json();
      
      const menuItem = await insert('cafe_menu_items', {
        vendor_id: vendorId,
        name: menuData.name,
        description: menuData.description,
        category: menuData.category || 'food',
        price: menuData.price || 0,
        image_url: menuData.imageUrl || menuData.image_url,
        is_pet_friendly: menuData.isPetFriendly !== false,
        is_available: menuData.isAvailable !== false,
      });
      
      return c.json({ success: true, menuItem: menuItem[0], message: 'Menu item added successfully' });
    } catch (error: any) {
      console.error('Error adding cafe menu item:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/cafe/menu/:itemId
   * Update a cafe menu item
   */
  app.put("/vendor/:vendorId/cafe/menu/:itemId", async (c) => {
    try {
      const { vendorId, itemId } = c.req.param();
      const menuData = await c.req.json();
      
      const updated = await update('cafe_menu_items', 
        { id: itemId, vendor_id: vendorId },
        {
          name: menuData.name,
          description: menuData.description,
          category: menuData.category,
          price: menuData.price,
          image_url: menuData.imageUrl || menuData.image_url,
          is_available: menuData.isAvailable !== false,
          updated_at: new Date(),
        }
      );
      
      if (updated.length === 0) {
        return c.json({ error: 'Menu item not found' }, 404);
      }
      
      return c.json({ success: true, menuItem: updated[0], message: 'Menu item updated successfully' });
    } catch (error: any) {
      console.error('Error updating cafe menu item:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/cafe/menu/:itemId
   * Delete a cafe menu item
   */
  app.delete("/vendor/:vendorId/cafe/menu/:itemId", async (c) => {
    try {
      const { vendorId, itemId } = c.req.param();
      
      await query(`DELETE FROM cafe_menu_items WHERE id = $1 AND vendor_id = $2`, [itemId, vendorId]);
      
      return c.json({ success: true, message: 'Menu item deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting cafe menu item:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/ambulance/vehicles/:vehicleId
   * Delete an ambulance vehicle
   */
  app.delete("/vendor/:vendorId/ambulance/vehicles/:vehicleId", async (c) => {
    try {
      const { vendorId, vehicleId } = c.req.param();
      
      await query(`DELETE FROM ambulance_vehicles WHERE id = $1 AND vendor_id = $2`, [vehicleId, vendorId]);
      
      return c.json({ success: true, message: 'Vehicle deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting ambulance vehicle:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/ambulance/sos-requests
   * Get SOS requests for an ambulance service
   */
  app.get("/vendor/:vendorId/ambulance/sos-requests", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      const requests = await query(`
        SELECT b.*, p.name as pet_name, p.species as pet_type, c.name as customer_name, c.phone as customer_phone
        FROM bookings b
        LEFT JOIN pets p ON b.pet_id = p.id
        LEFT JOIN customers c ON b.customer_id = c.id
        WHERE b.vendor_id = $1 
        AND b.service_type IN ('ambulance', 'pet_ambulance', 'sos')
        ORDER BY b.created_at DESC
        LIMIT 50
      `, [vendorId]).catch(() => ({ rows: [] }));
      
      return c.json({ 
        success: true, 
        requests: requests.rows.map((r: any) => ({
          id: r.id,
          customerName: r.customer_name,
          customerPhone: r.customer_phone,
          petName: r.pet_name,
          petType: r.pet_type,
          emergency: r.notes || 'Emergency request',
          pickupLocation: r.address,
          destinationLocation: r.destination_address,
          status: r.status,
          assignedVehicle: r.vehicle_id,
          createdAt: r.created_at,
        })),
        total: requests.rows.length 
      });
    } catch (error: any) {
      console.error('Error fetching SOS requests:', error);
      return c.json({ success: true, requests: [], total: 0 });
    }
  });

  /**
   * PUT /vendor/:vendorId/ambulance/sos-requests/:requestId
   * Update SOS request status
   */
  app.put("/vendor/:vendorId/ambulance/sos-requests/:requestId", async (c) => {
    try {
      const { vendorId, requestId } = c.req.param();
      const body = await c.req.json();
      
      const updateData: any = { updated_at: new Date() };
      if (body.status) updateData.status = body.status;
      if (body.assignedVehicle) updateData.vehicle_id = body.assignedVehicle;
      
      await update('bookings', { id: requestId, vendor_id: vendorId }, updateData);
      
      return c.json({ success: true, message: 'SOS request updated successfully' });
    } catch (error: any) {
      console.error('Error updating SOS request:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/resort/rooms/:roomId
   * Update a resort room
   */
  app.put("/vendor/:vendorId/resort/rooms/:roomId", async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      const roomData = await c.req.json();
      
      const updated = await update('boarding_rooms', 
        { id: roomId, vendor_id: vendorId },
        {
          room_number: roomData.number || roomData.room_number,
          room_type: roomData.type || roomData.room_type,
          capacity: roomData.capacity,
          amenities: roomData.amenities || [],
          price_per_night: roomData.pricePerNight || roomData.price_per_night,
          is_available: roomData.isAvailable !== false,
          updated_at: new Date(),
        }
      );
      
      if (updated.length === 0) {
        return c.json({ error: 'Room not found' }, 404);
      }
      
      return c.json({ success: true, room: updated[0], message: 'Room updated successfully' });
    } catch (error: any) {
      console.error('Error updating resort room:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/resort/rooms/:roomId
   * Delete a resort room
   */
  app.delete("/vendor/:vendorId/resort/rooms/:roomId", async (c) => {
    try {
      const { vendorId, roomId } = c.req.param();
      
      await query(`DELETE FROM boarding_rooms WHERE id = $1 AND vendor_id = $2`, [roomId, vendorId]);
      
      return c.json({ success: true, message: 'Room deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting resort room:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // BREEDER/ADOPTION: PET PROFILES
  // ============================================

  /**
   * GET /vendor/:vendorId/breeder/puppies
   * Get all available puppies/pets for adoption/breeding
   * Requires 'adoption' or 'pet_profiles' capability
   */
  app.get("/vendor/:vendorId/breeder/puppies", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has adoption capability
      const hasAdoptionCapability = await checkVendorCapability(vendorId, 'adoption');
      const hasPetProfilesCapability = await checkVendorCapability(vendorId, 'pet_profiles');
      if (!hasAdoptionCapability && !hasPetProfilesCapability) {
        return c.json({ error: 'Vendor does not have adoption capability' }, 403);
      }
      
      // Get pets/adoption listings - assuming a pets table with adoption listings
      const puppies = await query(`
        SELECT * FROM pets 
        WHERE vendor_id = $1 
        AND (listing_type = 'adoption' OR listing_type = 'breeding')
        ORDER BY created_at DESC
      `, [vendorId]).catch(async () => {
        // Fallback: return empty if table doesn't exist yet
        return { rows: [] };
      });
      
      return c.json({ success: true, puppies: puppies.rows, total: puppies.rows.length });
    } catch (error: any) {
      console.error('Error fetching puppies:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/breeder/puppies
   * Add a new puppy/pet profile
   * Requires 'adoption' or 'pet_profiles' capability
   */
  app.post("/vendor/:vendorId/breeder/puppies", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has adoption capability
      const hasAdoptionCapability = await checkVendorCapability(vendorId, 'adoption');
      const hasPetProfilesCapability = await checkVendorCapability(vendorId, 'pet_profiles');
      if (!hasAdoptionCapability && !hasPetProfilesCapability) {
        return c.json({ error: 'Vendor does not have adoption capability' }, 403);
      }
      
      const puppyData = await c.req.json();
      
      // Create pet listing - assuming pets table structure
      const puppy = await insert('pets', {
        vendor_id: vendorId,
        customer_id: null, // Not assigned yet
        name: puppyData.petName || puppyData.name,
        pet_type: puppyData.petType || puppyData.type || 'dog',
        breed: puppyData.breed,
        age: puppyData.age,
        age_unit: puppyData.ageUnit || puppyData.age_unit,
        gender: puppyData.gender,
        size: puppyData.size,
        color: puppyData.color,
        description: puppyData.description,
        medical_history: puppyData.medicalHistory || puppyData.medical_history,
        vaccination_status: puppyData.vaccinationStatus || puppyData.vaccination_status,
        spayed_neutered: puppyData.spayedNeutered || puppyData.spayed_neutered,
        microchipped: puppyData.microchipped,
        special_needs: puppyData.specialNeeds || puppyData.special_needs,
        photos: puppyData.photos || [],
        listing_type: puppyData.listingType || 'adoption',
        adoption_fee: puppyData.adoptionFee || puppyData.adoption_fee || 0,
        location_city: puppyData.locationCity || puppyData.location_city,
        location_state: puppyData.locationState || puppyData.location_state,
      });
      
      return c.json({ success: true, puppy: puppy[0], message: 'Puppy profile created successfully' });
    } catch (error: any) {
      console.error('Error creating puppy profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // PET RESORT/BOARDING: ROOM CONFIGURATION
  // ============================================

  /**
   * GET /vendor/:vendorId/resort/rooms
   * Get room configuration and pricing
   * Requires 'rooms' or 'boarding' capability
   */
  app.get("/vendor/:vendorId/resort/rooms", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has rooms capability
      const hasRoomsCapability = await checkVendorCapability(vendorId, 'rooms');
      const hasBoardingCapability = await checkVendorCapability(vendorId, 'boarding');
      if (!hasRoomsCapability && !hasBoardingCapability) {
        return c.json({ error: 'Vendor does not have resort rooms capability' }, 403);
      }
      
      // Check if boarding_rooms table exists
      const rooms = await query(`
        SELECT * FROM boarding_rooms 
        WHERE vendor_id = $1 
        ORDER BY created_at DESC
      `, [vendorId]).catch(async () => {
        // Fallback: return empty if table doesn't exist yet
        return { rows: [] };
      });
      
      return c.json({ success: true, rooms: rooms.rows, total: rooms.rows.length });
    } catch (error: any) {
      console.error('Error fetching resort rooms:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/resort/rooms
   * Add/update room configuration
   * Requires 'rooms' or 'boarding' capability
   */
  app.post("/vendor/:vendorId/resort/rooms", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has rooms capability
      const hasRoomsCapability = await checkVendorCapability(vendorId, 'rooms');
      const hasBoardingCapability = await checkVendorCapability(vendorId, 'boarding');
      if (!hasRoomsCapability && !hasBoardingCapability) {
        return c.json({ error: 'Vendor does not have resort rooms capability' }, 403);
      }
      
      const roomData = await c.req.json();
      
      // Check if boarding_rooms table exists, if not create it via migration first
      // For now, we'll attempt to insert/update
      let room;
      if (roomData.id) {
        // Update existing room
        const updated = await update('boarding_rooms',
          { id: roomData.id },
          {
            room_number: roomData.roomNumber || roomData.room_number,
            room_type: roomData.roomType || roomData.room_type,
            capacity: roomData.capacity,
            amenities: roomData.amenities,
            price_per_night: roomData.pricePerNight || roomData.price_per_night,
            is_available: roomData.isAvailable !== false,
          }
        );
        room = updated[0];
      } else {
        // Create new room
        const created = await insert('boarding_rooms', {
          vendor_id: vendorId,
          room_number: roomData.roomNumber || roomData.room_number || `R-${Date.now()}`,
          room_type: roomData.roomType || roomData.room_type || 'standard',
          capacity: roomData.capacity || 1,
          amenities: roomData.amenities || [],
          price_per_night: roomData.pricePerNight || roomData.price_per_night || 0,
          is_available: roomData.isAvailable !== false,
        });
        room = created[0];
      }
      
      return c.json({ success: true, room, message: 'Room configuration updated' });
    } catch (error: any) {
      console.error('Error updating resort rooms:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // TRAINING PROGRAMS
  // ============================================

  /**
   * GET /vendor/:vendorId/training/programs
   * Get all training programs
   * Requires 'training_programs' capability
   */
  app.get("/vendor/:vendorId/training/programs", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has training capability
      const hasTrainingCapability = await checkVendorCapability(vendorId, 'training_programs');
      if (!hasTrainingCapability) {
        return c.json({ error: 'Vendor does not have training programs capability' }, 403);
      }
      
      const programs = await query(`
        SELECT * FROM training_programs
        WHERE vendor_id = $1
        ORDER BY created_at DESC
      `, [vendorId]).catch(() => ({ rows: [] }));
      
      return c.json({ success: true, programs: programs.rows, total: programs.rows.length });
    } catch (error: any) {
      console.error('Error fetching training programs:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/training/programs
   * Create a new training program
   * Requires 'training_programs' capability
   */
  app.post("/vendor/:vendorId/training/programs", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has training capability
      const hasTrainingCapability = await checkVendorCapability(vendorId, 'training_programs');
      if (!hasTrainingCapability) {
        return c.json({ error: 'Vendor does not have training programs capability' }, 403);
      }
      
      const programData = await c.req.json();
      
      const program = await insert('training_programs', {
        vendor_id: vendorId,
        name: programData.name,
        description: programData.description,
        category: programData.category || 'obedience',
        duration_weeks: programData.durationWeeks || programData.duration_weeks || 4,
        sessions_per_week: programData.sessionsPerWeek || programData.sessions_per_week || 2,
        price: programData.price || 0,
        max_pets: programData.maxPets || programData.max_pets || 5,
        skill_level: programData.skillLevel || programData.skill_level || 'beginner',
        is_active: programData.isActive !== false,
      });
      
      return c.json({ success: true, program: program[0], message: 'Training program created successfully' });
    } catch (error: any) {
      console.error('Error creating training program:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/training/progress
   * Get training progress for enrolled pets
   * Requires 'progress_tracking' capability
   */
  app.get("/vendor/:vendorId/training/progress", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has progress tracking capability
      const hasProgressCapability = await checkVendorCapability(vendorId, 'progress_tracking');
      if (!hasProgressCapability) {
        return c.json({ error: 'Vendor does not have progress tracking capability' }, 403);
      }
      
      const progress = await query(`
        SELECT tp.*, p.name as pet_name, c.full_name as customer_name, trp.name as program_name
        FROM training_progress tp
        LEFT JOIN pets p ON tp.pet_id = p.id
        LEFT JOIN customers c ON tp.customer_id = c.id
        LEFT JOIN training_programs trp ON tp.program_id = trp.id
        WHERE tp.vendor_id = $1
        ORDER BY tp.updated_at DESC
      `, [vendorId]).catch(() => ({ rows: [] }));
      
      return c.json({ success: true, progress: progress.rows, total: progress.rows.length });
    } catch (error: any) {
      console.error('Error fetching training progress:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // HOLIDAY PACKAGES
  // ============================================

  /**
   * GET /vendor/:vendorId/holidays/packages
   * Get all holiday packages
   * Requires 'holiday_packages' capability
   */
  app.get("/vendor/:vendorId/holidays/packages", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has holiday capability
      const hasHolidayCapability = await checkVendorCapability(vendorId, 'holiday_packages');
      if (!hasHolidayCapability) {
        return c.json({ error: 'Vendor does not have holiday packages capability' }, 403);
      }
      
      const packages = await query(`
        SELECT * FROM holiday_packages
        WHERE vendor_id = $1
        ORDER BY created_at DESC
      `, [vendorId]).catch(() => ({ rows: [] }));
      
      return c.json({ success: true, packages: packages.rows, total: packages.rows.length });
    } catch (error: any) {
      console.error('Error fetching holiday packages:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/holidays/packages
   * Create a new holiday package
   * Requires 'holiday_packages' capability
   */
  app.post("/vendor/:vendorId/holidays/packages", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has holiday capability
      const hasHolidayCapability = await checkVendorCapability(vendorId, 'holiday_packages');
      if (!hasHolidayCapability) {
        return c.json({ error: 'Vendor does not have holiday packages capability' }, 403);
      }
      
      const packageData = await c.req.json();
      
      const pkg = await insert('holiday_packages', {
        vendor_id: vendorId,
        name: packageData.name,
        description: packageData.description,
        destination: packageData.destination,
        duration_days: packageData.durationDays || packageData.duration_days || 3,
        price: packageData.price || 0,
        max_pets: packageData.maxPets || packageData.max_pets || 10,
        pet_types_allowed: packageData.petTypesAllowed || ['dog', 'cat'],
        includes: packageData.includes || [],
        excludes: packageData.excludes || [],
        itinerary: packageData.itinerary || [],
        next_departure: packageData.nextDeparture || null,
        is_active: packageData.isActive !== false,
      });
      
      return c.json({ success: true, package: pkg[0], message: 'Holiday package created successfully' });
    } catch (error: any) {
      console.error('Error creating holiday package:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holidays/schedule
   * Get upcoming tour schedule
   * Requires 'tour_schedule' capability
   */
  app.get("/vendor/:vendorId/holidays/schedule", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check if vendor has tour schedule capability
      const hasTourCapability = await checkVendorCapability(vendorId, 'tour_schedule');
      if (!hasTourCapability) {
        return c.json({ error: 'Vendor does not have tour schedule capability' }, 403);
      }
      
      const schedule = await query(`
        SELECT hp.*, hb.departure_date, COUNT(hb.id) as booking_count
        FROM holiday_packages hp
        LEFT JOIN holiday_bookings hb ON hp.id = hb.package_id AND hb.booking_status != 'cancelled'
        WHERE hp.vendor_id = $1
        AND hp.is_active = true
        GROUP BY hp.id, hb.departure_date
        ORDER BY hp.next_departure ASC NULLS LAST
      `, [vendorId]).catch(() => ({ rows: [] }));
      
      return c.json({ success: true, schedule: schedule.rows, total: schedule.rows.length });
    } catch (error: any) {
      console.error('Error fetching tour schedule:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ========================================
  // PHOTOGRAPHY PORTFOLIO ENDPOINTS
  // ========================================

  /**
   * GET /vendor/:vendorId/photography/portfolio
   * Get photographer's portfolio items
   */
  app.get("/vendor/:vendorId/photography/portfolio", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Try to get from vendor_portfolio or vendor metadata
      const portfolio = await query(
        `SELECT * FROM vendor_portfolio 
         WHERE vendor_id = $1 AND is_active = true
         ORDER BY display_order, created_at DESC`,
        [vendorId]
      ).catch(async () => {
        // Fallback to vendor metadata if table doesn't exist
        const vendors = await select('vendors', { id: vendorId });
        const metadata = vendors[0]?.metadata || {};
        return { rows: metadata.portfolio || [] };
      });
      
      return c.json({ 
        success: true, 
        portfolio: portfolio.rows || portfolio,
        count: (portfolio.rows || portfolio).length
      });
    } catch (error: any) {
      console.error('Error fetching portfolio:', error);
      return c.json({ success: false, error: error.message, portfolio: [] }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/photography/portfolio
   * Add new portfolio item
   */
  app.post("/vendor/:vendorId/photography/portfolio", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const portfolioData = await c.req.json();
      
      // Try to insert into vendor_portfolio table
      try {
        const created = await insert('vendor_portfolio', {
          vendor_id: vendorId,
          title: portfolioData.title,
          description: portfolioData.description,
          image_url: portfolioData.imageUrl || portfolioData.image_url,
          category: portfolioData.category,
          is_featured: portfolioData.isFeatured || false,
          display_order: portfolioData.displayOrder || 0,
          is_active: true,
        });
        
        return c.json({ success: true, portfolio: created[0], message: 'Portfolio item added' });
      } catch (tableError) {
        // Fallback to vendor metadata if table doesn't exist
        console.log('vendor_portfolio table not found, using metadata');
        const vendors = await select('vendors', { id: vendorId });
        const metadata = vendors[0]?.metadata || {};
        const portfolio = metadata.portfolio || [];
        
        const newItem = {
          id: `portfolio-${Date.now()}`,
          ...portfolioData,
          createdAt: new Date().toISOString(),
        };
        portfolio.push(newItem);
        
        await query(
          `UPDATE vendors SET metadata = $2, updated_at = NOW() WHERE id = $1`,
          [vendorId, JSON.stringify({ ...metadata, portfolio })]
        );
        
        return c.json({ success: true, portfolio: newItem, message: 'Portfolio item added to metadata' });
      }
    } catch (error: any) {
      console.error('Error adding portfolio:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/photography/portfolio/:portfolioId
   * Update portfolio item
   */
  app.put("/vendor/:vendorId/photography/portfolio/:portfolioId", async (c) => {
    try {
      const { vendorId, portfolioId } = c.req.param();
      const portfolioData = await c.req.json();
      
      // Try to update in vendor_portfolio table
      try {
        const updated = await update('vendor_portfolio', 
          { id: portfolioId },
          {
            title: portfolioData.title,
            description: portfolioData.description,
            image_url: portfolioData.imageUrl || portfolioData.image_url,
            category: portfolioData.category,
            is_featured: portfolioData.isFeatured,
            display_order: portfolioData.displayOrder,
            updated_at: new Date().toISOString(),
          }
        );
        
        return c.json({ success: true, portfolio: updated[0], message: 'Portfolio item updated' });
      } catch (tableError) {
        // Fallback to vendor metadata
        console.log('vendor_portfolio table not found, using metadata');
        const vendors = await select('vendors', { id: vendorId });
        const metadata = vendors[0]?.metadata || {};
        const portfolio = metadata.portfolio || [];
        
        const index = portfolio.findIndex((p: any) => p.id === portfolioId);
        if (index >= 0) {
          portfolio[index] = { ...portfolio[index], ...portfolioData, updatedAt: new Date().toISOString() };
          
          await query(
            `UPDATE vendors SET metadata = $2, updated_at = NOW() WHERE id = $1`,
            [vendorId, JSON.stringify({ ...metadata, portfolio })]
          );
        }
        
        return c.json({ success: true, portfolio: portfolio[index], message: 'Portfolio item updated in metadata' });
      }
    } catch (error: any) {
      console.error('Error updating portfolio:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/photography/portfolio/:portfolioId
   * Delete portfolio item
   */
  app.delete("/vendor/:vendorId/photography/portfolio/:portfolioId", async (c) => {
    try {
      const { vendorId, portfolioId } = c.req.param();
      
      // Try to delete from vendor_portfolio table
      try {
        await query(
          `DELETE FROM vendor_portfolio WHERE id = $1 AND vendor_id = $2`,
          [portfolioId, vendorId]
        );
        
        return c.json({ success: true, message: 'Portfolio item deleted' });
      } catch (tableError) {
        // Fallback to vendor metadata
        const vendors = await select('vendors', { id: vendorId });
        const metadata = vendors[0]?.metadata || {};
        const portfolio = (metadata.portfolio || []).filter((p: any) => p.id !== portfolioId);
        
        await query(
          `UPDATE vendors SET metadata = $2, updated_at = NOW() WHERE id = $1`,
          [vendorId, JSON.stringify({ ...metadata, portfolio })]
        );
        
        return c.json({ success: true, message: 'Portfolio item deleted from metadata' });
      }
    } catch (error: any) {
      console.error('Error deleting portfolio:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}

