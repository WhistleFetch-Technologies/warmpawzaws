/**
 * ============================================================================
 * INSTANT TELE QUEUE ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles instant tele consultation queue for real-time video consultations:
 * - Provider "Available Now" toggle
 * - Customer queue joining
 * - Queue management (accept, skip, timeout)
 * - Real-time status updates via SSE
 * 
 * Business Rules:
 * - Only verified staff/individual providers can go "Available Now"
 * - Customers join a queue and wait for provider to accept
 * - Queue entries expire after configurable timeout (default 5 min)
 * - Provider can accept next in queue or skip
 * 
 * Date: 2026-01-17
 * ============================================================================
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { query, insert, update, select } from '../database/rds-connection';

// Queue configuration
const QUEUE_TIMEOUT_MINUTES = 5;
const MAX_QUEUE_SIZE = 20;

export function registerInstantTeleQueueEndpoints(app: Hono) {
  
  // ============================================
  // PROVIDER AVAILABILITY MANAGEMENT
  // ============================================

  /**
   * PUT /staff/:staffId/tele-availability
   * Toggle staff "Available Now" status for tele consultations
   */
  app.put("/staff/:staffId/tele-availability", async (c) => {
    try {
      const { staffId } = c.req.param();
      const body = await c.req.json();
      const { isAvailable, serviceIds } = body;

      if (isAvailable === undefined) {
        return c.json({ error: 'isAvailable is required' }, 400);
      }

      // Verify staff exists and is verified
      const staffResult = await select('staff', { id: staffId, is_active: true });
      if (staffResult.length === 0) {
        return c.json({ error: 'Staff not found or inactive' }, 404);
      }

      const staff = staffResult[0];
      
      if (!staff.mobile_verified) {
        return c.json({ 
          error: 'Mobile verification required to go live for instant tele consultations',
          requiresVerification: true 
        }, 400);
      }

      // Check if staff has tele services enabled
      const teleServicesCheck = await query(`
        SELECT ss.id, s.name as service_name, s.id as service_id
        FROM staff_services ss
        INNER JOIN services s ON ss.service_id = s.id
        WHERE ss.staff_id = $1 
          AND ss.enabled_by_staff = true 
          AND ss.is_active = true
          AND 'tele' = ANY(ss.service_styles)
      `, [staffId]);

      if (teleServicesCheck.rows.length === 0) {
        return c.json({ 
          error: 'No tele services enabled. Please enable tele services first.',
          noTeleServices: true 
        }, 400);
      }

      // Update or create availability record
      const existingAvailability = await query(`
        SELECT id FROM staff_tele_availability WHERE staff_id = $1
      `, [staffId]);

      if (existingAvailability.rows.length > 0) {
        await query(`
          UPDATE staff_tele_availability SET
            is_available = $1,
            available_services = $2,
            last_status_change = NOW(),
            updated_at = NOW()
          WHERE staff_id = $3
        `, [isAvailable, serviceIds || null, staffId]);
      } else {
        await query(`
          INSERT INTO staff_tele_availability (
            staff_id, is_available, available_services, last_status_change, created_at, updated_at
          ) VALUES ($1, $2, $3, NOW(), NOW(), NOW())
        `, [staffId, isAvailable, serviceIds || null]);
      }

      // If going offline, clear their queue entries
      if (!isAvailable) {
        await query(`
          UPDATE tele_queue SET
            status = 'provider_offline',
            resolved_at = NOW(),
            updated_at = NOW()
          WHERE staff_id = $1 AND status = 'waiting'
        `, [staffId]);
      }

      // Get available services for response
      const availableServices = teleServicesCheck.rows.map((s: any) => ({
        id: s.service_id,
        name: s.service_name,
      }));

      return c.json({
        success: true,
        isAvailable,
        availableServices,
        message: isAvailable 
          ? 'You are now available for instant tele consultations'
          : 'You are now offline for instant tele consultations',
      });
    } catch (error: any) {
      console.error('Error updating tele availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /staff/:staffId/tele-availability
   * Get staff tele availability status
   */
  app.get("/staff/:staffId/tele-availability", async (c) => {
    try {
      const { staffId } = c.req.param();

      // Handle invalid UUIDs gracefully
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId)) {
        return c.json({
          success: true,
          isAvailable: false,
          queueCount: 0,
          mobileVerified: false,
        });
      }

      // First check if staff exists
      const staffCheck = await select('staff', { id: staffId });
      if (staffCheck.length === 0) {
        // Return default response for non-existent staff (don't error)
        return c.json({
          success: true,
          isAvailable: false,
          queueCount: 0,
          mobileVerified: false,
          staffExists: false,
        });
      }

      const staff = staffCheck[0];

      // Check for tele availability status
      // Use dynamic column check for compatibility
      let teleAvailability = null;
      try {
        const result = await query(`
          SELECT 
            sta.is_available,
            sta.available_until,
            sta.last_online,
            sta.updated_at
          FROM staff_tele_availability sta
          WHERE sta.staff_id = $1
        `, [staffId]);
        
        if (result.rows.length > 0) {
          teleAvailability = result.rows[0];
        }
      } catch (e) {
        // Table might not exist, continue with default
        console.log('staff_tele_availability table query failed, using defaults');
      }

      // Get queue count if tele_queue table exists
      let queueCount = 0;
      try {
        const queueResult = await query(
          `SELECT COUNT(*) as count FROM tele_queue WHERE staff_id = $1 AND status = 'waiting'`,
          [staffId]
        );
        queueCount = parseInt(queueResult.rows[0]?.count) || 0;
      } catch (e) {
        // tele_queue table might not exist
      }

      return c.json({
        success: true,
        isAvailable: teleAvailability?.is_available || false,
        availableUntil: teleAvailability?.available_until,
        lastOnline: teleAvailability?.last_online,
        queueCount,
        mobileVerified: staff.mobile_verified || false,
        staffExists: true,
        staffName: staff.name,
      });
    } catch (error: any) {
      console.error('Error fetching tele availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // CUSTOMER QUEUE OPERATIONS
  // ============================================

  /**
   * GET /customer/tele/available-providers
   * Get list of providers currently available for instant tele consultation
   */
  app.get("/customer/tele/available-providers", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const category = c.req.query('category');
      const serviceId = c.req.query('serviceId');

      // Check if required tables and columns exist for robust query building
      const tableCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_tele_availability') as has_tele_availability,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tele_queue') as has_tele_queue,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews') as has_reviews,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'mobile_verified') as has_mobile_verified,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'photo') as has_photo,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'qualifications') as has_qualifications,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'experience_years') as has_experience_years,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_services' AND column_name = 'enabled_by_staff') as has_enabled_by_staff,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_services' AND column_name = 'service_styles') as has_service_styles,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_services' AND column_name = 'service_style') as has_service_style,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff_services' AND column_name = 'service_name') as has_service_name
      `);
      
      const {
        has_tele_availability,
        has_tele_queue,
        has_reviews,
        has_mobile_verified,
        has_photo,
        has_qualifications,
        has_experience_years,
        has_enabled_by_staff,
        has_service_styles,
        has_service_style,
        has_service_name
      } = tableCheck.rows[0] || {};

      // Build dynamic column selections based on schema availability
      const photoColumn = has_photo ? 's.photo' : 'NULL';
      const qualificationsColumn = has_qualifications ? 's.qualifications' : 'NULL';
      const experienceColumn = has_experience_years ? 's.experience_years' : 'NULL';
      const mobileVerifiedCondition = has_mobile_verified ? 'AND s.mobile_verified = true' : '';
      const queueCountSubquery = has_tele_queue 
        ? `(SELECT COUNT(*) FROM tele_queue WHERE staff_id = s.id AND status = 'waiting')` 
        : '0';
      const avgRatingSubquery = has_reviews
        ? `(SELECT AVG(rating) FROM reviews WHERE staff_id = s.id)`
        : 'NULL';
      const reviewCountSubquery = has_reviews
        ? `(SELECT COUNT(*) FROM reviews WHERE staff_id = s.id)`
        : '0';
      
      // Build service style filter
      let serviceStyleFilter: string;
      if (has_service_styles) {
        serviceStyleFilter = "'tele' = ANY(ss.service_styles)";
      } else if (has_service_style) {
        serviceStyleFilter = "ss.service_style = 'tele'";
      } else {
        serviceStyleFilter = "TRUE"; // No filter if column doesn't exist
      }
      
      // Build service name column
      const serviceNameColumn = has_service_name ? 'ss.service_name' : "'Service'";
      
      let queryText: string;
      
      if (has_tele_availability) {
        // Use the full schema with staff_tele_availability
        queryText = `
          SELECT 
            s.id as staff_id,
            s.name,
            ${photoColumn} as photo,
            s.role,
            ${experienceColumn} as experience_years,
            ${qualificationsColumn} as qualifications,
            COALESCE(v.business_name, s.name) as business_name,
            v.id as vendor_id,
            sta.last_status_change,
            sta.available_services,
            ${avgRatingSubquery} as avg_rating,
            ${reviewCountSubquery} as review_count,
            ${queueCountSubquery} as queue_count
          FROM staff s
          INNER JOIN staff_tele_availability sta ON sta.staff_id = s.id
          LEFT JOIN vendors v ON s.vendor_id = v.id
          WHERE s.is_active = true
            ${mobileVerifiedCondition}
            AND sta.is_available = true
        `;
      } else {
        // Fallback query without staff_tele_availability - check both staff_services AND vendor_services
        // This ensures staff from vendors who have published tele services are included
        queryText = `
          SELECT 
            s.id as staff_id,
            s.name,
            ${photoColumn} as photo,
            s.role,
            ${experienceColumn} as experience_years,
            ${qualificationsColumn} as qualifications,
            COALESCE(v.business_name, s.name) as business_name,
            v.id as vendor_id,
            NULL as last_status_change,
            NULL as available_services,
            ${avgRatingSubquery} as avg_rating,
            ${reviewCountSubquery} as review_count,
            ${queueCountSubquery} as queue_count
          FROM staff s
          LEFT JOIN vendors v ON s.vendor_id = v.id
          WHERE s.is_active = true
            ${mobileVerifiedCondition}
            AND (
              -- Check staff_services for tele style
              EXISTS (
                SELECT 1 FROM staff_services sst 
                WHERE sst.staff_id = s.id 
                  AND sst.is_active = true
                  AND ${serviceStyleFilter.replace(/ss\./g, 'sst.')}
              )
              OR
              -- Also check vendor_services for published tele services (linkage fallback)
              EXISTS (
                SELECT 1 FROM vendor_services vs
                WHERE vs.vendor_id = s.vendor_id
                  AND vs.is_enabled = true
                  AND vs.publish_status = 'published'
                  AND vs.service_style = 'tele'
              )
            )
        `;
      }

      const params: any[] = [];
      let paramIndex = 1;

      // Filter by role
      if (roleId) {
        // Check if roleId is a UUID or a text identifier
        const isRoleUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId);
        
        let roleQuery: string;
        if (isRoleUUID) {
          roleQuery = 'SELECT name FROM roles WHERE id = $1::uuid';
        } else {
          roleQuery = 'SELECT name FROM roles WHERE name ILIKE $1 OR name ILIKE $1 || \'%\'';
        }
        
        const roleResult = await query(roleQuery, [roleId]);
        if (roleResult.rows.length > 0) {
          queryText += ` AND s.role = $${paramIndex}`;
          params.push(roleResult.rows[0].name);
          paramIndex++;
        } else {
          // If role not found, use the roleId directly (might be role name)
          queryText += ` AND (s.role ILIKE $${paramIndex} OR s.role ILIKE '%' || $${paramIndex} || '%')`;
          params.push(roleId);
          paramIndex++;
        }
      }

      // Filter by category
      if (category) {
        const categoryRoles: Record<string, string[]> = {
          'vet': ['Veterinarian', 'veterinarian', 'vet', 'Vet', 'vet_solo', 'vet_clinic'],
          'grooming': ['Groomer', 'groomer', 'Grooming', 'grooming_solo', 'grooming_salon'],
          'training': ['Trainer', 'trainer', 'Training', 'training_solo'],
        };
        const roles = categoryRoles[category.toLowerCase()];
        if (roles) {
          queryText += ` AND s.role = ANY($${paramIndex})`;
          params.push(roles);
          paramIndex++;
        }
      }

      // Filter by specific service (using dynamic service style filter)
      if (serviceId) {
        // Check if serviceId is a UUID or a text identifier
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
        
        if (isUUID) {
          // Direct UUID comparison
          queryText += ` AND EXISTS (
            SELECT 1 FROM staff_services ss 
            WHERE ss.staff_id = s.id 
              AND ss.service_id = $${paramIndex}::uuid
              AND ss.is_active = true
              AND ${serviceStyleFilter}
          )`;
          params.push(serviceId);
          paramIndex++;
        } else {
          // Look up by text identifier - check service_catalog.service_id or services.name
          queryText += ` AND EXISTS (
            SELECT 1 FROM staff_services ss 
            WHERE ss.staff_id = s.id 
              AND ss.is_active = true
              AND ${serviceStyleFilter}
              AND (
                ss.service_id IN (SELECT sc.id FROM service_catalog sc WHERE sc.service_id = $${paramIndex})
                OR ss.service_id IN (SELECT srv.id FROM services srv WHERE srv.name ILIKE $${paramIndex} OR srv.name ILIKE '%' || $${paramIndex} || '%')
              )
          )`;
          params.push(serviceId);
          paramIndex++;
        }
      }

      queryText += ` ORDER BY queue_count ASC, avg_rating DESC NULLS LAST`;

      const result = await query(queryText, params);

      // ============================================================
      // ✅ FIX: ALSO GET SOLO VENDORS (vendors with tele services but no staff)
      // This is critical for individual practitioners who operate as vendors directly
      // ============================================================
      
      // Build vendor role filter
      let vendorRoleFilter = '';
      const vendorParams: any[] = [];
      let vendorParamIdx = 1;
      
      // ✅ FIX: Handle roleId lookup for solo vendors (consistent with staff query)
      if (roleId) {
        const isRoleUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleId);
        let resolvedRoleNames: string[] = [];
        
        if (isRoleUUID) {
          // Look up role name from roles table
          try {
            const roleResult = await query('SELECT name FROM roles WHERE id = $1::uuid', [roleId]);
            if (roleResult.rows.length > 0) {
              resolvedRoleNames = [roleResult.rows[0].name];
            }
          } catch (e) {
            console.warn('[TELE-PROVIDERS] Error looking up role by UUID:', e);
          }
        } else {
          // Use category mapping or roleId directly
        const categoryRoleMapping: Record<string, string[]> = {
          'veterinarian': ['veterinarian', 'vet', 'veterinary', 'veterinary_clinic', 'pet_clinic', 'vet_clinic', 'vet_solo'],
          'vet': ['veterinarian', 'vet', 'veterinary', 'veterinary_clinic', 'pet_clinic', 'vet_clinic', 'vet_solo'],
          'groomer': ['groomer', 'grooming', 'pet_grooming', 'groomer_solo', 'groomer_center', 'grooming_salon'],
          'trainer': ['trainer', 'training', 'pet_training', 'trainer_solo', 'trainer_center'],
        };
          resolvedRoleNames = categoryRoleMapping[roleId.toLowerCase()] || [roleId];
        }
        
        if (resolvedRoleNames.length > 0) {
          // Use case-insensitive matching for role names with parameterized query
          vendorRoleFilter = ` AND LOWER(r.name) = ANY(SELECT LOWER(unnest($${vendorParamIdx}::text[])))`;
          vendorParams.push(resolvedRoleNames);
          vendorParamIdx++;
        }
      }
      
      if (category) {
        const categoryRoleMapping: Record<string, string[]> = {
          'vet': ['veterinarian', 'vet', 'veterinary', 'veterinary_clinic', 'pet_clinic', 'vet_clinic', 'vet_solo'],
          'grooming': ['groomer', 'grooming', 'pet_grooming', 'groomer_solo', 'groomer_center', 'grooming_salon'],
          'training': ['trainer', 'training', 'pet_training', 'trainer_solo', 'trainer_center'],
        };
        const roles = categoryRoleMapping[category.toLowerCase()];
        if (roles) {
          vendorRoleFilter += ` AND LOWER(r.name) = ANY(SELECT LOWER(unnest($${vendorParamIdx}::text[])))`;
          vendorParams.push(roles);
          vendorParamIdx++;
        }
      }
      
      // Get vendor IDs that already have staff in result
      const vendorIdsWithStaff = new Set(result.rows.map((r: any) => r.vendor_id).filter(Boolean));
      
      // ✅ FIX: Add serviceId filter to solo vendor query
      let soloVendorServiceFilter = '';
      if (serviceId) {
        const isServiceUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
        if (isServiceUUID) {
          soloVendorServiceFilter = ` AND vs.service_id = $${vendorParamIdx}::uuid`;
          vendorParams.push(serviceId);
          vendorParamIdx++;
        } else {
          // Filter by service_id (text) in service_catalog or service name
          soloVendorServiceFilter = ` AND (
            vs.service_id IN (SELECT sc.id FROM service_catalog sc WHERE sc.service_id = $${vendorParamIdx})
            OR vs.service_id IN (SELECT srv.id FROM services srv WHERE srv.name ILIKE $${vendorParamIdx} OR srv.name ILIKE '%' || $${vendorParamIdx} || '%')
            OR vs.service_name ILIKE $${vendorParamIdx} OR vs.service_name ILIKE '%' || $${vendorParamIdx} || '%'
          )`;
          vendorParams.push(serviceId);
          vendorParamIdx++;
        }
      }
      
      // Query for solo vendors with published tele services
      const soloVendorQuery = `
        SELECT DISTINCT
          v.id as vendor_id,
          v.business_name,
          v.owner_name,
          v.phone,
          v.email,
          v.city,
          v.status,
          r.name as role_name,
          r.display_name as role_display_name,
          (SELECT AVG(rating) FROM reviews WHERE vendor_id = v.id) as avg_rating,
          (SELECT COUNT(*) FROM reviews WHERE vendor_id = v.id) as review_count,
          0 as queue_count
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.status = 'approved'
          AND v.is_active = true
          AND EXISTS (
            SELECT 1 FROM vendor_services vs
            WHERE vs.vendor_id = v.id
              AND vs.is_enabled = true
              AND vs.publish_status = 'published'
              AND vs.service_style = 'tele'
              ${soloVendorServiceFilter}
          )
          ${vendorRoleFilter}
      `;
      
      const soloVendorResult = await query(soloVendorQuery, vendorParams).catch((err) => {
        console.error('Error fetching solo vendors:', err);
        return { rows: [] };
      });
      
      console.log('[TELE-PROVIDERS] Found', result.rows.length, 'staff providers and', soloVendorResult.rows.length, 'solo vendors');

      // Fetch services for each staff provider
      const staffProviders = await Promise.all(result.rows.map(async (p: any) => {
        // Fetch services for this staff member
        let services: any[] = [];
        try {
          const serviceQuery = `
            SELECT 
              ss.service_id as id,
              COALESCE(srv.name, ${has_service_name ? 'ss.service_name' : "'Service'"}) as name,
              COALESCE(ss.price, srv.price, 0) as price,
              COALESCE(ss.duration_minutes, srv.duration_minutes, 30) as duration
            FROM staff_services ss
            LEFT JOIN services srv ON ss.service_id = srv.id
            WHERE ss.staff_id = $1 
              AND ss.is_active = true
              ${has_enabled_by_staff ? 'AND ss.enabled_by_staff = true' : ''}
              AND ${serviceStyleFilter}
          `;
          const svcResult = await query(serviceQuery, [p.staff_id]);
          services = svcResult.rows;
        } catch (e) {
          // If service query fails, return empty array
          console.error('Error fetching services for staff:', p.staff_id, e);
        }

        return {
          staffId: p.staff_id,
          name: p.name,
          photo: p.photo,
          role: p.role,
          experienceYears: p.experience_years,
          qualifications: p.qualifications,
          businessName: p.business_name,
          vendorId: p.vendor_id,
          rating: p.avg_rating ? parseFloat(p.avg_rating).toFixed(1) : null,
          reviewCount: parseInt(p.review_count) || 0,
          queueCount: parseInt(p.queue_count) || 0,
          estimatedWaitMinutes: (parseInt(p.queue_count) || 0) * 10, // Rough estimate: 10 min per person
          services,
          isAvailable: true,
          lastOnline: p.last_status_change,
          providerType: 'staff',
        };
      }));
      
      // Process solo vendors (vendors without staff)
      const soloVendorProviders = await Promise.all(
        soloVendorResult.rows
          .filter((v: any) => !vendorIdsWithStaff.has(v.vendor_id)) // Exclude vendors already represented by staff
          .map(async (v: any) => {
            // Fetch tele services for this vendor
            let services: any[] = [];
            try {
              const vendorServiceQuery = `
                SELECT 
                  vs.id,
                  vs.service_name as name,
                  vs.price,
                  vs.duration_minutes as duration
                FROM vendor_services vs
                WHERE vs.vendor_id = $1
                  AND vs.is_enabled = true
                  AND vs.publish_status = 'published'
                  AND vs.service_style = 'tele'
              `;
              const svcResult = await query(vendorServiceQuery, [v.vendor_id]);
              services = svcResult.rows;
            } catch (e) {
              console.error('Error fetching services for vendor:', v.vendor_id, e);
            }
            
            // For solo vendors, use vendor_id as staffId (with 'vendor_' prefix to distinguish)
            // This allows the queue system to work with vendors directly
            return {
              staffId: `vendor_${v.vendor_id}`, // Prefixed to indicate it's a vendor
              vendorId: v.vendor_id,
              name: v.owner_name || v.business_name,
              photo: null, // Vendors don't have photo in same place as staff
              role: v.role_display_name || v.role_name || 'Provider',
              experienceYears: null,
              qualifications: null,
              businessName: v.business_name,
              rating: v.avg_rating ? parseFloat(v.avg_rating).toFixed(1) : null,
              reviewCount: parseInt(v.review_count) || 0,
              queueCount: 0,
              estimatedWaitMinutes: 0,
              services,
              isAvailable: true,
              lastOnline: null,
              providerType: 'vendor', // Mark as vendor-based provider
              isSoloProvider: true,
            };
          })
      );
      
      // Combine staff and solo vendor providers
      const providers = [...staffProviders, ...soloVendorProviders];

      return c.json({
        success: true,
        providers,
        total: providers.length,
        debug: {
          staffCount: staffProviders.length,
          soloVendorCount: soloVendorProviders.length,
        }
      });
    } catch (error: any) {
      console.error('Error fetching available providers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/tele/join-queue
   * Customer joins instant tele consultation queue
   */
  app.post("/customer/tele/join-queue", async (c) => {
    try {
      const body = await c.req.json();
      const { 
        customerId, 
        staffId, 
        petId, 
        serviceId,
        symptoms,
        urgency = 'normal', // normal, urgent
        notes 
      } = body;

      if (!customerId || !staffId || !petId || !serviceId) {
        return c.json({ 
          error: 'customerId, staffId, petId, and serviceId are required' 
        }, 400);
      }
      
      // ✅ FIX: Handle solo vendors (staffId starts with 'vendor_')
      const isSoloVendor = typeof staffId === 'string' && staffId.toLowerCase().startsWith('vendor_');
      const actualVendorId = isSoloVendor ? staffId.replace(/^vendor_/i, '') : null;
      const actualStaffId = isSoloVendor ? null : staffId;
      
      // Validate extracted vendor ID is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (isSoloVendor) {
        if (!actualVendorId || !uuidRegex.test(actualVendorId)) {
          return c.json({ 
            error: `Invalid vendor ID format. Expected UUID after 'vendor_' prefix`,
            received: staffId,
            extracted: actualVendorId
          }, 400);
        }
      } else {
        // Validate staffId is a valid UUID
        if (!actualStaffId || !uuidRegex.test(actualStaffId)) {
          return c.json({ 
            error: `Invalid staff ID format. Expected UUID`,
            received: staffId
          }, 400);
        }
      }
      
      console.log('[TELE-QUEUE] Join queue request:', {
        isSoloVendor,
        originalStaffId: staffId,
        actualVendorId,
        actualStaffId,
        serviceId
      });

      // Resolve serviceId to UUID if it's a text identifier
      let resolvedServiceId = serviceId;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
      
      if (!isUUID) {
        // Look up service by text identifier - check vendor_services first for solo vendors
        let serviceResolve;
        if (isSoloVendor && actualVendorId) {
          serviceResolve = await query(`
            SELECT id FROM vendor_services 
            WHERE vendor_id = $1 AND service_style = 'tele' AND is_enabled = true AND publish_status = 'published'
            LIMIT 1
          `, [actualVendorId]);
        }
        
        if (!serviceResolve || serviceResolve.rows.length === 0) {
          serviceResolve = await query(`
            SELECT id FROM service_catalog WHERE service_id = $1
            UNION
            SELECT id FROM services WHERE name ILIKE $1 OR name ILIKE '%' || $1 || '%'
            LIMIT 1
          `, [serviceId]);
        }
        
        if (serviceResolve.rows.length > 0) {
          resolvedServiceId = serviceResolve.rows[0].id;
        } else {
          return c.json({ 
            error: `Service not found: ${serviceId}` 
          }, 404);
        }
      }

      // Verify provider is available
      // ✅ FIX: For solo vendors, check vendor_services instead of staff_tele_availability
      if (isSoloVendor) {
        const vendorCheck = await query(`
          SELECT v.id, v.is_active, v.status
          FROM vendors v
          WHERE v.id = $1 AND v.is_active = true AND v.status = 'approved'
          AND EXISTS (
            SELECT 1 FROM vendor_services vs
            WHERE vs.vendor_id = v.id AND vs.service_style = 'tele' 
            AND vs.is_enabled = true AND vs.publish_status = 'published'
          )
        `, [actualVendorId]);
        
        if (vendorCheck.rows.length === 0) {
          return c.json({ 
            error: 'Provider is not currently available for instant consultations',
            providerOffline: true 
          }, 400);
        }
      } else if (actualStaffId) {
        // Original staff-based check - use actualStaffId (never use prefixed staffId)
        const availabilityCheck = await query(`
          SELECT is_available FROM staff_tele_availability 
          WHERE staff_id = $1 AND is_available = true
        `, [actualStaffId]).catch(() => ({ rows: [] }));

        // If no explicit availability set, check if staff has tele services enabled
        if (availabilityCheck.rows.length === 0) {
          const staffServiceCheck = await query(`
            SELECT 1 FROM staff s
            LEFT JOIN staff_services ss ON ss.staff_id = s.id
            LEFT JOIN vendor_services vs ON vs.vendor_id = s.vendor_id
            WHERE s.id = $1 AND s.is_active = true
            AND (
              (ss.is_active = true AND 'tele' = ANY(ss.service_styles))
              OR (vs.is_enabled = true AND vs.publish_status = 'published' AND vs.service_style = 'tele')
            )
          `, [actualStaffId]);
          
          if (staffServiceCheck.rows.length === 0) {
            return c.json({ 
              error: 'Provider is not currently available for instant consultations',
              providerOffline: true 
            }, 400);
          }
        }
      }

      // Check if customer already has active queue entry for this provider
      // ✅ FIX: Handle both staff and vendor providers - use actualStaffId (never prefixed staffId)
      const queueStaffId = isSoloVendor ? null : actualStaffId;
      const queueVendorId = isSoloVendor ? actualVendorId : null;
      const existingQueue = await query(`
        SELECT id, position, status FROM tele_queue 
        WHERE customer_id = $1 
          AND (staff_id = $2 OR vendor_id = $3)
          AND status = 'waiting'
      `, [customerId, queueStaffId, queueVendorId]);

      if (existingQueue.rows.length > 0) {
        return c.json({
          success: true,
          alreadyInQueue: true,
          queueEntry: {
            id: existingQueue.rows[0].id,
            position: existingQueue.rows[0].position,
            status: existingQueue.rows[0].status,
          },
          message: 'You are already in queue for this provider',
        });
      }

      // Get current queue position
      // ✅ FIX: Handle both staff and vendor providers
      const queuePositionResult = await query(`
        SELECT COALESCE(MAX(position), 0) + 1 as next_position
        FROM tele_queue
        WHERE (staff_id = $1 OR vendor_id = $2) AND status = 'waiting'
      `, [queueStaffId, queueVendorId]);

      const position = queuePositionResult.rows[0].next_position;

      // Check queue size limit
      if (position > MAX_QUEUE_SIZE) {
        return c.json({ 
          error: 'Queue is full. Please try again later.',
          queueFull: true 
        }, 400);
      }

      // Get service details - different query for solo vendors vs staff
      let serviceDetails: any = {};
      
      if (isSoloVendor && actualVendorId) {
        // ✅ FIX: For solo vendors, get service from vendor_services
        const vendorServiceResult = await query(`
          SELECT 
            vs.price, 
            vs.duration_minutes,
            vs.service_name
          FROM vendor_services vs
          WHERE vs.vendor_id = $1 
            AND vs.service_style = 'tele'
            AND vs.is_enabled = true 
            AND vs.publish_status = 'published'
          LIMIT 1
        `, [actualVendorId]);
        
        serviceDetails = vendorServiceResult.rows[0] || {};
      } else if (actualStaffId) {
        // Original staff-based query - use actualStaffId (never use prefixed staffId)
        const serviceResult = await query(`
          SELECT 
            ss.price, 
            ss.duration_minutes,
            s.name as service_name
          FROM staff_services ss
          INNER JOIN services s ON ss.service_id = s.id
          WHERE ss.staff_id = $1 AND ss.service_id = $2::uuid
        `, [actualStaffId, resolvedServiceId]).catch(() => ({ rows: [] }));

        serviceDetails = serviceResult.rows[0] || {};
        
        // Fallback: Try vendor_services if staff_services didn't have results
        if (!serviceDetails.service_name) {
          const staffResult = await select('staff', { id: actualStaffId });
          if (staffResult.length > 0 && staffResult[0].vendor_id) {
            const vendorServiceResult = await query(`
              SELECT 
                vs.price, 
                vs.duration_minutes,
                vs.service_name
              FROM vendor_services vs
              WHERE vs.vendor_id = $1 
                AND vs.service_style = 'tele'
                AND vs.is_enabled = true 
                AND vs.publish_status = 'published'
              LIMIT 1
            `, [staffResult[0].vendor_id]);
            serviceDetails = vendorServiceResult.rows[0] || serviceDetails;
          }
        }
      }

      // Calculate expiry time
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + QUEUE_TIMEOUT_MINUTES);

      // ✅ FIX: Store vendor_id for solo vendors, determine actual vendor ID
      let vendorIdForQueue = actualVendorId;
      if (!isSoloVendor && actualStaffId) {
        const staffVendor = await select('staff', { id: actualStaffId });
        vendorIdForQueue = staffVendor.length > 0 ? staffVendor[0].vendor_id : null;
      }

      // Create queue entry with resolved service ID
      // ✅ FIX: Use vendor_id for solo vendors, staff_id for staff providers
      const queueEntry = await query(`
        INSERT INTO tele_queue (
          customer_id, staff_id, vendor_id, pet_id, service_id,
          position, status, symptoms, urgency, notes,
          price, service_name, duration_minutes,
          expires_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'waiting', $7, $8, $9,
          $10, $11, $12, $13, NOW(), NOW()
        )
        RETURNING *
      `, [
        customerId, 
        isSoloVendor ? null : queueStaffId, // staff_id: null for solo vendors
        isSoloVendor ? actualVendorId : null, // vendor_id: set for solo vendors
        petId, 
        resolvedServiceId,
        position, 
        symptoms || null, 
        urgency, 
        notes || null,
        serviceDetails.price || 0, 
        serviceDetails.service_name || 'Tele-Consultation', 
        serviceDetails.duration_minutes || 30,
        expiresAt
      ]);

      // Get customer and pet info for notification
      const customerResult = await select('customers', { id: customerId });
      const petResult = await select('pets', { id: petId });

      return c.json({
        success: true,
        queueEntry: {
          id: queueEntry.rows[0].id,
          position,
          status: 'waiting',
          expiresAt,
          estimatedWaitMinutes: position * 10, // Rough estimate
        },
        service: {
          name: serviceDetails.service_name || 'Tele-Consultation',
          price: serviceDetails.price || 0,
          durationMinutes: serviceDetails.duration_minutes || 30,
        },
        isSoloVendor,
        vendorId: vendorIdForQueue,
        message: `You are #${position} in queue. Estimated wait: ${position * 10} minutes.`,
      });
    } catch (error: any) {
      console.error('Error joining tele queue:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /customer/tele/leave-queue/:queueId
   * Customer leaves the queue
   */
  app.delete("/customer/tele/leave-queue/:queueId", async (c) => {
    try {
      const { queueId } = c.req.param();

      await query(`
        UPDATE tele_queue SET
          status = 'cancelled',
          resolved_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND status = 'waiting'
      `, [queueId]);

      return c.json({
        success: true,
        message: 'You have left the queue',
      });
    } catch (error: any) {
      console.error('Error leaving queue:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/tele/queue-status/:queueId
   * Get customer's queue status
   */
  app.get("/customer/tele/queue-status/:queueId", async (c) => {
    try {
      const { queueId } = c.req.param();

      // ✅ FIX: Handle both staff and vendor providers
      const result = await query(`
        SELECT 
          tq.*,
          COALESCE(s.name, v.owner_name, v.business_name) as provider_name,
          COALESCE(s.photo, s.photo_url, NULL) as provider_photo,
          COALESCE(s.phone, v.phone) as provider_phone,
          CASE 
            WHEN tq.staff_id IS NOT NULL THEN 'staff'
            WHEN tq.vendor_id IS NOT NULL THEN 'vendor'
            ELSE 'unknown'
          END as provider_type,
          (
            SELECT COUNT(*) FROM tele_queue 
            WHERE (staff_id = tq.staff_id OR vendor_id = tq.vendor_id)
              AND status = 'waiting' 
              AND position < tq.position
          ) as ahead_in_queue
        FROM tele_queue tq
        LEFT JOIN staff s ON tq.staff_id = s.id
        LEFT JOIN vendors v ON tq.vendor_id = v.id
        WHERE tq.id = $1
      `, [queueId]);

      if (result.rows.length === 0) {
        return c.json({ error: 'Queue entry not found' }, 404);
      }

      const queueEntry = result.rows[0];

      // Check if expired
      if (queueEntry.status === 'waiting' && new Date(queueEntry.expires_at) < new Date()) {
        await query(`
          UPDATE tele_queue SET status = 'expired', resolved_at = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [queueId]);
        queueEntry.status = 'expired';
      }

      return c.json({
        success: true,
        queueEntry: {
          id: queueEntry.id,
          position: queueEntry.position,
          aheadInQueue: parseInt(queueEntry.ahead_in_queue) || 0,
          status: queueEntry.status,
          expiresAt: queueEntry.expires_at,
          estimatedWaitMinutes: (parseInt(queueEntry.ahead_in_queue) || 0) * 10,
          service: {
            name: queueEntry.service_name,
            price: queueEntry.price,
            durationMinutes: queueEntry.duration_minutes,
          },
          provider: {
            id: queueEntry.staff_id || queueEntry.vendor_id,
            type: queueEntry.provider_type,
            name: queueEntry.provider_name,
            photo: queueEntry.provider_photo,
          },
          // Keep staff for backward compatibility
          staff: {
            id: queueEntry.staff_id,
            name: queueEntry.provider_name,
            photo: queueEntry.provider_photo,
          },
          bookingId: queueEntry.booking_id, // Set when accepted
          meetingId: queueEntry.meeting_id, // Set when call starts
        },
      });
    } catch (error: any) {
      console.error('Error fetching queue status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // PROVIDER QUEUE MANAGEMENT
  // ============================================

  /**
   * GET /staff/:staffId/tele-queue
   * Get provider's current queue
   */
  app.get("/staff/:staffId/tele-queue", async (c) => {
    try {
      const { staffId } = c.req.param();

      const result = await query(`
        SELECT 
          tq.*,
          c.name as customer_name,
          c.phone as customer_phone,
          c.photo_url as customer_photo,
          p.name as pet_name,
          p.type as pet_type,
          p.breed as pet_breed,
          p.age_years as pet_age
        FROM tele_queue tq
        INNER JOIN customers c ON tq.customer_id = c.id
        INNER JOIN pets p ON tq.pet_id = p.id
        WHERE tq.staff_id = $1 AND tq.status = 'waiting'
        ORDER BY tq.urgency DESC, tq.position ASC
      `, [staffId]);

      // Clean up expired entries
      await query(`
        UPDATE tele_queue SET 
          status = 'expired', 
          resolved_at = NOW(), 
          updated_at = NOW()
        WHERE staff_id = $1 
          AND status = 'waiting' 
          AND expires_at < NOW()
      `, [staffId]);

      const queue = result.rows
        .filter((q: any) => new Date(q.expires_at) >= new Date())
        .map((q: any) => ({
          id: q.id,
          position: q.position,
          customer: {
            id: q.customer_id,
            name: q.customer_name,
            phone: q.customer_phone,
            photo: q.customer_photo,
          },
          pet: {
            id: q.pet_id,
            name: q.pet_name,
            type: q.pet_type,
            breed: q.pet_breed,
            age: q.pet_age,
          },
          service: {
            id: q.service_id,
            name: q.service_name,
            price: q.price,
            durationMinutes: q.duration_minutes,
          },
          symptoms: q.symptoms,
          urgency: q.urgency,
          notes: q.notes,
          waitingSince: q.created_at,
          expiresAt: q.expires_at,
          timeInQueue: Math.floor((Date.now() - new Date(q.created_at).getTime()) / 60000), // minutes
        }));

      return c.json({
        success: true,
        queue,
        total: queue.length,
      });
    } catch (error: any) {
      console.error('Error fetching staff queue:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /staff/:staffId/tele-queue/:queueId/accept
   * Accept customer from queue and create booking
   */
  app.post("/staff/:staffId/tele-queue/:queueId/accept", async (c) => {
    try {
      const { staffId, queueId } = c.req.param();

      // Get queue entry
      const queueResult = await query(`
        SELECT * FROM tele_queue WHERE id = $1 AND staff_id = $2 AND status = 'waiting'
      `, [queueId, staffId]);

      if (queueResult.rows.length === 0) {
        return c.json({ error: 'Queue entry not found or already processed' }, 404);
      }

      const queueEntry = queueResult.rows[0];

      // Check if expired
      if (new Date(queueEntry.expires_at) < new Date()) {
        await query(`
          UPDATE tele_queue SET status = 'expired', resolved_at = NOW() WHERE id = $1
        `, [queueId]);
        return c.json({ error: 'Queue entry has expired' }, 400);
      }

      // Get staff vendor_id
      const staffResult = await select('staff', { id: staffId });
      const vendorId = staffResult[0]?.vendor_id;

      // Create instant booking with pending_payment status
      // ✅ FIX: Booking should be pending_payment until payment is verified
      const bookingResult = await query(`
        INSERT INTO bookings (
          customer_id, vendor_id, staff_id, service_id, pet_id,
          service_type, booking_date, booking_time,
          total_amount, status, payment_status, notes, is_instant_tele,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          'tele', CURRENT_DATE, CURRENT_TIME,
          $6, 'pending_payment', 'pending', $7, true,
          NOW(), NOW()
        )
        RETURNING *
      `, [
        queueEntry.customer_id,
        vendorId,
        staffId,
        queueEntry.service_id,
        queueEntry.pet_id,
        queueEntry.price || 0,
        queueEntry.symptoms || queueEntry.notes
      ]);

      const booking = bookingResult.rows[0];

      // Update queue entry
      await query(`
        UPDATE tele_queue SET
          status = 'accepted',
          booking_id = $1,
          resolved_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [booking.id, queueId]);

      // Update positions for remaining queue
      await query(`
        UPDATE tele_queue SET
          position = position - 1,
          updated_at = NOW()
        WHERE staff_id = $1 
          AND status = 'waiting' 
          AND position > $2
      `, [staffId, queueEntry.position]);

      // ✅ CRITICAL FIX: Create video call meeting when queue is accepted
      // Use the video-call endpoint to create meeting properly
      let meetingId: string | null = null;
      try {
        // Create meeting via video call endpoint (will create Chime meeting)
        // Note: This should ideally call the video-call endpoint, but for now we'll create session record
        // The actual Chime meeting will be created when user joins
        const meetingResponse = await insert('video_call_sessions', {
          booking_id: booking.id,
          customer_id: queueEntry.customer_id,
          vendor_id: vendorId,
          staff_id: staffId,
          status: 'waiting',
          created_at: new Date().toISOString(),
        }).catch(() => []);
        
        if (meetingResponse && meetingResponse.length > 0) {
          meetingId = meetingResponse[0].meeting_id || meetingResponse[0].id;
        }
      } catch (error) {
        console.warn('Could not create video call meeting:', error);
        // Continue without meeting ID - can be created later when user joins
      }

      // ✅ CRITICAL FIX: Send call notification to customer (like phone ringing)
      try {
        // Use correct column names: recipient_id and recipient_type (not user_id/user_type)
        await insert('notifications', {
          recipient_id: queueEntry.customer_id,
          recipient_type: 'customer',
          type: 'tele_call_incoming',
          title: '📞 Incoming Video Call',
          message: `${staffResult[0]?.name || 'Provider'} is calling you for ${queueEntry.service_name || 'consultation'}`,
          data: JSON.stringify({
            booking_id: booking.id,
            meeting_id: meetingId,
            staff_id: staffId,
            staff_name: staffResult[0]?.name,
            call_type: 'incoming',
            action: 'answer_call',
          }),
          is_read: false,
          requires_action: true,
          action_url: `/video/${booking.id}`,
          created_at: new Date(),
        });
      } catch (error) {
        console.warn('Could not send call notification:', error);
      }

      return c.json({
        success: true,
        booking: {
          id: booking.id,
          customerId: booking.customer_id,
          petId: booking.pet_id,
          serviceId: booking.service_id,
          status: booking.status,
          totalAmount: booking.total_amount,
          meetingId: meetingId, // ✅ CRITICAL FIX: Include meeting ID
        },
        meetingId: meetingId, // ✅ CRITICAL FIX: Include in response
        message: 'Customer accepted. Booking created. Ready to start video call.',
      });
    } catch (error: any) {
      console.error('Error accepting queue entry:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /staff/:staffId/tele-queue/:queueId/skip
   * Skip customer in queue (move to end or remove)
   */
  app.post("/staff/:staffId/tele-queue/:queueId/skip", async (c) => {
    try {
      const { staffId, queueId } = c.req.param();
      const body = await c.req.json();
      const { reason, removeFromQueue = false } = body;

      if (removeFromQueue) {
        // Remove from queue entirely
        await query(`
          UPDATE tele_queue SET
            status = 'skipped',
            skip_reason = $1,
            resolved_at = NOW(),
            updated_at = NOW()
          WHERE id = $2 AND staff_id = $3
        `, [reason, queueId, staffId]);
      } else {
        // Move to end of queue
        const maxPositionResult = await query(`
          SELECT COALESCE(MAX(position), 0) + 1 as next_position
          FROM tele_queue
          WHERE staff_id = $1 AND status = 'waiting'
        `, [staffId]);

        await query(`
          UPDATE tele_queue SET
            position = $1,
            updated_at = NOW()
          WHERE id = $2 AND staff_id = $3
        `, [maxPositionResult.rows[0].next_position, queueId, staffId]);
      }

      return c.json({
        success: true,
        message: removeFromQueue ? 'Customer removed from queue' : 'Customer moved to end of queue',
      });
    } catch (error: any) {
      console.error('Error skipping queue entry:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // REAL-TIME QUEUE UPDATES (SSE)
  // ============================================

  /**
   * GET /customer/tele/queue-stream/:queueId
   * SSE stream for customer to get real-time queue updates
   */
  app.get("/customer/tele/queue-stream/:queueId", async (c) => {
    const queueId = c.req.param('queueId');

    if (!queueId) {
      return c.json({ error: 'Queue ID is required' }, 400);
    }

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
      let isActive = true;
      let lastStatus = '';
      let lastPosition = -1;
      
      // Track intervals for proper cleanup
      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
      let pollInterval: ReturnType<typeof setInterval> | null = null;
      
      // Cleanup function to ensure all intervals are cleared
      const cleanup = () => {
        isActive = false;
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        console.log(`[TeleQueue] Cleaned up intervals for queue ${queueId}`);
      };

      // Send initial connection
      try {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'connected',
            message: 'Queue stream connected',
            timestamp: new Date().toISOString(),
          }),
          event: 'connection',
        });
      } catch (err) {
        console.warn(`[TeleQueue] Failed to send initial connection for ${queueId}:`, err);
        cleanup();
        return;
      }

      // Heartbeat
      heartbeatInterval = setInterval(async () => {
        if (isActive) {
          try {
            await stream.writeSSE({
              data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
              event: 'heartbeat',
            });
          } catch {
            isActive = false;
          }
        }
      }, 30000);

      // Poll for updates
      pollInterval = setInterval(async () => {
        if (!isActive) {
          cleanup();
          return;
        }

        try {
          const result = await query(`
            SELECT 
              tq.*,
              s.name as staff_name,
              (
                SELECT COUNT(*) FROM tele_queue 
                WHERE staff_id = tq.staff_id 
                  AND status = 'waiting' 
                  AND position < tq.position
              ) as ahead_in_queue
            FROM tele_queue tq
            INNER JOIN staff s ON tq.staff_id = s.id
            WHERE tq.id = $1
          `, [queueId]);

          if (result.rows.length === 0) {
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'error',
                message: 'Queue entry not found',
                timestamp: new Date().toISOString(),
              }),
              event: 'error',
            });
            isActive = false;
            return;
          }

          const queueEntry = result.rows[0];
          const currentPosition = parseInt(queueEntry.ahead_in_queue) + 1;

          // Check for changes
          if (queueEntry.status !== lastStatus || currentPosition !== lastPosition) {
            lastStatus = queueEntry.status;
            lastPosition = currentPosition;

            // Send update
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'queue_update',
                queueEntry: {
                  id: queueEntry.id,
                  position: currentPosition,
                  aheadInQueue: parseInt(queueEntry.ahead_in_queue) || 0,
                  status: queueEntry.status,
                  expiresAt: queueEntry.expires_at,
                  estimatedWaitMinutes: (parseInt(queueEntry.ahead_in_queue) || 0) * 10,
                  bookingId: queueEntry.booking_id,
                  meetingId: queueEntry.meeting_id,
                  staffName: queueEntry.staff_name,
                },
                timestamp: new Date().toISOString(),
              }),
              event: 'queue_update',
            });

            // If accepted, send special notification
            if (queueEntry.status === 'accepted' && queueEntry.booking_id) {
              await stream.writeSSE({
                data: JSON.stringify({
                  type: 'accepted',
                  bookingId: queueEntry.booking_id,
                  message: 'Your consultation has been accepted! Preparing video call...',
                  timestamp: new Date().toISOString(),
                }),
                event: 'accepted',
              });
              
              // Keep connection for a bit to ensure client receives, then close
              setTimeout(() => { isActive = false; }, 5000);
            }

            // If expired or cancelled
            if (['expired', 'cancelled', 'skipped', 'provider_offline'].includes(queueEntry.status)) {
              await stream.writeSSE({
                data: JSON.stringify({
                  type: 'ended',
                  reason: queueEntry.status,
                  message: queueEntry.status === 'expired' 
                    ? 'Queue entry expired. Please try again.'
                    : queueEntry.status === 'provider_offline'
                    ? 'Provider went offline. Please try another provider.'
                    : 'Queue entry ended.',
                  timestamp: new Date().toISOString(),
                }),
                event: 'ended',
              });
              isActive = false;
            }
          }
        } catch (error: any) {
          console.error('Error in queue stream:', error);
        }
      }, 2000); // Poll every 2 seconds

      // Register cleanup on request abort
      c.req.raw.signal?.addEventListener('abort', cleanup);
      
      // Ensure cleanup even if stream errors
      stream.onAbort?.(() => {
        cleanup();
      });
    });
  });

  /**
   * GET /bookings/:bookingId/queue-position
   * Get queue position for a booking (customer-facing)
   */
  app.get("/bookings/:bookingId/queue-position", async (c) => {
    try {
      const { bookingId } = c.req.param();

      // Get queue entry by booking_id
      const queueResult = await query(`
        SELECT 
          tq.*,
          s.name as staff_name,
          COALESCE(s.photo, s.photo_url) as staff_photo,
          v.business_name as vendor_name,
          (
            SELECT COUNT(*) 
            FROM tele_queue 
            WHERE staff_id = tq.staff_id 
              AND status = 'waiting' 
              AND position < tq.position
          ) as ahead_in_queue
        FROM tele_queue tq
        LEFT JOIN staff s ON tq.staff_id = s.id
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE tq.booking_id = $1
          AND tq.status IN ('waiting', 'in_progress')
        ORDER BY tq.created_at DESC
        LIMIT 1
      `, [bookingId]);

      if (queueResult.rows.length === 0) {
        return c.json({ 
          success: false,
          error: 'No active queue entry found for this booking',
          queuePosition: null,
          estimatedWaitTime: null,
        }, 404);
      }

      const queueEntry = queueResult.rows[0];
      const position = parseInt(queueEntry.ahead_in_queue) + 1;
      const estimatedWaitTime = parseInt(queueEntry.ahead_in_queue) * 10; // Rough estimate: 10 min per person

      return c.json({
        success: true,
        queuePosition: position,
        estimatedWaitTime,
        totalInQueue: parseInt(queueEntry.ahead_in_queue) + 1,
        status: queueEntry.status,
        staffName: queueEntry.staff_name,
        vendorName: queueEntry.vendor_name,
        expiresAt: queueEntry.expires_at,
      });
    } catch (error: any) {
      console.error('Error fetching queue position:', error);
      return c.json({ 
        success: false,
        error: error.message,
        queuePosition: null,
        estimatedWaitTime: null,
      }, 500);
    }
  });

  /**
   * GET /staff/:staffId/tele-queue-stream
   * SSE stream for provider to get real-time queue updates
   */
  app.get("/staff/:staffId/tele-queue-stream", async (c) => {
    const staffId = c.req.param('staffId');

    if (!staffId) {
      return c.json({ error: 'Staff ID is required' }, 400);
    }

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
      let isActive = true;
      let lastQueueHash = '';
      
      // Track intervals for proper cleanup
      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
      let pollInterval: ReturnType<typeof setInterval> | null = null;
      
      // Cleanup function to ensure all intervals are cleared
      const cleanup = () => {
        isActive = false;
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        console.log(`[TeleQueue] Cleaned up intervals for staff ${staffId}`);
      };

      try {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'connected',
            message: 'Queue stream connected',
            timestamp: new Date().toISOString(),
          }),
          event: 'connection',
        });
      } catch (err) {
        console.warn(`[TeleQueue] Failed to send initial connection for staff ${staffId}:`, err);
        cleanup();
        return;
      }

      heartbeatInterval = setInterval(async () => {
        if (isActive) {
          try {
            await stream.writeSSE({
              data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
              event: 'heartbeat',
            });
          } catch {
            isActive = false;
          }
        }
      }, 30000);

      pollInterval = setInterval(async () => {
        if (!isActive) {
          cleanup();
          return;
        }

        try {
          // Clean expired entries
          await query(`
            UPDATE tele_queue SET status = 'expired', resolved_at = NOW()
            WHERE staff_id = $1 AND status = 'waiting' AND expires_at < NOW()
          `, [staffId]);

          const result = await query(`
            SELECT 
              tq.*,
              c.name as customer_name,
              c.phone as customer_phone,
              p.name as pet_name,
              p.type as pet_type
            FROM tele_queue tq
            INNER JOIN customers c ON tq.customer_id = c.id
            INNER JOIN pets p ON tq.pet_id = p.id
            WHERE tq.staff_id = $1 AND tq.status = 'waiting'
            ORDER BY tq.urgency DESC, tq.position ASC
          `, [staffId]);

          const queueHash = JSON.stringify(result.rows.map((r: any) => r.id));

          if (queueHash !== lastQueueHash) {
            lastQueueHash = queueHash;

            const queue = result.rows.map((q: any) => ({
              id: q.id,
              position: q.position,
              customer: {
                id: q.customer_id,
                name: q.customer_name,
                phone: q.customer_phone,
              },
              pet: {
                id: q.pet_id,
                name: q.pet_name,
                type: q.pet_type,
              },
              service: {
                name: q.service_name,
                price: q.price,
              },
              symptoms: q.symptoms,
              urgency: q.urgency,
              waitingSince: q.created_at,
              timeInQueue: Math.floor((Date.now() - new Date(q.created_at).getTime()) / 60000),
            }));

            await stream.writeSSE({
              data: JSON.stringify({
                type: 'queue_update',
                queue,
                total: queue.length,
                timestamp: new Date().toISOString(),
              }),
              event: 'queue_update',
            });
          }
        } catch (error: any) {
          console.error('Error in staff queue stream:', error);
        }
      }, 2000);

      // Register cleanup on request abort
      c.req.raw.signal?.addEventListener('abort', cleanup);
      
      // Ensure cleanup even if stream errors
      stream.onAbort?.(() => {
        cleanup();
      });
    });
  });

  console.log('✅ Instant Tele Queue endpoints registered');
}
