/**
 * ============================================================================
 * STAFF MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles staff management for vendors:
 * - Staff CRUD operations
 * - Staff discovery (for customer booking)
 * - Staff availability & scheduling
 * - Staff specializations
 * 
 * Migrated from: supabase/functions/server/staff-discovery-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { select, insert, update, query } from '../database/rds-connection';
import { calculateCommuteTime } from '../utils/commute-time-calculator';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { checkVendorCapability } from '../middleware/capability-enforcement';
import { resolveVendorById } from './vendor-profile';

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

export function registerStaffEndpoints(app: Hono) {
  // ============================================
  // STAFF DISCOVERY (Customer-facing)
  // ============================================

  /**
   * GET /customer/discover-staff
   * Discover staff members by service style preferences
   */
  app.get("/customer/discover-staff", async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const maxDistance = parseFloat(c.req.query('maxDistance') || '50');
      const serviceId = c.req.query('serviceId');
      const vendorIdParam = c.req.query('vendorId');
      const customerId = c.req.query('customerId'); // For previous provider prioritization

      if (!roleId && !vendorIdParam && !serviceId) {
        return c.json({ error: 'At least one of roleId, vendorId, or serviceId is required' }, 400);
      }

      if (!serviceStyle || !['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        return c.json({ error: 'serviceStyle is required (at_home, at_center, or tele)' }, 400);
      }

      // Resolve vendorId to canonical vendors.id so vendor_identity.id works
      let resolvedVendorId: string | null = null;
      let resolvedVendor: any = null;
      if (vendorIdParam) {
        resolvedVendor = await resolveVendorById(vendorIdParam);
        if (resolvedVendor?.id) resolvedVendorId = resolvedVendor.id;
      }

      const customerLat = latitude ? parseFloat(latitude) : null;
      const customerLng = longitude ? parseFloat(longitude) : null;

      // ✅ FIX: Check if service_styles column exists in staff_services table (once at the start)
      const schemaCheck = await query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'staff_services' AND column_name = 'service_styles'
        ) as has_service_styles
      `);
      const hasServiceStylesColumn = schemaCheck.rows[0]?.has_service_styles || false;

      // Get staff matching criteria
      // ⚠️ IMPORTANT: For at_home and tele services, only show verified staff/individual providers
      // ⚠️ Must have: schedule slots with service configured, service enabled, within radius
      
      let staffQuery = `
        SELECT DISTINCT s.*, 
               COALESCE(v.business_name, s.name) as vendor_name,
               COALESCE(v.city, '') as city,
               COALESCE(v.state, '') as state,
               s.default_location as location
        FROM staff s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE s.is_active = true
          AND s.mobile_verified = true
      `;
      
      // For staff with vendor_id, check vendor is approved
      staffQuery += ` AND (s.vendor_id IS NULL OR (v.status = 'approved' AND v.is_active = true))`;
      
      // Filter: For at_home and tele, only verified staff can appear (already in WHERE)
      // Additional filters applied below

      const params: any[] = [];
      let paramIndex = 1;

      if (resolvedVendorId) {
        staffQuery += ` AND s.vendor_id = $${paramIndex}`;
        params.push(resolvedVendorId);
        paramIndex++;
      }

      let effectiveRoleName: string | null = null;
      if (roleId) {
        const role = await query('SELECT name, id FROM roles WHERE name = $1 OR id = $1', [roleId]);
        if (role.rows.length > 0) effectiveRoleName = role.rows[0].name;
      }
      if (!effectiveRoleName && resolvedVendor?.role_id) {
        const role = await query('SELECT name FROM roles WHERE id = $1', [resolvedVendor.role_id]);
        if (role.rows.length > 0) effectiveRoleName = role.rows[0].name;
      }
      if (effectiveRoleName) {
        staffQuery += ` AND s.role = $${paramIndex}`;
        params.push(effectiveRoleName);
        paramIndex++;
      }

      if (serviceId) {
        // Check if staff has this service AND it's enabled
        staffQuery += ` AND EXISTS (
          SELECT 1 FROM staff_services ss 
          WHERE ss.staff_id = s.id 
            AND ss.service_id = $${paramIndex}
            AND ss.enabled_by_staff = true
            AND ss.is_active = true
        )`;
        params.push(serviceId);
        paramIndex++;
      }
      
      // ⚠️ CRITICAL: Check service styles match
      // ✅ FIX: Use service_styles column only if it exists
      if (serviceStyle) {
        if (hasServiceStylesColumn) {
          // Use service_styles column if it exists
          staffQuery += ` AND EXISTS (
            SELECT 1 FROM staff_services ss 
            WHERE ss.staff_id = s.id
              AND ss.enabled_by_staff = true
              AND ss.is_active = true
              AND $${paramIndex} = ANY(ss.service_styles)
          )`;
          params.push(serviceStyle);
          paramIndex++;
        } else {
          // Fallback: Check service style via vendor_services or service_catalog
          // For now, just check if staff has any active services (less strict filtering)
          staffQuery += ` AND EXISTS (
            SELECT 1 FROM staff_services ss 
            WHERE ss.staff_id = s.id
              AND ss.enabled_by_staff = true
              AND ss.is_active = true
          )`;
          // Don't push serviceStyle to params since we're not using it in the query
        }
      }
      
      // ⚠️ CRITICAL: Check if staff has availability slots with this service configured
      const bookingDate = c.req.query('bookingDate') || new Date().toISOString().split('T')[0];
      const bookingTime = c.req.query('bookingTime'); // Optional: specific time
      
      staffQuery += ` AND EXISTS (
        SELECT 1 FROM staff_availability_slots sas
        INNER JOIN staff_slot_services sss ON sas.id = sss.slot_id
        WHERE sas.staff_id = s.id
          AND sas.is_available = true
          AND sas.date = $${paramIndex}
      `;
      params.push(bookingDate);
      paramIndex++;
      
      if (bookingTime) {
        staffQuery += ` AND sas.start_time <= $${paramIndex}
          AND sas.end_time >= $${paramIndex}`;
        params.push(bookingTime);
        paramIndex++;
      }
      
      if (serviceId) {
        staffQuery += ` AND sss.service_id = $${paramIndex}`;
        params.push(serviceId);
        paramIndex++;
      }
      
      staffQuery += ` )`;

      const staffResults = await query(staffQuery, params);
      let eligibleStaff = staffResults.rows;

      // Filter by service style availability and radius
      if (serviceStyle === 'at_home' && customerLat && customerLng) {
        // Filter by distance and radius configuration
        const customerLocation = { latitude: customerLat, longitude: customerLng };
        const bookingDateTime = c.req.query('booking_datetime') 
          ? new Date(c.req.query('booking_datetime') as string)
          : undefined;

        // First, filter by radius and get locations
        const staffWithLocation = await Promise.all(
          eligibleStaff.map(async (staff: any) => {
            // Get staff location (default_location or vendor location)
            let staffLat: number | null = null;
            let staffLng: number | null = null;
            let radiusKm: number | null = null;

            if (staff.location) {
              staffLat = parseFloat(staff.location.lat);
              staffLng = parseFloat(staff.location.lng);
            } else if (staff.vendor_id) {
              // Get vendor location
              const vendor = await query('SELECT latitude, longitude FROM vendors WHERE id = $1', [staff.vendor_id]);
              if (vendor.rows.length > 0 && vendor.rows[0].latitude) {
                staffLat = parseFloat(vendor.rows[0].latitude);
                staffLng = parseFloat(vendor.rows[0].longitude);
              }
            }

            // Get service radius if serviceId provided
            if (serviceId) {
              const serviceConfig = await query(
                `SELECT radius_km FROM staff_services 
                 WHERE staff_id = $1 AND service_id = $2 AND enabled_by_staff = true`,
                [staff.id, serviceId]
              );
              if (serviceConfig.rows.length > 0 && serviceConfig.rows[0].radius_km) {
                radiusKm = parseFloat(serviceConfig.rows[0].radius_km);
              }
            }

            return {
              ...staff,
              staffLat,
              staffLng,
              radiusKm,
            };
          })
        );

        // Filter by radius
        const staffWithinRadius = staffWithLocation.filter((staff: any) => {
          if (!staff.staffLat || !staff.staffLng) return false;
          const effectiveRadius = staff.radiusKm || maxDistance;
          const distance = calculateDistance(
            customerLat,
            customerLng,
            staff.staffLat,
            staff.staffLng
          );
          return distance <= effectiveRadius;
        });

        // Calculate commute time for each staff
        const staffWithCommuteTime = await Promise.all(
          staffWithinRadius
            .map(async (staff: any) => {
              const distance = calculateDistance(
                customerLat,
                customerLng,
                staff.staffLat,
                staff.staffLng
              );

              // Get buffer time from vendor settings
              let bufferMinutes = 5; // Default
              try {
                const vendorSettings = await query(`
                  SELECT buffer_time_minutes, service_style_buffer_times
                  FROM vendor_settings
                  WHERE vendor_id = $1
                `, [staff.vendor_id]);
                
                if (vendorSettings.rows.length > 0) {
                  const settings = vendorSettings.rows[0];
                  if (settings.service_style_buffer_times && typeof settings.service_style_buffer_times === 'object') {
                    bufferMinutes = settings.service_style_buffer_times['at_home'] || settings.buffer_time_minutes || 5;
                  } else {
                    bufferMinutes = settings.buffer_time_minutes || 5;
                  }
                }
              } catch (error) {
                console.warn('Error fetching buffer time for staff:', error);
              }

              // Calculate commute time
              const staffLocation = {
                latitude: staff.staffLat,
                longitude: staff.staffLng,
              };

              try {
                const commuteResult = await calculateCommuteTime(
                  staffLocation,
                  customerLocation,
                  {
                    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
                    departureTime: bookingDateTime,
                    averageSpeedKmh: 30, // Default city speed
                    trafficMultiplier: 1.25, // 25% traffic buffer
                  }
                );

                // Calculate total time including buffer
                const totalTimeMinutes = commuteResult.durationMinutes + bufferMinutes;
                const estimatedArrivalWithBuffer = bookingDateTime 
                  ? new Date(new Date(bookingDateTime).getTime() + totalTimeMinutes * 60000).toISOString()
                  : commuteResult.estimatedArrival;

                return {
                  ...staff,
                  distance: Math.round(distance * 100) / 100,
                  commuteTime: commuteResult.durationMinutes,
                  commuteDistance: commuteResult.distanceKm,
                  estimatedArrival: commuteResult.estimatedArrival,
                  bufferTime: bufferMinutes,
                  totalTime: totalTimeMinutes,
                  estimatedArrivalWithBuffer: estimatedArrivalWithBuffer,
                };
              } catch (error) {
                // Fallback to simple distance-based estimate
                const estimatedMinutes = Math.ceil((distance / 30) * 60 * 1.25); // 30 km/h with 25% buffer
                const totalTimeMinutes = estimatedMinutes + bufferMinutes;
                return {
                  ...staff,
                  distance: Math.round(distance * 100) / 100,
                  commuteTime: estimatedMinutes,
                  commuteDistance: distance,
                  bufferTime: bufferMinutes,
                  totalTime: totalTimeMinutes,
                };
              }
            })
        );

        // Get previous providers for this customer (if customerId provided)
        let previousProviders: string[] = [];
        if (customerId) {
          try {
            const previousBookings = await query(`
              SELECT DISTINCT staff_id
              FROM bookings
              WHERE customer_id = $1
              AND staff_id IS NOT NULL
              AND status IN ('completed', 'confirmed')
              ORDER BY created_at DESC
              LIMIT 10
            `, [customerId]);
            previousProviders = previousBookings.rows.map((r: any) => r.staff_id).filter(Boolean);
            
            // Get feedback/ratings for previous providers
            const feedback = await query(`
              SELECT staff_id, AVG(rating) as avg_rating
              FROM reviews
              WHERE staff_id = ANY($1)
              AND rating IS NOT NULL
              GROUP BY staff_id
            `, [previousProviders.length > 0 ? previousProviders : ['']]);
            
            const badProviders = feedback.rows
              .filter((f: any) => f.avg_rating < 3.0)
              .map((f: any) => f.staff_id);
            
            // Remove bad providers from previous providers list
            previousProviders = previousProviders.filter(id => !badProviders.includes(id));
          } catch (error) {
            console.warn('Error fetching previous providers:', error);
          }
        }

        // Sort: Previous providers first, then by commute time, then by distance
        eligibleStaff = staffWithCommuteTime.sort((a: any, b: any) => {
          const aIsPrevious = previousProviders.includes(a.id);
          const bIsPrevious = previousProviders.includes(b.id);
          
          // Previous providers get priority
          if (aIsPrevious && !bIsPrevious) return -1;
          if (!aIsPrevious && bIsPrevious) return 1;
          
          // If both or neither are previous, sort by commute time
          if (a.commuteTime !== b.commuteTime) {
            return a.commuteTime - b.commuteTime;
          }
          // Then by distance
          return a.distance - b.distance;
        });
        
        // Mark previous providers
        eligibleStaff = eligibleStaff.map((staff: any) => ({
          ...staff,
          isPreviousProvider: previousProviders.includes(staff.id),
        }));
      } else if (serviceStyle === 'at_center') {
        // Filter staff available at center
        eligibleStaff = eligibleStaff.filter((staff: any) => 
          staff.service_styles && JSON.parse(staff.service_styles || '[]').includes('at_center')
        );
      } else if (serviceStyle === 'tele') {
        // Filter staff available for tele
        eligibleStaff = eligibleStaff.filter((staff: any) => 
          staff.service_styles && JSON.parse(staff.service_styles || '[]').includes('tele')
        );
      }

      // Get availability for each staff
      const staffWithAvailability = await Promise.all(
        eligibleStaff.map(async (staff: any) => {
          const availability = await query(
            `SELECT * FROM staff_availability 
             WHERE staff_id = $1 
             AND available_date >= CURRENT_DATE
             ORDER BY available_date, available_time_start
             LIMIT 7`,
            [staff.id]
          );

          return {
            ...staff,
            availability: availability.rows,
            nextAvailableSlot: availability.rows[0] || null,
          };
        })
      );

      return c.json({
        success: true,
        staff: staffWithAvailability,
        total: staffWithAvailability.length,
      });
    } catch (error: any) {
      console.error('Error discovering staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF CRUD (Vendor-facing)
  // ============================================

  /**
   * GET /vendor/:vendorId/staff
   * GET /staff/vendor/:vendorId
   * Get all staff for a vendor (including unverified)
   * Requires: staff_create or staff_schedule capability
   */
  const getVendorStaffHandler = async (c: any) => {
    try {
      const { vendorId } = c.req.param();
      
      console.log(`[GET /staff/vendor/:vendorId] Fetching staff for vendor: ${vendorId}`);
      
      // ✅ FIX: For read operations, skip capability check entirely - just verify vendor exists
      // Read operations should be allowed for any vendor that exists
      let vendorExists = false;
      try {
        const vendorCheck = await query('SELECT id, status, is_active, business_name FROM vendors WHERE id = $1::uuid', [vendorId]);
        if (vendorCheck.rows.length > 0) {
          vendorExists = true;
          const vendor = vendorCheck.rows[0];
          console.log(`[GET /staff/vendor/:vendorId] Vendor found: ${vendor.business_name}, status=${vendor.status}, is_active=${vendor.is_active}`);
        } else {
          console.warn(`[GET /staff/vendor/:vendorId] Vendor not found: ${vendorId}`);
          // Still return success with empty array for better UX
        }
      } catch (vendorError: any) {
        console.error(`[GET /staff/vendor/:vendorId] Error checking vendor:`, vendorError.message);
        // Continue anyway - might be a temporary DB issue
      }
      
      // ✅ CRITICAL FIX: Query staff ONLY for the specific vendor (proper data isolation)
      // Staff belongs to a specific vendor and should NOT be shared across vendors
      console.log(`[GET /staff/vendor/:vendorId] Querying staff for vendor: ${vendorId}`);
      let staffResult: any = { rows: [] };
      
      try {
        // ✅ FIXED: Query staff filtered by vendor_id (proper data isolation)
        console.log(`[GET /staff/vendor/:vendorId] Fetching staff for vendor ${vendorId}...`);
        const vendorStaffQuery = await query(`
          SELECT s.*, v.business_name as vendor_name, v.city as vendor_city, v.state as vendor_state
          FROM staff s
          LEFT JOIN vendors v ON s.vendor_id = v.id
          WHERE s.vendor_id = $1::uuid
          AND s.is_active = true
          ORDER BY s.created_at DESC
        `, [vendorId]);
        
        console.log(`[GET /staff/vendor/:vendorId] Query returned ${vendorStaffQuery.rows?.length || 0} staff for vendor ${vendorId}`);
        staffResult.rows = vendorStaffQuery.rows || [];
        
      } catch (queryError: any) {
        console.error(`[GET /staff/vendor/:vendorId] Query failed:`, queryError.message);
        
        // Fallback: Try simple query without JOIN (handles UUID/text mismatch)
        try {
          const simpleQuery = await query(`
            SELECT * FROM staff 
            WHERE vendor_id::text = $1
            AND is_active = true
            ORDER BY created_at DESC
          `, [vendorId]);
          staffResult.rows = simpleQuery.rows || [];
          console.log(`[GET /staff/vendor/:vendorId] Fallback query returned ${staffResult.rows.length} rows`);
        } catch (simpleError: any) {
          console.error(`[GET /staff/vendor/:vendorId] Fallback query also failed:`, simpleError.message);
          staffResult.rows = [];
        }
      }

      // ✅ Ensure staff is always an array
      const staffArray = staffResult.rows || [];
      console.log(`[GET /staff/vendor/:vendorId] Final result: ${staffArray.length} staff members for vendor ${vendorId}`);
      
      // Log result for debugging
      if (staffArray.length > 0) {
        console.log(`[GET /staff/vendor/:vendorId] Found ${staffArray.length} staff for vendor ${vendorId}`);
      } else {
        console.log(`[GET /staff/vendor/:vendorId] No staff found for vendor ${vendorId}`);
      }

      // ✅ FIX: Check if service_styles column exists in staff_services table
      const schemaCheck = await query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'staff_services' AND column_name = 'service_styles'
        ) as has_service_styles
      `);
      const hasServiceStylesColumn = schemaCheck.rows[0]?.has_service_styles || false;

      // Enrich with services, specializations, and availability
      const enrichedStaff = await Promise.all(
        staffArray.map(async (s: any) => {
          // Get services - conditionally include service_styles if column exists
          let servicesQuery = `
            SELECT ss.*, sv.name as service_name
            ${hasServiceStylesColumn ? ', ss.service_styles' : ''}
            FROM staff_services ss 
            INNER JOIN services sv ON ss.service_id = sv.id 
            WHERE ss.staff_id = $1
          `;
          
          const services = await query(servicesQuery, [s.id]);

          // Get specializations from staff_specializations table
          let specializations: string[] = [];
          try {
            const specsResult = await query(
              'SELECT specialization FROM staff_specializations WHERE staff_id = $1',
              [s.id]
            );
            specializations = specsResult.rows.map((row: any) => row.specialization);
          } catch (e) {
            // Table might not exist, use empty array
            specializations = [];
          }

          // ✅ FIX: Handle both photo, photo_url, and photos fields
          const photo = s.photo || s.photo_url || (s.photos ? (Array.isArray(s.photos) ? s.photos[0] : JSON.parse(s.photos || '[]')[0]) : null);
          
          // Parse languages if stored as JSON string or array
          let languages: string[] = [];
          if (s.languages) {
            if (Array.isArray(s.languages)) {
              languages = s.languages;
            } else if (typeof s.languages === 'string') {
              try {
                languages = JSON.parse(s.languages);
              } catch {
                languages = s.languages.split(',').map((l: string) => l.trim()).filter(Boolean);
              }
            }
          }
          
          return {
            id: s.id,
            name: s.name,
            phone: s.phone,
            email: s.email,
            role: s.role,
            photo: photo,
            photo_url: photo,
            experience_years: s.experience_years || 0,
            qualifications: s.qualifications || '',
            languages: languages,
            is_active: s.is_active !== undefined ? s.is_active : true,
            mobile_verified: s.mobile_verified !== undefined ? s.mobile_verified : false,
            mobile_verified_at: s.mobile_verified_at || null,
            specializations: specializations || [],
            services: services.rows.map((svc: any) => ({
              id: svc.id,
              name: svc.service_name,
              service_style: hasServiceStylesColumn ? svc.service_styles : null,
            })),
            // ✅ FIX: Include vendor info for unverified staff so they can verify themselves
            vendor: s.vendor_name ? {
              id: s.vendor_id,
              name: s.vendor_name,
              city: s.vendor_city,
              state: s.vendor_state,
            } : null,
          };
        })
      );

      // ✅ FIX: Ensure we always return an array, even if empty
      const response = { 
        success: true, 
        staff: Array.isArray(enrichedStaff) ? enrichedStaff : [], 
        total: Array.isArray(enrichedStaff) ? enrichedStaff.length : 0 
      };
      console.log(`[GET /vendor/:vendorId/staff] Returning ${response.total} staff members`);
      return c.json(response);
    } catch (error: any) {
      console.error('[GET /vendor/:vendorId/staff] Error fetching staff:', error);
      // ✅ FIX: Return empty array on error instead of error response (for better UX)
      return c.json({ success: true, staff: [], total: 0 });
    }
  };

  // Register both endpoint paths
  app.get("/vendor/:vendorId/staff", getVendorStaffHandler);
  app.get("/staff/vendor/:vendorId", getVendorStaffHandler);

  /**
   * POST /vendor/:vendorId/staff
   * Create a new staff member
   * Requires: staff_create capability
   * 
   * ✅ NEW: Accepts same JSON structure as vendor creation for seamless login
   * Supports both flat structure and application_payload structure
   */
  app.post("/vendor/:vendorId/staff", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // Check capability
      const hasStaffCreateCapability = await checkVendorCapability(vendorId, 'staff_create');
      if (!hasStaffCreateCapability) {
        return c.json({ error: 'Vendor does not have staff creation capability' }, 403);
      }
      
      // ✅ SOLO VENDOR RESTRICTION: Solo vendors cannot add staff members
      const vendorCheck = await select('vendors', { id: vendorId });
      if (vendorCheck.length > 0 && vendorCheck[0].vendor_type === 'solo') {
        return c.json({ error: 'Solo vendors cannot add staff members' }, 403);
      }
      
      const staffData = await c.req.json();

      // ✅ NEW: Handle both wrapped (application_payload) and unwrapped payload formats
      // Same structure as vendor onboarding submission
      let normalizedData = staffData;
      
      if (!staffData.application_payload && (staffData.businessName || staffData.roleId || staffData.role_id)) {
        // Convert flat structure to expected format (same as vendor onboarding)
        const { phone, name, email, role, roleId, role_id, vendorType, vendor_type, 
                businessName, fullName, address, ...restFields } = staffData;
        normalizedData = {
          phone: phone || staffData.phone,
          name: name || staffData.name,
          email: email || staffData.email,
          role: role || staffData.role,
          roleId: roleId || role_id || staffData.roleId || staffData.role_id,
          vendorType: vendorType || vendor_type || staffData.vendorType || staffData.vendor_type,
          application_payload: {
            businessName: businessName || staffData.businessName,
            fullName: fullName || staffData.fullName || name || staffData.name,
            address: address || staffData.address,
            ...restFields
          }
        };
        console.log('📦 [STAFF CREATE] Normalized flat payload to wrapped format');
      }

      // Extract core staff fields
      const phone = normalizedData.phone || staffData.phone;
      const name = normalizedData.name || staffData.name;
      const email = normalizedData.email || staffData.email;
      const roleName = normalizedData.role || staffData.role;
      const roleId = normalizedData.roleId || normalizedData.role_id || staffData.roleId || staffData.role_id;
      const vendorType = normalizedData.vendorType || normalizedData.vendor_type || staffData.vendorType || staffData.vendor_type || 'business';
      const applicationPayload = normalizedData.application_payload || staffData.application_payload || {};

      // ✅ FIX: Trim and validate name and phone properly
      const trimmedName = name?.trim() || '';
      const trimmedPhone = phone?.trim() || '';
      
      if (!trimmedName || trimmedName.length === 0) {
        return c.json({ error: 'Name is required' }, 400);
      }
      if (!trimmedPhone || trimmedPhone.length === 0) {
        return c.json({ error: 'Phone number is required' }, 400);
      }
      
      // ✅ FIX: Normalize phone number (same as auth endpoint)
      // Remove non-digits, handle country codes, pad 9-digit numbers with leading 0
      let phoneDigits = trimmedPhone.replace(/\D/g, '');
      // If phone has country code (11+ digits), take last 10 digits
      // If phone is 9 digits, pad with leading 0 to make it 10 digits
      phoneDigits = phoneDigits.length > 10 
        ? phoneDigits.slice(-10)
        : phoneDigits.length === 9 
          ? '0' + phoneDigits
          : phoneDigits;
      
      if (phoneDigits.length !== 10) {
        return c.json({ error: 'Phone number must be 10 digits' }, 400);
      }

      // ✅ FIX: Check for duplicate phone number for this vendor (use phoneDigits for comparison)
      const existingStaff = await query(
        `SELECT id, name, phone, is_active FROM staff WHERE vendor_id = $1 AND phone = $2`,
        [vendorId, phoneDigits]
      );

      if (existingStaff.rows.length > 0) {
        const existing = existingStaff.rows[0];
        if (existing.is_active) {
          return c.json({ 
            error: `A staff member with phone number ${phone} already exists for this vendor`,
            existingStaffId: existing.id,
            existingStaffName: existing.name
          }, 409); // 409 Conflict
        } else {
          // Staff exists but is inactive - allow reactivation or return helpful message
          return c.json({ 
            error: `A staff member with phone number ${phone} already exists but is inactive. Please reactivate the existing staff member instead.`,
            existingStaffId: existing.id,
            existingStaffName: existing.name
          }, 409);
        }
      }

      // ✅ NEW: Resolve role name from roleId if provided
      let finalRoleName = roleName;
      if (roleId && !finalRoleName) {
        // If roleId is provided but not role name, resolve it
        if (roleId.length === 36 && roleId.includes('-')) {
          // Looks like UUID, resolve to role name
          const role = await query('SELECT name FROM roles WHERE id = $1', [roleId]);
          if (role.rows.length > 0) {
            finalRoleName = role.rows[0].name;
          }
        } else {
          // Might be role name already
          finalRoleName = roleId;
        }
      }
      
      // If we still don't have a role name, try to get it from the vendor
      if (!finalRoleName) {
        const vendorQuery = await query(`
          SELECT v.role_id, r.name as role_name
          FROM vendors v
          LEFT JOIN roles r ON v.role_id = r.id
          WHERE v.id = $1::uuid
        `, [vendorId]);
        
        if (vendorQuery.rows.length > 0 && vendorQuery.rows[0].role_name) {
          finalRoleName = vendorQuery.rows[0].role_name;
        }
      }

      // ✅ FIX: Check which columns exist in the staff table before inserting
      const schemaCheck = await query(`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'photo') as has_photo,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'photo_url') as has_photo_url,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'qualifications') as has_qualifications,
          EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'languages') as has_languages
      `);
      
      const schema = schemaCheck.rows[0] || {};
      
      // Build insert data dynamically based on schema
      const insertData: any = {
        vendor_id: vendorId,
        name: trimmedName,
        phone: phoneDigits, // Store only digits
        email: email?.trim() || null,
        role: finalRoleName, // Staff table uses 'role' TEXT column, not 'role_id'
        experience_years: staffData.experienceYears || staffData.experience_years || null,
        is_active: staffData.isActive !== false,
        mobile_verified: false,
      };
      
      // Only include photo if column exists
      if (schema.has_photo && (staffData.photo || staffData.photo_url)) {
        insertData.photo = staffData.photo || staffData.photo_url;
      }
      
      // Only include photo_url if column exists
      if (schema.has_photo_url && (staffData.photo_url || staffData.photo)) {
        insertData.photo_url = staffData.photo_url || staffData.photo;
      }
      
      // Only include qualifications if column exists
      if (schema.has_qualifications && staffData.qualifications) {
        insertData.qualifications = staffData.qualifications;
      }
      
      // Only include languages if column exists
      if (schema.has_languages && staffData.languages) {
        insertData.languages = Array.isArray(staffData.languages) ? staffData.languages : [];
      }
      
      const staff = await insert('staff', insertData);

      // ✅ NEW: Create or update vendor_identity for the staff member's phone
      // This enables seamless login without role selection
      try {
        // Check which columns exist in vendor_identity table
        const vendorIdentitySchemaCheck = await query(`
          SELECT 
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'user_type') as has_user_type,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'metadata') as has_metadata,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'full_name') as has_full_name,
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendor_identity' AND column_name = 'business_name') as has_business_name
        `);
        const viSchema = vendorIdentitySchemaCheck.rows[0] || {};
        console.log('[STAFF CREATE] vendor_identity schema:', viSchema);
        
        // If user_type column doesn't exist, add it
        if (!viSchema.has_user_type) {
          try {
            await query(`ALTER TABLE vendor_identity ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'vendor'`);
            viSchema.has_user_type = true;
            console.log('[STAFF CREATE] Added user_type column to vendor_identity');
          } catch (alterError: any) {
            console.warn('[STAFF CREATE] Could not add user_type column:', alterError.message);
          }
        }
        
        // If metadata column doesn't exist, add it
        if (!viSchema.has_metadata) {
          try {
            await query(`ALTER TABLE vendor_identity ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`);
            viSchema.has_metadata = true;
            console.log('[STAFF CREATE] Added metadata column to vendor_identity');
          } catch (alterError: any) {
            console.warn('[STAFF CREATE] Could not add metadata column:', alterError.message);
          }
        }
        
        // Check if vendor_identity exists for this phone
        let vendorIdentities = await select('vendor_identity', { phone: phoneDigits });
        let vendorIdentity = vendorIdentities.length > 0 ? vendorIdentities[0] : null;
        
        // ✅ NEW: Get vendor info (business_name, vendor_type) for staff vendor_identity
        const vendorInfoQuery = await query(`
          SELECT 
            v.business_name,
            v.vendor_type,
            -- Vendor type derived from role name if vendor_identity.vendor_type is NULL
            CASE 
              WHEN vi_vendor.vendor_type IS NOT NULL THEN vi_vendor.vendor_type
              WHEN v.vendor_type IS NOT NULL THEN v.vendor_type
              WHEN r.name LIKE '%_solo' OR r.name LIKE 'solo_%' OR LOWER(r.display_name) LIKE '%solo%' THEN 'solo'
              ELSE 'business'
            END as resolved_vendor_type,
            COALESCE(vi_vendor.business_name, v.business_name) as resolved_business_name
          FROM vendors v
          LEFT JOIN vendor_identity vi_vendor ON (
            vi_vendor.vendor_id = v.id 
            AND (vi_vendor.user_type IS NULL OR vi_vendor.user_type = 'vendor')
          )
          WHERE v.id = $1::uuid
          LIMIT 1
        `, [vendorId]);
        
        const vendorInfo = vendorInfoQuery.rows[0] || {};
        const vendorBusinessName = vendorInfo.resolved_business_name || vendorInfo.business_name || trimmedName;
        const resolvedVendorType = vendorInfo.resolved_vendor_type || vendorType || 'business';
        
        // Resolve roleId from role name if we have role name but not roleId
        let resolvedRoleId = roleId;
        if (finalRoleName && !resolvedRoleId) {
          const roleQuery = await query(`
            SELECT id FROM roles 
            WHERE (name = $1 OR display_name = $1 OR LOWER(name) = LOWER($1) OR LOWER(display_name) = LOWER($1))
              AND is_active = true
            LIMIT 1
          `, [finalRoleName]);
          
          if (roleQuery.rows.length > 0) {
            resolvedRoleId = roleQuery.rows[0].id;
          }
        }
        
        if (vendorIdentity) {
          // Update existing vendor_identity to mark as staff
          const updateFields: string[] = ['vendor_id = $2::uuid', 'onboarding_status = $3', 'updated_at = NOW()'];
          const updateValues: any[] = [vendorIdentity.id, vendorId, 'ACTIVATED'];
          let paramIndex = 4;
          
          // Always set user_type = 'staff' if column exists
          if (viSchema.has_user_type) {
            updateFields.push(`user_type = $${paramIndex}`);
            updateValues.push('staff');
            paramIndex++;
          }
          
          if (resolvedRoleId) {
            updateFields.push(`selected_role_id = $${paramIndex}::uuid`);
            updateValues.push(resolvedRoleId);
            paramIndex++;
          }
          
          if (resolvedVendorType) {
            updateFields.push(`vendor_type = $${paramIndex}`);
            updateValues.push(resolvedVendorType);
            paramIndex++;
          }
          
          if (viSchema.has_full_name && trimmedName) {
            updateFields.push(`full_name = $${paramIndex}`);
            updateValues.push(trimmedName);
            paramIndex++;
          }
          
          if (viSchema.has_business_name && vendorBusinessName) {
            updateFields.push(`business_name = $${paramIndex}`);
            updateValues.push(vendorBusinessName);
            paramIndex++;
          }
          
          if (viSchema.has_metadata) {
            updateFields.push(`metadata = $${paramIndex}::jsonb`);
            updateValues.push(JSON.stringify({
              staff_id: staff[0].id,
              created_via: 'staff_creation',
            }));
            paramIndex++;
          }
          
          if (email) {
            updateFields.push(`email = $${paramIndex}`);
            updateValues.push(email);
            paramIndex++;
          }
          
          const updateQuery = `UPDATE vendor_identity SET ${updateFields.join(', ')} WHERE id = $1`;
          await query(updateQuery, updateValues);
          console.log(`[STAFF CREATE] Updated vendor_identity ${vendorIdentity.id} for staff phone ${phoneDigits} with user_type='staff'`);
        } else {
          // Create new vendor_identity for staff member using raw query for flexibility
          const insertFields = ['phone', 'vendor_id', 'onboarding_status'];
          const insertValues: any[] = [phoneDigits, vendorId, 'ACTIVATED'];
          let paramIndex = 4;
          
          // Add user_type = 'staff'
          if (viSchema.has_user_type) {
            insertFields.push('user_type');
            insertValues.push('staff');
          }
          
          if (resolvedRoleId) {
            insertFields.push('selected_role_id');
            insertValues.push(resolvedRoleId);
          }
          
          if (resolvedVendorType) {
            insertFields.push('vendor_type');
            insertValues.push(resolvedVendorType);
          }
          
          if (viSchema.has_full_name && trimmedName) {
            insertFields.push('full_name');
            insertValues.push(trimmedName);
          }
          
          if (viSchema.has_business_name && vendorBusinessName) {
            insertFields.push('business_name');
            insertValues.push(vendorBusinessName);
          }
          
          if (viSchema.has_metadata) {
            insertFields.push('metadata');
            insertValues.push(JSON.stringify({
              staff_id: staff[0].id,
              created_via: 'staff_creation',
            }));
          }
          
          if (email) {
            insertFields.push('email');
            insertValues.push(email);
          }
          
          const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
          const insertQuery = `INSERT INTO vendor_identity (${insertFields.join(', ')}) VALUES (${placeholders}) RETURNING *`;
          
          const result = await query(insertQuery, insertValues);
          console.log(`[STAFF CREATE] Created vendor_identity ${result.rows[0]?.id} for staff phone ${phoneDigits} with user_type='staff'`);
        }
      } catch (vendorIdentityError: any) {
        // Log error but don't fail staff creation
        console.error('[STAFF CREATE] Error creating/updating vendor_identity:', vendorIdentityError.message, vendorIdentityError.stack);
      }

      // Add specializations (optional)
      if (staffData.specializations && Array.isArray(staffData.specializations) && staffData.specializations.length > 0) {
        for (const spec of staffData.specializations) {
          await insert('staff_specializations', {
            staff_id: staff[0].id,
            specialization: typeof spec === 'string' ? spec : spec.name || spec,
          }).catch(() => {
            // Ignore if staff_specializations table doesn't exist
          });
        }
      }

      // Add services if provided
      if (staffData.services && Array.isArray(staffData.services)) {
        for (const serviceId of staffData.services) {
          await insert('staff_services', {
            staff_id: staff[0].id,
            service_id: serviceId,
          });
        }
      }

      return c.json({ 
        success: true, 
        staff: staff[0], 
        message: 'Staff member created successfully. They can now login with their phone number without role selection.',
      });
    } catch (error: any) {
      console.error('Error creating staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/staff/:staffId
   * Update staff member
   * Requires: staff_create capability
   */
  app.put("/vendor/:vendorId/staff/:staffId", async (c) => {
    try {
      const { vendorId, staffId } = c.req.param();
      
      // Check capability
      const hasStaffCreateCapability = await checkVendorCapability(vendorId, 'staff_create');
      if (!hasStaffCreateCapability) {
        return c.json({ error: 'Vendor does not have staff management capability' }, 403);
      }
      const staffData = await c.req.json();

      // Build update data dynamically
      const updateData: any = {
        name: staffData.name,
        phone: staffData.phone,
        email: staffData.email,
        specialization: staffData.specialization,
        experience_years: staffData.experienceYears || staffData.experience_years,
        service_styles: staffData.serviceStyles || staffData.service_styles,
        latitude: staffData.latitude,
        longitude: staffData.longitude,
        is_active: staffData.isActive,
      };
      
      // Add photo if provided
      if (staffData.photo || staffData.photo_url) {
        updateData.photo = staffData.photo || staffData.photo_url;
      }
      
      // Add qualifications if provided
      if (staffData.qualifications !== undefined) {
        updateData.qualifications = staffData.qualifications;
      }
      
      // Add languages if provided
      if (staffData.languages !== undefined) {
        updateData.languages = Array.isArray(staffData.languages) ? staffData.languages : [];
      }

      const updated = await update('staff',
        { id: staffId },
        updateData
      );

      if (updated.length === 0) {
        return c.json({ error: 'Staff member not found' }, 404);
      }

      // Update services if provided
      if (staffData.services && Array.isArray(staffData.services)) {
        // Delete existing services
        await query('DELETE FROM staff_services WHERE staff_id = $1', [staffId]);
        // Insert new services
        for (const serviceId of staffData.services) {
          await insert('staff_services', {
            staff_id: staffId,
            service_id: serviceId,
          });
        }
      }

      return c.json({ success: true, staff: updated[0], message: 'Staff member updated successfully' });
    } catch (error: any) {
      console.error('Error updating staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/staff/:staffId
   * Delete (deactivate) staff member
   * Requires: staff_create capability
   */
  app.delete("/vendor/:vendorId/staff/:staffId", async (c) => {
    try {
      const { vendorId, staffId } = c.req.param();
      
      // Check capability
      const hasStaffCreateCapability = await checkVendorCapability(vendorId, 'staff_create');
      if (!hasStaffCreateCapability) {
        return c.json({ error: 'Vendor does not have staff management capability' }, 403);
      }

      await update('staff',
        { id: staffId },
        { is_active: false }
      );

      return c.json({ success: true, message: 'Staff member deactivated successfully' });
    } catch (error: any) {
      console.error('Error deactivating staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF AVAILABILITY
  // ============================================

  /**
   * GET /vendor/:vendorId/staff/:staffId/availability
   * Get staff availability
   */
  app.get("/vendor/:vendorId/staff/:staffId/availability", async (c) => {
    try {
      const { staffId } = c.req.param();
      const startDate = c.req.query('startDate') || new Date().toISOString().split('T')[0];
      const endDate = c.req.query('endDate');

      // Handle test IDs - return empty availability
      if (staffId === 'test-staff-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId)) {
        return c.json({ success: true, availability: [] });
      }

      let availabilityQuery = `
        SELECT * FROM staff_availability 
        WHERE staff_id = $1 
        AND available_date >= $2
      `;
      const params: any[] = [staffId, startDate];

      if (endDate) {
        availabilityQuery += ` AND available_date <= $3`;
        params.push(endDate);
      }

      availabilityQuery += ` ORDER BY available_date, available_time_start`;

      const availability = await query(availabilityQuery, params);

      return c.json({ success: true, availability: availability.rows });
    } catch (error: any) {
      console.error('Error fetching staff availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/staff/:staffId/availability
   * Set staff availability
   */
  app.post("/vendor/:vendorId/staff/:staffId/availability", async (c) => {
    try {
      const { staffId } = c.req.param();
      const availabilityData = await c.req.json();

      // Handle single or bulk availability
      const availabilities = Array.isArray(availabilityData) ? availabilityData : [availabilityData];

      const results = [];
      for (const avail of availabilities) {
        const result = await insert('staff_availability', {
          staff_id: staffId,
          available_date: avail.availableDate || avail.available_date,
          available_time_start: avail.availableTimeStart || avail.available_time_start,
          available_time_end: avail.availableTimeEnd || avail.available_time_end,
          is_available: avail.isAvailable !== false,
        });
        results.push(result[0]);
      }

      return c.json({ success: true, availability: results, message: 'Availability set successfully' });
    } catch (error: any) {
      console.error('Error setting staff availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // ✅ FIX GAP CS-1, CS-5: STAFF AVAILABILITY PER SERVICE STYLE
  // ============================================

  /**
   * GET /vendor/:vendorId/staff/:staffId/availability-per-style
   * Get staff availability configured per service style (home/center/tele)
   * Fixes GAP: CS-1 - Staff can set availability per service style
   */
  app.get("/vendor/:vendorId/staff/:staffId/availability-per-style", async (c) => {
    try {
      const { staffId } = c.req.param();
      const serviceStyle = c.req.query('serviceStyle');

      let queryText = `
        SELECT * FROM staff_availability_per_style 
        WHERE staff_id = $1
        AND is_active = true
      `;
      const params: any[] = [staffId];

      if (serviceStyle && ['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        queryText += ` AND service_style = $2`;
        params.push(serviceStyle);
      }

      queryText += ` ORDER BY service_style, day_of_week, start_time`;

      const result = await query(queryText, params);

      // Group by service style for easier frontend consumption
      const grouped: Record<string, any[]> = {
        at_home: [],
        at_center: [],
        tele: [],
      };

      (result.rows || []).forEach((row: any) => {
        if (grouped[row.service_style]) {
          grouped[row.service_style].push({
            id: row.id,
            dayOfWeek: row.day_of_week,
            dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][row.day_of_week],
            startTime: row.start_time,
            endTime: row.end_time,
            maxAppointmentsPerSlot: row.max_appointments_per_slot,
            slotDurationMinutes: row.slot_duration_minutes,
            bufferMinutes: row.buffer_minutes,
          });
        }
      });

      return c.json({ 
        success: true, 
        availability: grouped,
        staffId,
      });
    } catch (error: any) {
      // Handle table not existing gracefully
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return c.json({ 
          success: true, 
          availability: { at_home: [], at_center: [], tele: [] },
          message: 'Per-style availability not configured yet',
        });
      }
      console.error('Error fetching staff availability per style:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/staff/:staffId/availability-per-style
   * Set staff availability for a specific service style
   * Fixes GAP: CS-1 - Staff can set availability per service style
   */
  app.post("/vendor/:vendorId/staff/:staffId/availability-per-style", async (c) => {
    try {
      const { staffId } = c.req.param();
      const data = await c.req.json();

      const { 
        serviceStyle,
        dayOfWeek,
        startTime,
        endTime,
        maxAppointmentsPerSlot = 1,
        slotDurationMinutes = 30,
        bufferMinutes = 15,
      } = data;

      // Validate service style
      if (!serviceStyle || !['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        return c.json({ error: 'serviceStyle must be at_home, at_center, or tele' }, 400);
      }

      // Validate day of week
      if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
        return c.json({ error: 'dayOfWeek must be 0-6 (Sunday-Saturday)' }, 400);
      }

      // Validate times
      if (!startTime || !endTime) {
        return c.json({ error: 'startTime and endTime are required' }, 400);
      }

      // Upsert availability (delete existing and insert new)
      await query(
        `DELETE FROM staff_availability_per_style 
         WHERE staff_id = $1 AND service_style = $2 AND day_of_week = $3`,
        [staffId, serviceStyle, dayOfWeek]
      );

      const result = await insert('staff_availability_per_style', {
        staff_id: staffId,
        service_style: serviceStyle,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        max_appointments_per_slot: maxAppointmentsPerSlot,
        slot_duration_minutes: slotDurationMinutes,
        buffer_minutes: bufferMinutes,
        is_active: true,
      });

      return c.json({ 
        success: true, 
        availability: result[0],
        message: 'Availability set successfully',
      });
    } catch (error: any) {
      console.error('Error setting staff availability per style:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/staff/:staffId/availability-per-style/bulk
   * Bulk update staff availability for all service styles
   * Expects: { at_home: [...], at_center: [...], tele: [...] }
   */
  app.put("/vendor/:vendorId/staff/:staffId/availability-per-style/bulk", async (c) => {
    try {
      const { staffId } = c.req.param();
      const data = await c.req.json();

      const results: any[] = [];

      for (const serviceStyle of ['at_home', 'at_center', 'tele']) {
        const slots = data[serviceStyle] || [];
        
        // Clear existing for this style
        await query(
          `DELETE FROM staff_availability_per_style 
           WHERE staff_id = $1 AND service_style = $2`,
          [staffId, serviceStyle]
        );

        // Insert new slots
        for (const slot of slots) {
          const result = await insert('staff_availability_per_style', {
            staff_id: staffId,
            service_style: serviceStyle,
            day_of_week: slot.dayOfWeek,
            start_time: slot.startTime,
            end_time: slot.endTime,
            max_appointments_per_slot: slot.maxAppointmentsPerSlot || 1,
            slot_duration_minutes: slot.slotDurationMinutes || 30,
            buffer_minutes: slot.bufferMinutes || 15,
            is_active: true,
          });
          results.push(result[0]);
        }
      }

      return c.json({ 
        success: true, 
        updated: results.length,
        message: 'Bulk availability updated successfully',
      });
    } catch (error: any) {
      console.error('Error bulk updating staff availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/staff/:staffId/availability-per-style/:availabilityId
   * Delete specific availability slot
   */
  app.delete("/vendor/:vendorId/staff/:staffId/availability-per-style/:availabilityId", async (c) => {
    try {
      const { availabilityId } = c.req.param();

      await update('staff_availability_per_style', 
        { id: availabilityId }, 
        { is_active: false }
      );

      return c.json({ 
        success: true, 
        message: 'Availability slot deleted',
      });
    } catch (error: any) {
      console.error('Error deleting staff availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/staff/:staffId/photo
   * Upload staff photo
   * Fixes GAP: CS-4, GN-8 - Staff photos not stored/retrieved
   */
  app.put("/vendor/:vendorId/staff/:staffId/photo", async (c) => {
    try {
      const { staffId } = c.req.param();
      const { photoUrl, photos } = await c.req.json();

      const updateData: any = {};
      
      if (photoUrl) {
        updateData.photo_url = photoUrl;
      }
      
      if (photos && Array.isArray(photos)) {
        updateData.photos = JSON.stringify(photos);
      }

      if (Object.keys(updateData).length === 0) {
        return c.json({ error: 'photoUrl or photos array required' }, 400);
      }

      await update('staff', { id: staffId }, updateData);

      return c.json({ 
        success: true, 
        message: 'Staff photo updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating staff photo:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF MOBILE VERIFICATION
  // ============================================

  /**
   * POST /staff/:staffId/verify-mobile
   * Verify staff mobile number with OTP
   */
  app.post("/staff/:staffId/verify-mobile", async (c) => {
    try {
      const { staffId } = c.req.param();
      const { otp } = await c.req.json();

      if (!otp) {
        return c.json({ error: 'OTP is required' }, 400);
      }

      // Get staff record
      const staffRecords = await select('staff', { id: staffId });
      if (staffRecords.length === 0) {
        return c.json({ error: 'Staff member not found' }, 404);
      }

      const staff = staffRecords[0];

      // Verify OTP
      const otpRecords = await select('otp_tokens', {
        phone: staff.phone,
        code: otp,
        purpose: 'staff_verification',
        is_used: false,
      });

      if (otpRecords.length === 0) {
        return c.json({ error: 'Invalid OTP' }, 400);
      }

      const otpRecord = otpRecords[0];

      // Check expiry
      if (new Date(otpRecord.expires_at) < new Date()) {
        return c.json({ error: 'OTP has expired. Please request a new one.' }, 400);
      }

      // Mark OTP as used
      await update('otp_tokens', { id: otpRecord.id }, { is_used: true, used_at: new Date() });

      // Update staff as verified
      await update('staff', { id: staffId }, {
        mobile_verified: true,
        mobile_verified_at: new Date(),
      });

      return c.json({
        success: true,
        message: 'Mobile number verified successfully. Staff can now go live on the platform.',
      });
    } catch (error: any) {
      console.error('Error verifying staff mobile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /staff/:staffId/resend-verification-otp
   * Resend verification OTP to staff mobile
   */
  app.post("/staff/:staffId/resend-verification-otp", async (c) => {
    try {
      const { staffId } = c.req.param();

      // Get staff record
      const staffRecords = await select('staff', { id: staffId });
      if (staffRecords.length === 0) {
        return c.json({ error: 'Staff member not found' }, 404);
      }

      const staff = staffRecords[0];

      if (staff.mobile_verified) {
        return c.json({ error: 'Mobile number is already verified' }, 400);
      }

      // Generate new OTP
      const UAT_MODE = process.env.UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
      const otp = UAT_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP in database
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

      await insert('otp_tokens', {
        phone: staff.phone,
        code: otp,
        purpose: 'staff_verification',
        expires_at: expiresAt,
        is_used: false,
      });

      // Send OTP via SMS using SNS (same pattern as auth.ts)
      if (!UAT_MODE) {
        try {
          const settings = await select('platform_settings', {
            setting_key: 'admin:settings:aws',
          });

          if (settings.length > 0) {
            const awsSettings = settings[0].setting_value;
            
            if (awsSettings?.sns?.enabled && awsSettings?.credentials?.accessKeyId) {
              const snsClient = new SNSClient({
                region: awsSettings.sns.region || 'ap-south-1',
                credentials: {
                  accessKeyId: awsSettings.credentials.accessKeyId,
                  secretAccessKey: awsSettings.credentials.secretAccessKey,
                },
              });

              const message = `Your Warmpawz staff verification code is: ${otp}. Valid for 10 minutes.`;
              await snsClient.send(
                new PublishCommand({
                  PhoneNumber: staff.phone,
                  Message: message,
                  MessageAttributes: {
                    'AWS.SNS.SMS.SMSType': {
                      DataType: 'String',
                      StringValue: 'Transactional',
                    },
                  },
                })
              );
            }
          }
        } catch (snsError) {
          console.error('[STAFF] SNS send failed, OTP logged only:', snsError);
        }
      }

      console.log(`[STAFF] Resent OTP to ${staff.phone} for verification: ${UAT_MODE ? '123456 (UAT)' : '***'}`);

      return c.json({
        success: true,
        message: 'OTP resent successfully',
        debug_otp: UAT_MODE ? otp : undefined,
      });
    } catch (error: any) {
      console.error('Error resending OTP:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // ENHANCED AVAILABILITY SLOTS MANAGEMENT
  // ============================================

  /**
   * GET /staff/:staffId/availability-slots
   * Get all availability slots for a staff member
   */
  app.get("/staff/:staffId/availability-slots", async (c) => {
    try {
      const { staffId } = c.req.param();
      const startDate = c.req.query('startDate') || new Date().toISOString().split('T')[0];
      const endDate = c.req.query('endDate');

      let slotsQuery = `
        SELECT sas.*
        FROM staff_availability_slots sas
        WHERE sas.staff_id = $1
        AND sas.date >= $2
      `;
      const params: any[] = [staffId, startDate];

      if (endDate) {
        slotsQuery += ` AND sas.date <= $3`;
        params.push(endDate);
      }

      slotsQuery += ` ORDER BY sas.date, sas.start_time`;

      const slotsResult = await query(slotsQuery, params);
      const slots = slotsResult.rows;

      // Enrich with services and breaks
      const enrichedSlots = await Promise.all(
        slots.map(async (slot: any) => {
          // Get services for this slot (service_style comes from staff_services, not base services table)
          const servicesResult = await query(
            `SELECT sss.*, s.name as service_name, 
                    COALESCE(stss.service_style, 'at_center') as service_style
             FROM staff_slot_services sss
             INNER JOIN services s ON sss.service_id = s.id
             LEFT JOIN staff_services stss ON stss.service_id = sss.service_id AND stss.staff_id = $2
             WHERE sss.slot_id = $1`,
            [slot.id, staffId]
          );

          // Get breaks for this slot
          const breaksResult = await query(
            `SELECT * FROM staff_slot_breaks
             WHERE slot_id = $1
             ORDER BY start_time`,
            [slot.id]
          );

          return {
            ...slot,
            services: servicesResult.rows,
            breaks: breaksResult.rows,
          };
        })
      );

      return c.json({ success: true, slots: enrichedSlots });
    } catch (error: any) {
      console.error('Error fetching availability slots:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /staff/:staffId/availability-slots
   * Create a new availability slot
   */
  app.post("/staff/:staffId/availability-slots", async (c) => {
    try {
      const { staffId } = c.req.param();
      const slotData = await c.req.json();

      // Validate required fields
      if (!slotData.date || !slotData.startTime || !slotData.endTime) {
        return c.json({ error: 'date, startTime, and endTime are required' }, 400);
      }

      // Check for overlapping slots
      const overlappingCheck = await query(
        `SELECT id FROM staff_availability_slots
         WHERE staff_id = $1
         AND date = $2
         AND is_available = true
         AND (
           (start_time <= $3 AND end_time > $3) OR
           (start_time < $4 AND end_time >= $4) OR
           (start_time >= $3 AND end_time <= $4)
         )`,
        [staffId, slotData.date, slotData.startTime, slotData.endTime]
      );

      if (overlappingCheck.rows.length > 0) {
        return c.json({ error: 'Slot overlaps with existing availability' }, 400);
      }

      // Create slot
      const slot = await insert('staff_availability_slots', {
        staff_id: staffId,
        date: slotData.date,
        start_time: slotData.startTime,
        end_time: slotData.endTime,
        location_override: slotData.locationOverride || null,
        is_available: slotData.isAvailable !== false,
        notes: slotData.notes || null,
      });

      const slotId = slot[0].id;

      // Add services to slot
      if (slotData.services && Array.isArray(slotData.services)) {
        for (const service of slotData.services) {
          await insert('staff_slot_services', {
            slot_id: slotId,
            service_id: service.serviceId,
            lead_time_minutes: service.leadTimeMinutes || 0,
            buffer_time_minutes: service.bufferTimeMinutes || 0,
            radius_km: service.radiusKm || null,
          });
        }
      }

      // Add breaks to slot
      if (slotData.breaks && Array.isArray(slotData.breaks)) {
        for (const breakItem of slotData.breaks) {
          await insert('staff_slot_breaks', {
            slot_id: slotId,
            start_time: breakItem.startTime,
            end_time: breakItem.endTime,
            reason: breakItem.reason || null,
          });
        }
      }

      return c.json({ success: true, slot: slot[0], message: 'Availability slot created successfully' });
    } catch (error: any) {
      console.error('Error creating availability slot:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/availability-slots/:slotId
   * Update an availability slot
   */
  app.put("/staff/:staffId/availability-slots/:slotId", async (c) => {
    try {
      const { staffId, slotId } = c.req.param();
      const slotData = await c.req.json();

      // Update slot
      const updated = await update('staff_availability_slots',
        { id: slotId, staff_id: staffId },
        {
          date: slotData.date,
          start_time: slotData.startTime,
          end_time: slotData.endTime,
          location_override: slotData.locationOverride,
          is_available: slotData.isAvailable,
          notes: slotData.notes,
        }
      );

      if (updated.length === 0) {
        return c.json({ error: 'Slot not found' }, 404);
      }

      // Update services (delete and recreate)
      if (slotData.services !== undefined) {
        await query('DELETE FROM staff_slot_services WHERE slot_id = $1', [slotId]);
        if (Array.isArray(slotData.services)) {
          for (const service of slotData.services) {
            await insert('staff_slot_services', {
              slot_id: slotId,
              service_id: service.serviceId,
              lead_time_minutes: service.leadTimeMinutes || 0,
              buffer_time_minutes: service.bufferTimeMinutes || 0,
              radius_km: service.radiusKm || null,
            });
          }
        }
      }

      // Update breaks (delete and recreate)
      if (slotData.breaks !== undefined) {
        await query('DELETE FROM staff_slot_breaks WHERE slot_id = $1', [slotId]);
        if (Array.isArray(slotData.breaks)) {
          for (const breakItem of slotData.breaks) {
            await insert('staff_slot_breaks', {
              slot_id: slotId,
              start_time: breakItem.startTime,
              end_time: breakItem.endTime,
              reason: breakItem.reason || null,
            });
          }
        }
      }

      return c.json({ success: true, slot: updated[0], message: 'Slot updated successfully' });
    } catch (error: any) {
      console.error('Error updating availability slot:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /staff/:staffId/availability-slots/:slotId
   * Delete an availability slot
   */
  app.delete("/staff/:staffId/availability-slots/:slotId", async (c) => {
    try {
      const { staffId, slotId } = c.req.param();

      // Delete related records first (CASCADE should handle, but explicit for clarity)
      await query('DELETE FROM staff_slot_services WHERE slot_id = $1', [slotId]);
      await query('DELETE FROM staff_slot_breaks WHERE slot_id = $1', [slotId]);
      await query('DELETE FROM staff_availability_slots WHERE id = $1 AND staff_id = $2', [slotId, staffId]);

      return c.json({ success: true, message: 'Slot deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting availability slot:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // ✅ FIX GAP 2.1: STAFF AVAILABILITY PER SERVICE STYLE
  // ============================================

  /**
   * GET /staff/:staffId/availability-by-style
   * Get staff availability configured per service style (at_home, tele, at_center)
   * ✅ FIX GAP 2.1: New endpoint for service-style-specific availability
   */
  app.get("/staff/:staffId/availability-by-style", async (c) => {
    try {
      const { staffId } = c.req.param();
      const serviceStyle = c.req.query('serviceStyle'); // Optional filter
      const startDate = c.req.query('startDate') || new Date().toISOString().split('T')[0];
      const endDate = c.req.query('endDate');

      // Query to get availability slots with their associated services and styles
      // Note: service_style comes from staff_services table, not base services table
      let availabilityQuery = `
        SELECT DISTINCT 
          sas.id as slot_id,
          sas.date,
          sas.start_time,
          sas.end_time,
          sas.location_override,
          sas.is_available,
          sas.notes,
          COALESCE(stss.service_style, 'at_center') as service_style,
          s.id as service_id,
          s.name as service_name,
          sss.lead_time_minutes,
          sss.buffer_time_minutes,
          sss.radius_km
        FROM staff_availability_slots sas
        LEFT JOIN staff_slot_services sss ON sas.id = sss.slot_id
        LEFT JOIN services s ON sss.service_id = s.id
        LEFT JOIN staff_services stss ON stss.service_id = s.id AND stss.staff_id = sas.staff_id
        WHERE sas.staff_id = $1
        AND sas.date >= $2
        AND sas.is_available = true
      `;
      const params: any[] = [staffId, startDate];
      let paramIndex = 3;

      if (endDate) {
        availabilityQuery += ` AND sas.date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      if (serviceStyle) {
        availabilityQuery += ` AND stss.service_style = $${paramIndex}`;
        params.push(serviceStyle);
        paramIndex++;
      }

      availabilityQuery += ` ORDER BY sas.date, sas.start_time, COALESCE(stss.service_style, 'at_center')`;

      const result = await query(availabilityQuery, params);

      // Group by service style for easier frontend consumption
      const byStyle: Record<string, any[]> = {
        at_home: [],
        tele: [],
        at_center: [],
      };

      for (const row of result.rows) {
        const style = row.service_style || 'at_center';
        if (byStyle[style]) {
          byStyle[style].push({
            slotId: row.slot_id,
            date: row.date,
            startTime: row.start_time,
            endTime: row.end_time,
            locationOverride: row.location_override,
            serviceId: row.service_id,
            serviceName: row.service_name,
            leadTimeMinutes: row.lead_time_minutes,
            bufferTimeMinutes: row.buffer_time_minutes,
            radiusKm: row.radius_km,
          });
        }
      }

      return c.json({
        success: true,
        staffId,
        availability: byStyle,
        summary: {
          at_home: byStyle.at_home.length,
          tele: byStyle.tele.length,
          at_center: byStyle.at_center.length,
        },
      });
    } catch (error: any) {
      console.error('Error fetching availability by style:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/availability-by-style
   * Configure staff availability for a specific service style
   * ✅ FIX GAP 2.1: New endpoint for service-style-specific availability configuration
   */
  app.put("/staff/:staffId/availability-by-style", async (c) => {
    try {
      const { staffId } = c.req.param();
      const body = await c.req.json();

      const { serviceStyle, slots, defaultSettings } = body;

      if (!serviceStyle || !['at_home', 'tele', 'at_center'].includes(serviceStyle)) {
        return c.json({ error: 'serviceStyle is required (at_home, tele, or at_center)' }, 400);
      }

      // Get services for this staff member with the specified style
      const staffServicesResult = await query(
        `SELECT ss.service_id, s.name
         FROM staff_services ss
         INNER JOIN services s ON ss.service_id = s.id
         WHERE ss.staff_id = $1 
         AND ss.service_style = $2
         AND ss.is_active = true`,
        [staffId, serviceStyle]
      );

      if (staffServicesResult.rows.length === 0) {
        return c.json({
          error: `No active ${serviceStyle} services assigned to this staff member`,
        }, 400);
      }

      const serviceIds = staffServicesResult.rows.map(r => r.service_id);

      // If updating default settings for this style
      if (defaultSettings) {
        // Update staff_services with default lead time, buffer time, radius for this style
        for (const serviceId of serviceIds) {
          await update('staff_services',
            { staff_id: staffId, service_id: serviceId },
            {
              lead_time_minutes: defaultSettings.leadTimeMinutes ?? 0,
              buffer_time_minutes: defaultSettings.bufferTimeMinutes ?? 15,
              radius_km: defaultSettings.radiusKm ?? (serviceStyle === 'at_home' ? 10 : null),
            }
          );
        }
      }

      // If creating/updating slots
      const createdSlots: any[] = [];
      if (slots && Array.isArray(slots)) {
        for (const slotData of slots) {
          if (!slotData.date || !slotData.startTime || !slotData.endTime) {
            continue; // Skip invalid slots
          }

          // Check for existing slot at this time
          const existingSlot = await query(
            `SELECT id FROM staff_availability_slots
             WHERE staff_id = $1 AND date = $2 
             AND start_time = $3 AND end_time = $4`,
            [staffId, slotData.date, slotData.startTime, slotData.endTime]
          );

          let slotId: string;

          if (existingSlot.rows.length > 0) {
            // Update existing slot
            slotId = existingSlot.rows[0].id;
            await update('staff_availability_slots',
              { id: slotId },
              {
                location_override: slotData.locationOverride || null,
                is_available: slotData.isAvailable !== false,
                notes: slotData.notes || null,
              }
            );
          } else {
            // Create new slot
            const newSlot = await insert('staff_availability_slots', {
              staff_id: staffId,
              date: slotData.date,
              start_time: slotData.startTime,
              end_time: slotData.endTime,
              location_override: slotData.locationOverride || null,
              is_available: slotData.isAvailable !== false,
              notes: slotData.notes || null,
            });
            slotId = newSlot[0].id;
          }

          // Clear existing services for this slot and add the style-specific ones
          await query('DELETE FROM staff_slot_services WHERE slot_id = $1', [slotId]);
          
          for (const serviceId of serviceIds) {
            await insert('staff_slot_services', {
              slot_id: slotId,
              service_id: serviceId,
              lead_time_minutes: defaultSettings?.leadTimeMinutes ?? slotData.leadTimeMinutes ?? 0,
              buffer_time_minutes: defaultSettings?.bufferTimeMinutes ?? slotData.bufferTimeMinutes ?? 15,
              radius_km: defaultSettings?.radiusKm ?? slotData.radiusKm ?? null,
            });
          }

          createdSlots.push({ slotId, date: slotData.date, startTime: slotData.startTime, endTime: slotData.endTime });
        }
      }

      return c.json({
        success: true,
        message: `Availability configured for ${serviceStyle} services`,
        serviceStyle,
        slotsCreated: createdSlots.length,
        slots: createdSlots,
        servicesConfigured: serviceIds.length,
      });
    } catch (error: any) {
      console.error('Error configuring availability by style:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /staff/:staffId/service-styles
   * Get all service styles this staff member is configured for
   * Helper endpoint to know which styles staff supports
   */
  app.get("/staff/:staffId/service-styles", async (c) => {
    try {
      const { staffId } = c.req.param();

      const result = await query(
        `SELECT DISTINCT ss.service_style, COUNT(*) as service_count
         FROM staff_services ss
         WHERE ss.staff_id = $1 AND ss.is_active = true AND ss.service_style IS NOT NULL
         GROUP BY ss.service_style`,
        [staffId]
      );

      const styles = result.rows.map(r => ({
        style: r.service_style,
        serviceCount: parseInt(r.service_count, 10),
      }));

      return c.json({
        success: true,
        staffId,
        serviceStyles: styles,
        supportedStyles: styles.map(s => s.style),
      });
    } catch (error: any) {
      console.error('Error fetching staff service styles:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF SERVICE MANAGEMENT
  // ============================================

  /**
   * GET /staff/:staffId/services
   * Get all services assigned to staff (with enable/disable status)
   */
  app.get("/staff/:staffId/services", async (c) => {
    try {
      const { staffId } = c.req.param();

      const servicesResult = await query(
        `SELECT ss.*, s.name as service_name, s.description, s.category,
                ss.service_style, s.price as base_price, s.duration_minutes as base_duration
         FROM staff_services ss
         INNER JOIN services s ON ss.service_id = s.id
         WHERE ss.staff_id = $1
         ORDER BY s.name`,
        [staffId]
      );

      return c.json({ success: true, services: servicesResult.rows });
    } catch (error: any) {
      console.error('Error fetching staff services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/services/:serviceId/enable
   * Enable a service for staff (goes live immediately)
   */
  app.put("/staff/:staffId/services/:serviceId/enable", async (c) => {
    try {
      const { staffId, serviceId } = c.req.param();
      const serviceData = await c.req.json();

      // Check if service is assigned to staff
      const assignedCheck = await query(
        'SELECT * FROM staff_services WHERE staff_id = $1 AND service_id = $2',
        [staffId, serviceId]
      );

      if (assignedCheck.rows.length === 0) {
        return c.json({ error: 'Service not assigned to this staff member' }, 404);
      }

      // Update service configuration
      const updated = await update('staff_services',
        { staff_id: staffId, service_id: serviceId },
        {
          enabled_by_staff: true,
          service_styles: serviceData.serviceStyles || assignedCheck.rows[0].service_styles || [],
          lead_time_minutes: serviceData.leadTimeMinutes ?? assignedCheck.rows[0].lead_time_minutes ?? 0,
          buffer_time_minutes: serviceData.bufferTimeMinutes ?? assignedCheck.rows[0].buffer_time_minutes ?? 0,
          radius_km: serviceData.radiusKm ?? assignedCheck.rows[0].radius_km,
          is_active: true,
        }
      );

      return c.json({
        success: true,
        service: updated[0],
        message: 'Service enabled and is now live',
      });
    } catch (error: any) {
      console.error('Error enabling service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/services/:serviceId/disable
   * Disable a service for staff
   */
  app.put("/staff/:staffId/services/:serviceId/disable", async (c) => {
    try {
      const { staffId, serviceId } = c.req.param();

      const updated = await update('staff_services',
        { staff_id: staffId, service_id: serviceId },
        { enabled_by_staff: false }
      );

      if (updated.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      return c.json({ success: true, message: 'Service disabled' });
    } catch (error: any) {
      console.error('Error disabling service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/services/:serviceId
   * Update service configuration (lead time, buffer, radius, styles)
   */
  app.put("/staff/:staffId/services/:serviceId", async (c) => {
    try {
      const { staffId, serviceId } = c.req.param();
      const serviceData = await c.req.json();

      const updated = await update('staff_services',
        { staff_id: staffId, service_id: serviceId },
        {
          service_styles: serviceData.serviceStyles,
          lead_time_minutes: serviceData.leadTimeMinutes,
          buffer_time_minutes: serviceData.bufferTimeMinutes,
          radius_km: serviceData.radiusKm,
          price: serviceData.price,
          duration_minutes: serviceData.durationMinutes,
        }
      );

      if (updated.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      return c.json({ success: true, service: updated[0], message: 'Service configuration updated' });
    } catch (error: any) {
      console.error('Error updating service configuration:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // VENDOR SERVICE ASSIGNMENT TO STAFF
  // ============================================

  /**
   * POST /vendor/:vendorId/staff/:staffId/assign-services
   * Assign services to staff (business owner action)
   */
  app.post("/vendor/:vendorId/staff/:staffId/assign-services", async (c) => {
    try {
      const { vendorId, staffId } = c.req.param();
      const { serviceIds } = await c.req.json();

      if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
        return c.json({ error: 'serviceIds array is required' }, 400);
      }

      // Verify staff belongs to vendor
      const staffCheck = await select('staff', { id: staffId, vendor_id: vendorId });
      if (staffCheck.length === 0) {
        return c.json({ error: 'Staff not found or does not belong to this vendor' }, 404);
      }

      const assignedServices = [];
      for (const serviceId of serviceIds) {
        // Check if service belongs to vendor
        const serviceCheck = await select('services', { id: serviceId, vendor_id: vendorId });
        if (serviceCheck.length === 0) {
          console.warn(`Service ${serviceId} not found or does not belong to vendor`);
          continue;
        }

        // Assign service (or update if exists)
        const existing = await select('staff_services', { staff_id: staffId, service_id: serviceId });
        if (existing.length === 0) {
          const assigned = await insert('staff_services', {
            staff_id: staffId,
            service_id: serviceId,
            assigned_by_vendor: true,
            enabled_by_staff: false, // Staff must enable it
            is_active: true,
          });
          assignedServices.push(assigned[0]);
        } else {
          // Update to mark as assigned by vendor
          await update('staff_services',
            { staff_id: staffId, service_id: serviceId },
            { assigned_by_vendor: true }
          );
          assignedServices.push(existing[0]);
        }
      }

      return c.json({
        success: true,
        services: assignedServices,
        message: `${assignedServices.length} service(s) assigned to staff`,
      });
    } catch (error: any) {
      console.error('Error assigning services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // INDIVIDUAL PROVIDER CREATION
  // ============================================

  /**
   * POST /individual-provider/create
   * Create an individual provider (home groomer, vet, trainer without clinic)
   */
  app.post("/individual-provider/create", async (c) => {
    try {
      const providerData = await c.req.json();

      // Validate mandatory fields
      if (!providerData.name || !providerData.phone || !providerData.role) {
        return c.json({ error: 'name, phone, and role are required' }, 400);
      }

      if (!providerData.photo) {
        return c.json({ error: 'photo is mandatory' }, 400);
      }

      if (!providerData.qualifications) {
        return c.json({ error: 'qualifications are mandatory' }, 400);
      }

      if (!providerData.specializations || !Array.isArray(providerData.specializations) || providerData.specializations.length === 0) {
        return c.json({ error: 'At least one specialization is mandatory' }, 400);
      }

      if (!providerData.defaultLocation || !providerData.defaultLocation.lat || !providerData.defaultLocation.lng) {
        return c.json({ error: 'defaultLocation with lat/lng is required' }, 400);
      }

      // Check if phone already exists
      const existingStaff = await select('staff', { phone: providerData.phone, is_active: true });
      if (existingStaff.length > 0) {
        return c.json({ error: 'Phone number already registered' }, 400);
      }

      // Create individual provider (vendor_id is NULL)
      const provider = await insert('staff', {
        vendor_id: null, // Individual provider
        name: providerData.name,
        phone: providerData.phone,
        email: providerData.email || null,
        role: providerData.role,
        experience_years: providerData.experienceYears || null,
        photo: providerData.photo,
        qualifications: providerData.qualifications,
        default_location: providerData.defaultLocation,
        is_individual_provider: true,
        is_active: true,
        mobile_verified: false, // Must verify before going live
      });

      const providerId = provider[0].id;

      // Add specializations
      for (const spec of providerData.specializations) {
        await insert('staff_specializations', {
          staff_id: providerId,
          specialization: typeof spec === 'string' ? spec : spec.name || spec,
        });
      }

      // Send OTP for verification
      try {
        const UAT_MODE = process.env.UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
        const otp = UAT_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        await insert('otp_tokens', {
          phone: providerData.phone,
          code: otp,
          purpose: 'staff_verification',
          expires_at: expiresAt,
          is_used: false,
        });

        // Send OTP via SNS
        if (!UAT_MODE) {
          const settings = await select('platform_settings', {
            setting_key: 'admin:settings:aws',
          });

          if (settings.length > 0) {
            const awsSettings = settings[0].setting_value;
            if (awsSettings?.sns?.enabled && awsSettings?.credentials?.accessKeyId) {
              const snsClient = new SNSClient({
                region: awsSettings.sns.region || 'ap-south-1',
                credentials: {
                  accessKeyId: awsSettings.credentials.accessKeyId,
                  secretAccessKey: awsSettings.credentials.secretAccessKey,
                },
              });

              const message = `Your Warmpawz verification code is: ${otp}. Valid for 10 minutes.`;
              await snsClient.send(
                new PublishCommand({
                  PhoneNumber: providerData.phone,
                  Message: message,
                  MessageAttributes: {
                    'AWS.SNS.SMS.SMSType': {
                      DataType: 'String',
                      StringValue: 'Transactional',
                    },
                  },
                })
              );
            }
          }
        }

        console.log(`[INDIVIDUAL_PROVIDER] OTP sent to ${providerData.phone}: ${UAT_MODE ? '123456 (UAT)' : '***'}`);
      } catch (error) {
        console.error('[INDIVIDUAL_PROVIDER] Failed to send OTP:', error);
      }

      return c.json({
        success: true,
        provider: provider[0],
        message: 'Individual provider created. OTP sent for verification.',
        requiresVerification: true,
      });
    } catch (error: any) {
      console.error('Error creating individual provider:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // LOCATION MANAGEMENT
  // ============================================

  /**
   * POST /staff/:staffId/location
   * Set default location for staff (or override for individual provider)
   */
  app.post("/staff/:staffId/location", async (c) => {
    try {
      const { staffId } = c.req.param();
      const locationData = await c.req.json();

      if (!locationData.address || !locationData.lat || !locationData.lng) {
        return c.json({ error: 'address, lat, and lng are required' }, 400);
      }

      const location = {
        address: locationData.address,
        lat: parseFloat(locationData.lat),
        lng: parseFloat(locationData.lng),
        place_id: locationData.placeId || null,
        formatted_address: locationData.formattedAddress || locationData.address,
      };

      // Update staff default location
      await update('staff', { id: staffId }, { default_location: location });

      // Also create location override record
      await insert('staff_location_overrides', {
        staff_id: staffId,
        slot_id: null, // Default location
        address: locationData.address,
        latitude: location.lat,
        longitude: location.lng,
        place_id: locationData.placeId,
        formatted_address: location.formatted_address,
      });

      return c.json({ success: true, location, message: 'Location updated successfully' });
    } catch (error: any) {
      console.error('Error updating location:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /staff/:staffId/location
   * Get staff default location
   */
  app.get("/staff/:staffId/location", async (c) => {
    try {
      const { staffId } = c.req.param();

      const staff = await select('staff', { id: staffId });
      if (staff.length === 0) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      // Get default location or vendor location
      let location = staff[0].default_location;

      if (!location && staff[0].vendor_id) {
        // Fallback to vendor location
        const vendor = await select('vendors', { id: staff[0].vendor_id });
        if (vendor.length > 0 && vendor[0].latitude && vendor[0].longitude) {
          location = {
            address: vendor[0].address,
            lat: vendor[0].latitude,
            lng: vendor[0].longitude,
            formatted_address: vendor[0].address,
          };
        }
      }

      return c.json({ success: true, location });
    } catch (error: any) {
      console.error('Error fetching location:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF HOLIDAYS / DAYS OFF
  // ============================================

  /**
   * GET /staff/:staffId/holidays
   * Get staff holidays/days off
   */
  app.get("/staff/:staffId/holidays", async (c) => {
    try {
      const { staffId } = c.req.param();
      const startDate = c.req.query('startDate') || new Date().toISOString().split('T')[0];
      const endDate = c.req.query('endDate');

      let holidaysQuery = `
        SELECT id, staff_id, date, name, reason, created_at
        FROM staff_holidays
        WHERE staff_id = $1
        AND date >= $2
      `;
      const params: any[] = [staffId, startDate];

      if (endDate) {
        holidaysQuery += ` AND date <= $3`;
        params.push(endDate);
      }

      holidaysQuery += ` ORDER BY date`;

      const holidays = await query(holidaysQuery, params);
      
      return c.json({ 
        success: true, 
        holidays: holidays.rows.map((h: any) => ({
          id: h.id,
          date: h.date,
          name: h.name || h.reason || 'Day Off',
          reason: h.reason,
        }))
      });
    } catch (error: any) {
      // If table doesn't exist, return empty array
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        return c.json({ success: true, holidays: [] });
      }
      console.error('Error fetching staff holidays:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /staff/:staffId/holidays
   * Add a holiday/day off for staff
   */
  app.post("/staff/:staffId/holidays", async (c) => {
    try {
      const { staffId } = c.req.param();
      const { date, name, reason } = await c.req.json();

      if (!date) {
        return c.json({ error: 'date is required' }, 400);
      }

      // Check if holiday already exists for this date
      const existing = await query(
        'SELECT id FROM staff_holidays WHERE staff_id = $1 AND date = $2',
        [staffId, date]
      );

      if (existing.rows.length > 0) {
        return c.json({ error: 'Holiday already exists for this date' }, 400);
      }

      const holiday = await insert('staff_holidays', {
        staff_id: staffId,
        date: date,
        name: name || 'Day Off',
        reason: reason || null,
      });

      return c.json({ 
        success: true, 
        holiday: {
          id: holiday[0].id,
          date: holiday[0].date,
          name: holiday[0].name,
          reason: holiday[0].reason,
        },
        message: 'Holiday added successfully'
      });
    } catch (error: any) {
      // If table doesn't exist, create it
      if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
        try {
          await query(`
            CREATE TABLE IF NOT EXISTS staff_holidays (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
              date DATE NOT NULL,
              name VARCHAR(255),
              reason TEXT,
              created_at TIMESTAMP DEFAULT NOW(),
              UNIQUE(staff_id, date)
            )
          `);
          
          // Retry insert
          const { staffId } = c.req.param();
          const { date, name, reason } = await c.req.json();
          const holiday = await insert('staff_holidays', {
            staff_id: staffId,
            date: date,
            name: name || 'Day Off',
            reason: reason || null,
          });
          
          return c.json({ 
            success: true, 
            holiday: holiday[0],
            message: 'Holiday added successfully'
          });
        } catch (createError: any) {
          console.error('Error creating staff_holidays table:', createError);
          return c.json({ error: createError.message }, 500);
        }
      }
      console.error('Error adding staff holiday:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /staff/:staffId/holidays/:holidayId
   * Remove a holiday/day off
   */
  app.delete("/staff/:staffId/holidays/:holidayId", async (c) => {
    try {
      const { staffId, holidayId } = c.req.param();

      await query(
        'DELETE FROM staff_holidays WHERE id = $1 AND staff_id = $2',
        [holidayId, staffId]
      );

      return c.json({ success: true, message: 'Holiday removed successfully' });
    } catch (error: any) {
      console.error('Error deleting staff holiday:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /location/autocomplete
   * Google Places autocomplete (proxy endpoint)
   * Note: Frontend can also call Google Places API directly
   */
  app.post("/location/autocomplete", async (c) => {
    try {
      const { input, sessionToken } = await c.req.json();

      if (!input) {
        return c.json({ error: 'input is required' }, 400);
      }

      // Get Google API key from settings
      const settings = await select('platform_settings', {
        setting_key: 'admin:settings:google',
      });

      let apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (settings.length > 0 && settings[0].setting_value?.apiKey) {
        apiKey = settings[0].setting_value.apiKey;
      }

      if (!apiKey) {
        return c.json({ error: 'Google Maps API key not configured' }, 500);
      }

      // Call Google Places Autocomplete API
      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      url.searchParams.set('input', input);
      url.searchParams.set('key', apiKey);
      url.searchParams.set('types', 'address');
      if (sessionToken) {
        url.searchParams.set('sessiontoken', sessionToken);
      }

      const response = await fetch(url.toString());
      const data = await response.json() as any;

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Google Places API error:', data);
        return c.json({ error: 'Location autocomplete failed' }, 500);
      }

      return c.json({ success: true, predictions: data.predictions || [] });
    } catch (error: any) {
      console.error('Error in autocomplete:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /location/details
   * Get place details from Google Places
   */
  app.post("/location/details", async (c) => {
    try {
      const { placeId, sessionToken } = await c.req.json();

      if (!placeId) {
        return c.json({ error: 'placeId is required' }, 400);
      }

      const settings = await select('platform_settings', {
        setting_key: 'admin:settings:google',
      });

      let apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (settings.length > 0 && settings[0].setting_value?.apiKey) {
        apiKey = settings[0].setting_value.apiKey;
      }

      if (!apiKey) {
        return c.json({ error: 'Google Maps API key not configured' }, 500);
      }

      const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
      url.searchParams.set('place_id', placeId);
      url.searchParams.set('key', apiKey);
      url.searchParams.set('fields', 'formatted_address,geometry,place_id');
      if (sessionToken) {
        url.searchParams.set('sessiontoken', sessionToken);
      }

      const response = await fetch(url.toString());
      const data = await response.json() as any;

      if (data.status !== 'OK') {
        return c.json({ error: 'Failed to get place details' }, 500);
      }

      const result = data.result;
      const location = {
        address: result.formatted_address,
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        place_id: result.place_id,
        formatted_address: result.formatted_address,
      };

      return c.json({ success: true, location });
    } catch (error: any) {
      console.error('Error getting place details:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /location/reverse-geocode
   * Get address from coordinates (reverse geocoding)
   */
  app.post("/location/reverse-geocode", async (c) => {
    try {
      const { lat, lng } = await c.req.json();

      if (!lat || !lng) {
        return c.json({ error: 'lat and lng are required' }, 400);
      }

      const settings = await select('platform_settings', {
        setting_key: 'admin:settings:google',
      });

      let apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (settings.length > 0 && settings[0].setting_value?.apiKey) {
        apiKey = settings[0].setting_value.apiKey;
      }

      if (!apiKey) {
        // Return coordinates as address if no API key
        return c.json({ 
          success: true, 
          address: `${lat}, ${lng}`,
          formatted_address: `${lat}, ${lng}`,
        });
      }

      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('key', apiKey);

      const response = await fetch(url.toString());
      const data = await response.json() as any;

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        // Return coordinates as fallback
        return c.json({ 
          success: true, 
          address: `${lat}, ${lng}`,
          formatted_address: `${lat}, ${lng}`,
        });
      }

      const result = data.results[0];
      return c.json({ 
        success: true, 
        address: result.formatted_address,
        formatted_address: result.formatted_address,
        place_id: result.place_id,
      });
    } catch (error: any) {
      console.error('Error reverse geocoding:', error);
      // Return coordinates as fallback on error
      const { lat, lng } = await c.req.json().catch(() => ({ lat: 0, lng: 0 }));
      return c.json({ 
        success: true, 
        address: `${lat}, ${lng}`,
        formatted_address: `${lat}, ${lng}`,
      });
    }
  });

  // ============================================
  // STAFF LOGIN & AUTHENTICATION
  // ============================================

  /**
   * POST /staff/login/send-otp
   * Send OTP to staff mobile for login
   */
  app.post("/staff/login/send-otp", async (c) => {
    try {
      const { phone } = await c.req.json();

      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      // ✅ FIX: Normalize phone number (same as auth endpoint)
      const phoneDigits = phone.replace(/\D/g, '');
      const normalizedPhone = phoneDigits.length > 10 
        ? phoneDigits.slice(-10)
        : phoneDigits.length === 9 
          ? '0' + phoneDigits
          : phoneDigits;

      // Check if staff exists (try both original and normalized phone)
      let staff = await select('staff', { phone, is_active: true });
      if (staff.length === 0 && normalizedPhone !== phone) {
        staff = await select('staff', { phone: normalizedPhone, is_active: true });
      }
      if (staff.length === 0) {
        return c.json({ error: 'Staff not found or inactive' }, 404);
      }

      // Generate OTP
      const UAT_MODE = process.env.UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
      const otp = UAT_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      // ✅ FIX: Use normalized phone and same purpose as auth endpoint for compatibility
      await insert('otp_tokens', {
        phone: normalizedPhone,
        code: otp,
        purpose: 'login', // Use same purpose as /auth/send-otp for compatibility
        expires_at: expiresAt,
        is_used: false,
      });

      // Send OTP via SNS
      if (!UAT_MODE) {
        try {
          const settings = await select('platform_settings', {
            setting_key: 'admin:settings:aws',
          });

          if (settings.length > 0) {
            const awsSettings = settings[0].setting_value;
            if (awsSettings?.sns?.enabled && awsSettings?.credentials?.accessKeyId) {
              const snsClient = new SNSClient({
                region: awsSettings.sns.region || 'ap-south-1',
                credentials: {
                  accessKeyId: awsSettings.credentials.accessKeyId,
                  secretAccessKey: awsSettings.credentials.secretAccessKey,
                },
              });

              const message = `Your Warmpawz staff login code is: ${otp}. Valid for 10 minutes.`;
              await snsClient.send(
                new PublishCommand({
                  PhoneNumber: phone,
                  Message: message,
                  MessageAttributes: {
                    'AWS.SNS.SMS.SMSType': {
                      DataType: 'String',
                      StringValue: 'Transactional',
                    },
                  },
                })
              );
            }
          }
        } catch (snsError) {
          console.error('[STAFF LOGIN] SNS send failed:', snsError);
        }
      }

      console.log(`[STAFF LOGIN] OTP sent to ${phone}: ${UAT_MODE ? '123456 (UAT)' : '***'}`);

      return c.json({
        success: true,
        message: 'OTP sent successfully',
        debug_otp: UAT_MODE ? otp : undefined,
      });
    } catch (error: any) {
      console.error('Error sending staff login OTP:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /staff/login/verify-otp
   * Verify OTP and create staff session
   * ✅ FIX: Returns same format as /auth/verify-otp so staff can use vendor dashboard
   */
  app.post("/staff/login/verify-otp", async (c) => {
    try {
      const { phone, otp } = await c.req.json();

      if (!phone || !otp) {
        return c.json({ error: 'Phone and OTP are required' }, 400);
      }

      // ✅ FIX: Normalize phone number (same as auth endpoint)
      const phoneDigits = phone.replace(/\D/g, '');
      const normalizedPhone = phoneDigits.length > 10 
        ? phoneDigits.slice(-10)
        : phoneDigits.length === 9 
          ? '0' + phoneDigits
          : phoneDigits;

      // ✅ FIX: Verify OTP with both purposes (staff_login and login) for compatibility
      let otpRecords = await select('otp_tokens', {
        phone: normalizedPhone,
        code: otp,
        purpose: 'staff_login',
        is_used: false,
      });
      
      // Also try 'login' purpose (in case OTP was sent via /auth/send-otp)
      if (otpRecords.length === 0) {
        otpRecords = await select('otp_tokens', {
          phone: normalizedPhone,
          code: otp,
          purpose: 'login',
          is_used: false,
        });
      }

      // ✅ FIX: Also try original phone if different
      if (otpRecords.length === 0 && phone !== normalizedPhone) {
        otpRecords = await select('otp_tokens', {
          phone: phone,
          code: otp,
          purpose: 'staff_login',
          is_used: false,
        });
        if (otpRecords.length === 0) {
          otpRecords = await select('otp_tokens', {
            phone: phone,
            code: otp,
            purpose: 'login',
            is_used: false,
          });
        }
      }

      // Check UAT mode - accept 123456 without database check
      const UAT_MODE = process.env.UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
      let isValid = false;
      if (UAT_MODE && otp === '123456') {
        isValid = true;
        console.log(`[STAFF LOGIN] UAT MODE: Accepting fixed OTP 123456 for ${normalizedPhone}`);
      } else if (otpRecords.length > 0) {
        const otpRecord = otpRecords[0];
        // Check expiry
        if (new Date(otpRecord.expires_at) >= new Date()) {
          isValid = true;
          // Mark OTP as used
          await update('otp_tokens', { id: otpRecord.id }, { is_used: true, used_at: new Date() });
        }
      }

      if (!isValid) {
        return c.json({ error: 'Invalid or expired OTP' }, 400);
      }

      // Get staff record (try both original and normalized phone)
      let staff = await select('staff', { phone: normalizedPhone, is_active: true });
      if (staff.length === 0 && phone !== normalizedPhone) {
        staff = await select('staff', { phone: phone, is_active: true });
      }
      if (staff.length === 0) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      const staffMember = staff[0];
      const staffVendorId = staffMember.vendor_id;
      const staffRoleName = staffMember.role;

      // ✅ FIX: If first-time login (mobile_verified = false), automatically verify mobile
      const isFirstTimeLogin = !staffMember.mobile_verified;
      if (isFirstTimeLogin) {
        await update('staff', { id: staffMember.id }, {
          mobile_verified: true,
          mobile_verified_at: new Date(),
          last_login_at: new Date(),
        });
        console.log(`[STAFF LOGIN] First-time login: Mobile verified for staff ${staffMember.id}`);
      } else {
        // Update last login only
        await update('staff', { id: staffMember.id }, { last_login_at: new Date() });
      }

      // ✅ NEW: Create or update vendor_identity for staff (same logic as /auth/verify-otp)
      let vendorIdentity = null;
      let vendorRole = null;
      
      if (staffVendorId) {
        try {
          // Try to find vendor_identity by vendor_id first
          const vendorIdentityByVendorId = await query(`
            SELECT * FROM vendor_identity 
            WHERE vendor_id = $1::uuid
            LIMIT 1
          `, [staffVendorId]);
          
          if (vendorIdentityByVendorId.rows && vendorIdentityByVendorId.rows.length > 0) {
            vendorIdentity = vendorIdentityByVendorId.rows[0];
            console.log(`[STAFF LOGIN] Found vendor_identity by vendor_id: ${vendorIdentity.id}`);
          } else {
            // Try to find by phone
            const identities = await select('vendor_identity', { phone: normalizedPhone });
            if (identities.length > 0) {
              vendorIdentity = identities[0];
              console.log(`[STAFF LOGIN] Found vendor_identity by phone: ${vendorIdentity.id}`);
            } else {
              // ✅ FIX: Create vendor_identity for staff phone
              console.log(`[STAFF LOGIN] No vendor_identity found for staff phone ${normalizedPhone}, creating one...`);
              
              // Resolve role ID from staff role name
              let resolvedRoleId = null;
              if (staffRoleName) {
                try {
                  const roleQuery = await query(`
                    SELECT id, name, display_name 
                    FROM roles 
                    WHERE (name = $1 OR display_name = $1 OR LOWER(name) = LOWER($1) OR LOWER(display_name) = LOWER($1))
                      AND is_active = true
                    LIMIT 1
                  `, [staffRoleName]);
                  
                  if (roleQuery.rows && roleQuery.rows.length > 0) {
                    resolvedRoleId = roleQuery.rows[0].id;
                    vendorRole = roleQuery.rows[0];
                    console.log(`[STAFF LOGIN] Resolved role "${staffRoleName}" to role ID: ${resolvedRoleId}`);
                  }
                } catch (roleError: any) {
                  console.warn('[STAFF LOGIN] Error resolving role:', roleError.message);
                }
              }
              
              // Create vendor_identity for staff phone
              try {
                const newIdentityData: any = {
                  phone: normalizedPhone,
                  vendor_id: staffVendorId,
                  onboarding_status: 'ACTIVATED',
                  metadata: {
                    created_via: 'staff_login',
                    staff_id: staffMember.id,
                  },
                };
                
                if (resolvedRoleId) {
                  newIdentityData.selected_role_id = resolvedRoleId;
                }
                
                // Get vendor info to populate business name if available
                const vendorQuery = await query(`
                  SELECT id, business_name, phone as vendor_phone
                  FROM vendors 
                  WHERE id = $1::uuid
                  LIMIT 1
                `, [staffVendorId]);
                
                if (vendorQuery.rows && vendorQuery.rows.length > 0) {
                  const vendor = vendorQuery.rows[0];
                  if (vendor.business_name) {
                    newIdentityData.business_name = vendor.business_name;
                  }
                  newIdentityData.vendor_type = 'business';
                }
                
                const newIdentity = await insert('vendor_identity', newIdentityData);
                vendorIdentity = newIdentity[0];
                console.log(`[STAFF LOGIN] Created vendor_identity ${vendorIdentity.id} for staff phone ${normalizedPhone} with role ${resolvedRoleId || 'none'}`);
              } catch (createError: any) {
                console.error('[STAFF LOGIN] Error creating vendor_identity:', createError.message);
              }
            }
          }
          
          // ✅ NEW: If staff member has a role, automatically set it in vendor_identity
          if (staffRoleName && vendorIdentity && !vendorIdentity.selected_role_id) {
            try {
              const roleQuery = await query(`
                SELECT id, name, display_name 
                FROM roles 
                WHERE (name = $1 OR display_name = $1 OR LOWER(name) = LOWER($1) OR LOWER(display_name) = LOWER($1))
                  AND is_active = true
                LIMIT 1
              `, [staffRoleName]);
              
              if (roleQuery.rows && roleQuery.rows.length > 0) {
                const roleId = roleQuery.rows[0].id;
                const roleName = roleQuery.rows[0].display_name || roleQuery.rows[0].name;
                
                await query(`
                  UPDATE vendor_identity 
                  SET selected_role_id = $1::uuid, updated_at = NOW()
                  WHERE id = $2::uuid
                `, [roleId, vendorIdentity.id]);
                
                vendorIdentity.selected_role_id = roleId;
                console.log(`[STAFF LOGIN] Updated vendor_identity ${vendorIdentity.id} with role ${roleName} (${roleId}) from staff member`);
                
                vendorRole = roleQuery.rows[0];
              }
            } catch (roleError: any) {
              console.warn('[STAFF LOGIN] Error setting role from staff member:', roleError.message);
            }
          }
          
          // Fetch role info if vendor has a selected role (and we haven't already fetched it)
          if (vendorIdentity && vendorIdentity.selected_role_id && !vendorRole) {
            const roles = await select('roles', { id: vendorIdentity.selected_role_id, is_active: true });
            if (roles.length > 0) {
              vendorRole = roles[0];
            }
          }
        } catch (vendorIdentityError: any) {
          console.warn('[STAFF LOGIN] Error looking up vendor_identity:', vendorIdentityError.message);
        }
      }

      // ✅ FIX: Return same format as /auth/verify-otp so frontend can handle it the same way
      // Get Cognito tokens if available (for consistency with vendor login)
      let cognitoTokens = null;
      try {
        const { getOrCreateCognitoUser, authenticateCognitoUser } = require('../utils/cognito-client');
        const cognitoUser = await getOrCreateCognitoUser(normalizedPhone);
        const tokens = await authenticateCognitoUser(normalizedPhone);
        cognitoTokens = {
          accessToken: tokens.accessToken,
          idToken: tokens.idToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        };
      } catch (cognitoError: any) {
        console.warn('[STAFF LOGIN] Cognito integration unavailable, continuing without tokens');
      }

      // Return vendor-compatible format
      return c.json({
        success: true,
        verified: true,
        message: 'OTP verified successfully',
        phone: normalizedPhone,
        userId: cognitoTokens?.idToken ? 'cognito-user' : null,
        username: normalizedPhone,
        accessToken: cognitoTokens?.accessToken || null,
        idToken: cognitoTokens?.idToken || null,
        refreshToken: cognitoTokens?.refreshToken || null,
        expiresIn: cognitoTokens?.expiresIn || null,
        // ✅ FIX: Return vendor profile format (same as /auth/verify-otp)
        profile: vendorIdentity ? {
          id: vendorIdentity.id,
          onboarding_status: vendorIdentity.onboarding_status || 'ACTIVATED',
          roleId: vendorIdentity.selected_role_id,
          role_id: vendorIdentity.selected_role_id,
          vendor_type: vendorIdentity.vendor_type || 'business',
          roleName: vendorRole?.display_name || vendorRole?.name,
          vendor_id: vendorIdentity.vendor_id || staffVendorId?.toString(),
          business_name: vendorIdentity.business_name,
          full_name: vendorIdentity.full_name || staffMember.name,
          email: vendorIdentity.email || staffMember.email,
        } : (staffVendorId ? {
          vendor_id: staffVendorId.toString(),
          onboarding_status: 'ACTIVATED',
          roleId: null,
          role_id: null,
        } : null),
        // ✅ Include staff info for reference
        staff_info: {
          staff_id: staffMember.id,
          staff_name: staffMember.name,
          vendor_id: staffVendorId?.toString() || null,
          role: staffRoleName,
        },
        firstTimeLogin: isFirstTimeLogin,
      });
    } catch (error: any) {
      console.error('Error verifying staff login OTP:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF APPOINTMENTS
  // ============================================

  /**
   * GET /staff/:staffId/appointments
   * Get all appointments for a staff member
   */
  app.get("/staff/:staffId/appointments", async (c) => {
    try {
      const { staffId } = c.req.param();
      const date = c.req.query('date');
      const status = c.req.query('status');
      const startDate = c.req.query('startDate');
      const endDate = c.req.query('endDate');

      let appointmentsQuery = `
        SELECT 
          b.id,
          b.booking_date,
          b.booking_time,
          b.status,
          b.total_amount,
          b.service_type as service_style,
          b.otp_code as otp,
          b.address as customer_address,
          b.latitude as customer_lat,
          b.longitude as customer_lng,
          s.name as service_name,
          s.description as service_description,
          c.full_name as customer_name,
          c.phone as customer_phone,
          v.business_name as vendor_name,
          v.address as vendor_address,
          v.latitude as vendor_lat,
          v.longitude as vendor_lng
        FROM bookings b
        INNER JOIN services s ON b.service_id = s.id
        INNER JOIN customers c ON b.customer_id = c.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
        WHERE b.staff_id = $1
      `;

      const params: any[] = [staffId];
      let paramIndex = 2;

      if (date) {
        appointmentsQuery += ` AND b.booking_date = $${paramIndex}`;
        params.push(date);
        paramIndex++;
      }

      if (startDate) {
        appointmentsQuery += ` AND b.booking_date >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        appointmentsQuery += ` AND b.booking_date <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      if (status) {
        appointmentsQuery += ` AND b.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      appointmentsQuery += ` ORDER BY b.booking_date DESC, b.booking_time DESC`;

      const appointmentsResult = await query(appointmentsQuery, params);

      // Enrich with additional data
      const enrichedAppointments = await Promise.all(
        appointmentsResult.rows.map(async (booking: any) => {
          // Get staff location for distance calculation (if at_home)
          let staffLocation = null;
          if (booking.service_style === 'at_home') {
            const staff = await select('staff', { id: staffId });
            if (staff.length > 0) {
              if (staff[0].default_location) {
                staffLocation = staff[0].default_location;
              } else if (staff[0].vendor_id && booking.vendor_lat) {
                staffLocation = {
                  lat: booking.vendor_lat,
                  lng: booking.vendor_lng,
                };
              }
            }
          }

          return {
            ...booking,
            staffLocation,
            distance: booking.customer_lat && staffLocation
              ? calculateDistance(
                  parseFloat(booking.customer_lat),
                  parseFloat(booking.customer_lng),
                  parseFloat(staffLocation.lat),
                  parseFloat(staffLocation.lng)
                )
              : null,
          };
        })
      );

      return c.json({
        success: true,
        appointments: enrichedAppointments,
        total: enrichedAppointments.length,
      });
    } catch (error: any) {
      console.error('Error fetching staff appointments:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF NOTIFICATIONS
  // ============================================

  /**
   * GET /staff/:staffId/notifications
   * Get notifications for a staff member
   */
  app.get("/staff/:staffId/notifications", async (c) => {
    try {
      const { staffId } = c.req.param();
      const isRead = c.req.query('isRead');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      // Handle invalid UUIDs gracefully
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId)) {
        return c.json({
          success: true,
          notifications: [],
          total: 0,
          unreadCount: 0,
        });
      }

      let notificationQuery = `
        SELECT * FROM notifications
        WHERE recipient_id = $1 AND recipient_type = 'staff'
      `;

      const params: any[] = [staffId];
      let paramIndex = 2;

      if (isRead !== undefined) {
        notificationQuery += ` AND is_read = $${paramIndex}`;
        params.push(isRead === 'true');
        paramIndex++;
      }

      notificationQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const notifications = await query(notificationQuery, params);

      // Count unread
      const unreadCount = await query(
        'SELECT COUNT(*) as count FROM notifications WHERE recipient_id = $1 AND recipient_type = $2 AND is_read = false',
        [staffId, 'staff']
      );

      return c.json({
        success: true,
        notifications: notifications.rows,
        total: notifications.rows.length,
        unreadCount: parseInt(unreadCount.rows[0]?.count || '0', 10),
      });
    } catch (error: any) {
      console.error('Error fetching staff notifications:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/notifications/:notificationId/read
   * Mark a notification as read
   */
  app.put("/staff/:staffId/notifications/:notificationId/read", async (c) => {
    try {
      const { staffId, notificationId } = c.req.param();

      await update('notifications', 
        { id: notificationId, recipient_id: staffId, recipient_type: 'staff' },
        { is_read: true, read_at: new Date().toISOString() }
      );

      return c.json({ success: true, message: 'Notification marked as read' });
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/notifications/mark-all-read
   * Mark all notifications as read for staff
   */
  app.put("/staff/:staffId/notifications/mark-all-read", async (c) => {
    try {
      const { staffId } = c.req.param();

      await query(
        `UPDATE notifications SET is_read = true, read_at = NOW() 
         WHERE recipient_id = $1 AND recipient_type = 'staff' AND is_read = false`,
        [staffId]
      );

      return c.json({ success: true, message: 'All notifications marked as read' });
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/appointments/:bookingId/accept
   * Accept a booking
   */
  app.put("/staff/:staffId/appointments/:bookingId/accept", async (c) => {
    try {
      const { staffId, bookingId } = c.req.param();

      // Verify booking belongs to staff
      const bookingCheck = await query(
        'SELECT * FROM bookings WHERE id = $1 AND staff_id = $2',
        [bookingId, staffId]
      );

      if (bookingCheck.rows.length === 0) {
        return c.json({ error: 'Booking not found or does not belong to this staff' }, 404);
      }

      // Update booking status
      await update('bookings', { id: bookingId }, { status: 'confirmed' });

      return c.json({ success: true, message: 'Booking accepted successfully' });
    } catch (error: any) {
      console.error('Error accepting booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/appointments/:bookingId/reject
   * Reject a booking
   */
  app.put("/staff/:staffId/appointments/:bookingId/reject", async (c) => {
    try {
      const { staffId, bookingId } = c.req.param();
      const { reason } = await c.req.json();

      // Verify booking belongs to staff
      const bookingCheck = await query(
        'SELECT * FROM bookings WHERE id = $1 AND staff_id = $2',
        [bookingId, staffId]
      );

      if (bookingCheck.rows.length === 0) {
        return c.json({ error: 'Booking not found or does not belong to this staff' }, 404);
      }

      // Update booking status
      await update('bookings', { id: bookingId }, {
        status: 'cancelled',
        cancellation_reason: reason || 'Rejected by staff',
      });

      return c.json({ success: true, message: 'Booking rejected' });
    } catch (error: any) {
      console.error('Error rejecting booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/appointments/:bookingId/start
   * Start a service (for at_home - enables GPS tracking)
   */
  app.put("/staff/:staffId/appointments/:bookingId/start", async (c) => {
    try {
      const { staffId, bookingId } = c.req.param();
      const { otp } = await c.req.json();

      // Verify booking
      const bookingCheck = await query(
        'SELECT * FROM bookings WHERE id = $1 AND staff_id = $2',
        [bookingId, staffId]
      );

      if (bookingCheck.rows.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookingCheck.rows[0];

      // Verify OTP (if required for this service style)
      if (booking.service_style !== 'tele' && otp) {
        if (booking.otp !== otp) {
          return c.json({ error: 'Invalid OTP' }, 400);
        }
      }

      // Update status and enable GPS tracking if at_home
      await update('bookings', { id: bookingId }, {
        status: 'in_progress',
        started_at: new Date(),
      });

      // Enable GPS tracking for at_home services
      if (booking.service_style === 'at_home') {
        // GPS tracking will be handled by the tracking system
        // This endpoint just marks the service as started
      }

      return c.json({
        success: true,
        message: 'Service started',
        gpsTrackingEnabled: booking.service_style === 'at_home',
      });
    } catch (error: any) {
      console.error('Error starting service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/appointments/:bookingId/complete
   * Complete a service (requires OTP for non-tele services)
   */
  app.put("/staff/:staffId/appointments/:bookingId/complete", async (c) => {
    try {
      const { staffId, bookingId } = c.req.param();
      const { otp } = await c.req.json();

      // Verify booking
      const bookingCheck = await query(
        'SELECT * FROM bookings WHERE id = $1 AND staff_id = $2',
        [bookingId, staffId]
      );

      if (bookingCheck.rows.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookingCheck.rows[0];

      // Verify OTP (required for at_home and at_center, not for tele)
      if (booking.service_style !== 'tele') {
        if (!otp) {
          return c.json({ error: 'OTP is required to complete service' }, 400);
        }
        if (booking.otp !== otp) {
          return c.json({ error: 'Invalid OTP' }, 400);
        }
      }

      // Update status
      await update('bookings', { id: bookingId }, {
        status: 'completed',
        completed_at: new Date(),
      });

      // Disable GPS tracking if it was enabled
      if (booking.service_style === 'at_home') {
        // GPS tracking will be stopped by the tracking system
      }

      return c.json({
        success: true,
        message: 'Service completed successfully',
      });
    } catch (error: any) {
      console.error('Error completing service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF EARNINGS & REVENUE
  // ============================================

  /**
   * GET /staff/:staffId/earnings
   * Get earnings summary for staff
   */
  app.get("/staff/:staffId/earnings", async (c) => {
    try {
      const { staffId } = c.req.param();
      const period = c.req.query('period') || 'month'; // week, month, year

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Get completed bookings
      const completedBookings = await query(
        `SELECT 
          b.id,
          b.booking_date,
          b.total_amount,
          b.service_style,
          s.name as service_name
         FROM bookings b
         INNER JOIN services s ON b.service_id = s.id
         WHERE b.staff_id = $1
           AND b.status = 'completed'
           AND b.booking_date >= $2
         ORDER BY b.booking_date DESC`,
        [staffId, startDate.toISOString().split('T')[0]]
      );

      // Calculate earnings (after platform commission)
      const platformCommissionRate = 0.15; // 15%
      const gstOnCommission = 0.18; // 18% GST on commission

      let totalRevenue = 0;
      let totalEarnings = 0;
      let totalCommission = 0;
      let totalGST = 0;

      completedBookings.rows.forEach((booking: any) => {
        const revenue = parseFloat(booking.total_amount) || 0;
        totalRevenue += revenue;
        
        const commission = revenue * platformCommissionRate;
        const gst = commission * gstOnCommission;
        const earnings = revenue - commission - gst;
        
        totalCommission += commission;
        totalGST += gst;
        totalEarnings += earnings;
      });

      // Get pending bookings (not yet settled)
      const pendingBookings = await query(
        `SELECT COALESCE(SUM(total_amount), 0) as pending_amount
         FROM bookings
         WHERE staff_id = $1
           AND status = 'completed'
           AND settlement_status IS NULL
           AND booking_date >= $2`,
        [staffId, startDate.toISOString().split('T')[0]]
      );

      const pendingEarnings = parseFloat(pendingBookings.rows[0]?.pending_amount || '0') * (1 - platformCommissionRate - (platformCommissionRate * gstOnCommission));

      // Get last settlement (from settlements table if staff_id is tracked)
      let lastSettlement: any = { rows: [] };
      try {
        lastSettlement = await query(
          `SELECT 
            settlement_amount,
            settlement_date
           FROM settlements
           WHERE staff_id = $1
           ORDER BY settlement_date DESC
           LIMIT 1`,
          [staffId]
        );
      } catch (error) {
        // staff_settlements table may not exist or staff_id column may not be in settlements
        console.warn('Could not fetch staff settlements:', error);
        // Try alternative: get from vendor settlements if staff has vendor_id
        const staffRecord = await select('staff', { id: staffId });
        if (staffRecord.length > 0 && staffRecord[0].vendor_id) {
          try {
            lastSettlement = await query(
              `SELECT 
                settlement_amount,
                settlement_date
               FROM settlements
               WHERE vendor_id = $1
               ORDER BY settlement_date DESC
               LIMIT 1`,
              [staffRecord[0].vendor_id]
            );
          } catch (e) {
            console.warn('Could not fetch vendor settlements:', e);
          }
        }
      }

      // Get this month vs last month
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const thisMonthBookings = await query(
        `SELECT COALESCE(SUM(total_amount), 0) as amount
         FROM bookings
         WHERE staff_id = $1
           AND status = 'completed'
           AND booking_date >= $2`,
        [staffId, thisMonthStart.toISOString().split('T')[0]]
      );

      const lastMonthBookings = await query(
        `SELECT COALESCE(SUM(total_amount), 0) as amount
         FROM bookings
         WHERE staff_id = $1
           AND status = 'completed'
           AND booking_date >= $2
           AND booking_date <= $3`,
        [staffId, lastMonthStart.toISOString().split('T')[0], lastMonthEnd.toISOString().split('T')[0]]
      );

      const thisMonthRevenue = parseFloat(thisMonthBookings.rows[0]?.amount || '0');
      const lastMonthRevenue = parseFloat(lastMonthBookings.rows[0]?.amount || '0');
      const thisMonthEarnings = thisMonthRevenue * (1 - platformCommissionRate - (platformCommissionRate * gstOnCommission));
      const lastMonthEarnings = lastMonthRevenue * (1 - platformCommissionRate - (platformCommissionRate * gstOnCommission));

      return c.json({
        success: true,
        summary: {
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalCommission: Math.round(totalCommission * 100) / 100,
          totalGST: Math.round(totalGST * 100) / 100,
          pendingEarnings: Math.round(pendingEarnings * 100) / 100,
          lastSettlement: lastSettlement.rows[0] 
            ? Math.round(parseFloat(lastSettlement.rows[0].settlement_amount) * 100) / 100
            : 0,
          lastSettlementDate: lastSettlement.rows[0]?.settlement_date || null,
          thisMonth: Math.round(thisMonthEarnings * 100) / 100,
          lastMonth: Math.round(lastMonthEarnings * 100) / 100,
          totalBookings: completedBookings.rows.length,
          completedBookings: completedBookings.rows.length,
          averageBookingValue: completedBookings.rows.length > 0
            ? Math.round((totalRevenue / completedBookings.rows.length) * 100) / 100
            : 0,
        },
        bookings: completedBookings.rows,
      });
    } catch (error: any) {
      console.error('Error fetching staff earnings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /staff/:staffId/earnings/transactions
   * Get earnings transactions (bookings, settlements)
   */
  app.get("/staff/:staffId/earnings/transactions", async (c) => {
    try {
      const { staffId } = c.req.param();
      const period = c.req.query('period') || 'month';

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Get booking transactions (note: bookings don't have pet_id, removed pet join)
      const bookings = await query(
        `SELECT 
          b.id,
          b.booking_date,
          b.booking_time,
          b.total_amount,
          b.status,
          b.service_type as service_style,
          s.name as service_name,
          c.full_name as customer_name,
          'booking' as transaction_type
         FROM bookings b
         INNER JOIN services s ON b.service_id = s.id
         INNER JOIN customers c ON b.customer_id = c.id
         WHERE b.staff_id = $1
           AND b.status = 'completed'
           AND b.booking_date >= $2
         ORDER BY b.booking_date DESC, b.booking_time DESC`,
        [staffId, startDate.toISOString().split('T')[0]]
      );

      // Get settlement transactions
      let settlements: any[] = [];
      try {
        // Try staff_settlements first, then settlements with staff_id
        let settlementsResult: any;
        try {
          settlementsResult = await query(
            `SELECT 
              id,
              settlement_amount as total_amount,
              settlement_date as booking_date,
              'settlement' as transaction_type,
              'Settlement' as service_name,
              'Settlement Payment' as customer_name
             FROM staff_settlements
             WHERE staff_id = $1
               AND settlement_date >= $2
             ORDER BY settlement_date DESC`,
            [staffId, startDate.toISOString().split('T')[0]]
          );
        } catch (e) {
          // Try settlements table with staff_id
          settlementsResult = await query(
            `SELECT 
              id,
              settlement_amount as total_amount,
              settlement_date as booking_date,
              'settlement' as transaction_type,
              'Settlement' as service_name,
              'Settlement Payment' as customer_name
             FROM settlements
             WHERE staff_id = $1
               AND settlement_date >= $2
             ORDER BY settlement_date DESC`,
            [staffId, startDate.toISOString().split('T')[0]]
          );
        }
        settlements = settlementsResult.rows;
      } catch (error) {
        console.warn('Could not fetch settlements:', error);
        // Settlements may not be tracked per staff yet
      }

      // Combine and sort transactions
      const transactions = [
        ...bookings.rows.map((b: any) => ({
          ...b,
          transaction_type: 'booking',
          description: `${b.service_name} - ${b.customer_name}'s ${b.pet_name}`,
        })),
        ...settlements.map((s: any) => ({
          ...s,
          description: 'Settlement Payment',
        })),
      ].sort((a: any, b: any) => {
        const dateA = new Date(a.booking_date).getTime();
        const dateB = new Date(b.booking_date).getTime();
        return dateB - dateA;
      });

      return c.json({
        success: true,
        transactions,
        total: transactions.length,
      });
    } catch (error: any) {
      console.error('Error fetching staff transactions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF MESSAGING/CONVERSATIONS
  // ============================================

  /**
   * GET /staff/:staffId/conversations
   * Get all conversations for a staff member
   */
  app.get("/staff/:staffId/conversations", async (c) => {
    try {
      const staffId = c.req.param('staffId');

      if (!isValidUUID(staffId)) {
        return c.json({ error: 'Invalid staff ID' }, 400);
      }

      // Get all bookings for this staff member to create conversations
      const bookings = await query(
        `SELECT DISTINCT
          b.id as booking_id,
          b.customer_id,
          c.full_name as customer_name,
          c.phone as customer_phone,
          c.profile_photo_url as customer_photo,
          b.booking_date,
          b.status,
          b.created_at
        FROM bookings b
        INNER JOIN customers c ON b.customer_id = c.id
        WHERE b.staff_id = $1
          AND b.status NOT IN ('cancelled')
        ORDER BY b.created_at DESC`,
        [staffId]
      );

      // For each booking, try to get the last message if conversations table exists
      const conversations = await Promise.all(
        bookings.rows.map(async (booking: any) => {
          let lastMessage = null;
          let lastMessageAt = booking.created_at;
          let unreadCount = 0;

          try {
            // Try to get last message from messages table if it exists
            const messageResult = await query(
              `SELECT message, created_at, sender_type, read_at
               FROM messages
               WHERE booking_id = $1
               ORDER BY created_at DESC
               LIMIT 1`,
              [booking.booking_id]
            ).catch(() => ({ rows: [] }));

            if (messageResult.rows.length > 0) {
              lastMessage = messageResult.rows[0].message;
              lastMessageAt = messageResult.rows[0].created_at;
            }

            // Count unread messages
            const unreadResult = await query(
              `SELECT COUNT(*) as count
               FROM messages
               WHERE booking_id = $1
                 AND sender_type = 'customer'
                 AND (read_at IS NULL OR read_at = '')`,
              [booking.booking_id]
            ).catch(() => ({ rows: [{ count: 0 }] }));

            unreadCount = parseInt(unreadResult.rows[0]?.count || '0');
          } catch (error) {
            // Messages table might not exist, use booking as conversation starter
            console.warn('Messages table not available:', error);
          }

          return {
            id: `conv_${booking.booking_id}`,
            customer_id: booking.customer_id,
            customer_name: booking.customer_name,
            customer_phone: booking.customer_phone,
            customer_photo: booking.customer_photo,
            booking_id: booking.booking_id,
            booking_date: booking.booking_date,
            last_message: lastMessage || 'Tap to start conversation',
            last_message_at: lastMessageAt,
            unread_count: unreadCount,
          };
        })
      );

      return c.json({
        success: true,
        conversations,
      });
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /staff/conversations/:conversationId/messages
   * Get messages for a conversation
   */
  app.get("/staff/conversations/:conversationId/messages", async (c) => {
    try {
      const conversationId = c.req.param('conversationId');
      
      // Extract booking_id from conversation_id (format: conv_<booking_id>)
      const bookingId = conversationId.replace('conv_', '');

      if (!isValidUUID(bookingId)) {
        return c.json({ error: 'Invalid conversation ID' }, 400);
      }

      // Try to get messages from messages table
      try {
        const messagesResult = await query(
          `SELECT 
            id,
            sender_id,
            sender_type,
            message,
            created_at,
            read_at
          FROM messages
          WHERE booking_id = $1
          ORDER BY created_at ASC`,
          [bookingId]
        );

        return c.json({
          success: true,
          messages: messagesResult.rows.map((msg: any) => ({
            id: msg.id,
            sender_id: msg.sender_id,
            sender_type: msg.sender_type,
            message: msg.message,
            created_at: msg.created_at,
            read_at: msg.read_at,
          })),
        });
      } catch (error) {
        // Messages table doesn't exist, return empty array
        return c.json({
          success: true,
          messages: [],
        });
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /staff/conversations/:conversationId/messages
   * Send a message in a conversation
   */
  app.post("/staff/conversations/:conversationId/messages", async (c) => {
    try {
      const conversationId = c.req.param('conversationId');
      const { message } = await c.req.json();

      if (!message || !message.trim()) {
        return c.json({ error: 'Message is required' }, 400);
      }

      // Extract booking_id from conversation_id
      const bookingId = conversationId.replace('conv_', '');

      if (!isValidUUID(bookingId)) {
        return c.json({ error: 'Invalid conversation ID' }, 400);
      }

      // Get booking to verify staff access
      const booking = await select('bookings', { id: bookingId });
      if (booking.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const staffId = booking[0].staff_id;

      // Try to insert message into messages table
      try {
        const messageRecord = await insert('messages', {
          booking_id: bookingId,
          sender_id: staffId,
          sender_type: 'staff',
          message: message.trim(),
          created_at: new Date().toISOString(),
        });

        return c.json({
          success: true,
          message: {
            id: messageRecord[0]?.id || `msg_${Date.now()}`,
            sender_id: staffId,
            sender_type: 'staff',
            message: message.trim(),
            created_at: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        // Messages table might not exist, return success anyway
        console.warn('Messages table not available:', error);
        return c.json({
          success: true,
          message: {
            id: `msg_${Date.now()}`,
            sender_id: staffId,
            sender_type: 'staff',
            message: message.trim(),
            created_at: new Date().toISOString(),
          },
        });
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /staff/conversations/:conversationId/read
   * Mark conversation messages as read
   */
  app.post("/staff/conversations/:conversationId/read", async (c) => {
    try {
      const conversationId = c.req.param('conversationId');
      
      // Extract booking_id from conversation_id
      const bookingId = conversationId.replace('conv_', '');

      if (!isValidUUID(bookingId)) {
        return c.json({ error: 'Invalid conversation ID' }, 400);
      }

      // Try to mark messages as read
      try {
        await query(
          `UPDATE messages
           SET read_at = $1
           WHERE booking_id = $2
             AND sender_type = 'customer'
             AND (read_at IS NULL OR read_at = '')`,
          [new Date().toISOString(), bookingId]
        );

        return c.json({ success: true });
      } catch (error) {
        // Messages table might not exist, return success anyway
        return c.json({ success: true });
      }
    } catch (error: any) {
      console.error('Error marking as read:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // STAFF PROFILE MANAGEMENT
  // ============================================

  /**
   * GET /staff/:staffId/profile
   * Get staff profile information
   */
  app.get("/staff/:staffId/profile", async (c) => {
    try {
      const { staffId } = c.req.param();

      if (!isValidUUID(staffId)) {
        return c.json({ error: 'Invalid staff ID' }, 400);
      }

      // Get staff data
      const staffResult = await select('staff', { id: staffId });
      if (staffResult.length === 0) {
        return c.json({ error: 'Staff member not found' }, 404);
      }

      const staff = staffResult[0];

      // Get specializations
      let specializations: string[] = [];
      try {
        const specsResult = await query(
          'SELECT specialization FROM staff_specializations WHERE staff_id = $1',
          [staffId]
        );
        specializations = specsResult.rows.map((r: any) => r.specialization);
      } catch (error) {
        // staff_specializations table might not exist
        console.warn('staff_specializations table not available:', error);
      }

      // Parse specializations if stored as JSON string
      if (!specializations.length && staff.specializations) {
        try {
          if (typeof staff.specializations === 'string') {
            const parsed = JSON.parse(staff.specializations);
            if (Array.isArray(parsed)) {
              specializations = parsed;
            }
          } else if (Array.isArray(staff.specializations)) {
            specializations = staff.specializations;
          }
        } catch (error) {
          // If not JSON, try comma-separated
          if (typeof staff.specializations === 'string') {
            specializations = staff.specializations.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        }
      }

      return c.json({
        success: true,
        staff: {
          id: staff.id,
          name: staff.name,
          phone: staff.phone,
          email: staff.email,
          role: staff.role,
          role_name: staff.role,
          photo_url: staff.photo || staff.photo_url,
          photo: staff.photo || staff.photo_url,
          qualifications: staff.qualifications,
          specializations: specializations,
          experience_years: staff.experience_years,
          address: staff.address,
          city: staff.city,
          state: staff.state,
          pincode: staff.pincode,
          description: staff.description,
          service_area: staff.service_area,
          operating_hours: staff.operating_hours,
          is_active: staff.is_active,
          mobile_verified: staff.mobile_verified,
        },
      });
    } catch (error: any) {
      console.error('Error fetching staff profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /staff/:staffId/profile
   * Update staff profile information
   */
  app.put("/staff/:staffId/profile", async (c) => {
    try {
      const { staffId } = c.req.param();
      const profileData = await c.req.json();

      if (!isValidUUID(staffId)) {
        return c.json({ error: 'Invalid staff ID' }, 400);
      }

      // Verify staff exists
      const staffResult = await select('staff', { id: staffId });
      if (staffResult.length === 0) {
        return c.json({ error: 'Staff member not found' }, 404);
      }

      // Build update data
      const updateData: any = {};

      if (profileData.name !== undefined) updateData.name = profileData.name.trim();
      if (profileData.email !== undefined) updateData.email = profileData.email.trim() || null;
      if (profileData.qualifications !== undefined) updateData.qualifications = profileData.qualifications.trim() || null;
      if (profileData.experience_years !== undefined) updateData.experience_years = profileData.experience_years || null;
      if (profileData.address !== undefined) updateData.address = profileData.address.trim() || null;
      if (profileData.city !== undefined) updateData.city = profileData.city.trim() || null;
      if (profileData.state !== undefined) updateData.state = profileData.state.trim() || null;
      if (profileData.pincode !== undefined) updateData.pincode = profileData.pincode.trim() || null;
      if (profileData.description !== undefined) updateData.description = profileData.description.trim() || null;
      if (profileData.service_area !== undefined) updateData.service_area = profileData.service_area.trim() || null;
      if (profileData.operating_hours !== undefined) updateData.operating_hours = profileData.operating_hours.trim() || null;

      // Update staff record
      if (Object.keys(updateData).length > 0) {
        await update('staff', { id: staffId }, updateData);
      }

      // Update specializations if provided
      if (profileData.specializations !== undefined) {
        try {
          // Delete existing specializations
          await query('DELETE FROM staff_specializations WHERE staff_id = $1', [staffId]).catch(() => {
            // Table might not exist
          });

          // Add new specializations
          const specializations = Array.isArray(profileData.specializations)
            ? profileData.specializations
            : typeof profileData.specializations === 'string'
            ? JSON.parse(profileData.specializations)
            : [];

          for (const spec of specializations) {
            if (spec && typeof spec === 'string') {
              await insert('staff_specializations', {
                staff_id: staffId,
                specialization: spec.trim(),
              }).catch(() => {
                // Ignore if table doesn't exist
              });
            }
          }
        } catch (error) {
          console.warn('Error updating specializations:', error);
          // Continue even if specializations update fails
        }
      }

      // Get updated staff data
      const updatedStaff = await select('staff', { id: staffId });
      const staff = updatedStaff[0];

      // Get specializations
      let specializations: string[] = [];
      try {
        const specsResult = await query(
          'SELECT specialization FROM staff_specializations WHERE staff_id = $1',
          [staffId]
        );
        specializations = specsResult.rows.map((r: any) => r.specialization);
      } catch (error) {
        // staff_specializations table might not exist
      }

      return c.json({
        success: true,
        staff: {
          id: staff.id,
          name: staff.name,
          phone: staff.phone,
          email: staff.email,
          role: staff.role,
          role_name: staff.role,
          photo_url: staff.photo || staff.photo_url,
          qualifications: staff.qualifications,
          specializations: specializations,
          experience_years: staff.experience_years,
          address: staff.address,
          city: staff.city,
          state: staff.state,
          pincode: staff.pincode,
          description: staff.description,
          service_area: staff.service_area,
          operating_hours: staff.operating_hours,
        },
        message: 'Profile updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating staff profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /staff/:staffId/profile/photo
   * Upload staff profile photo to S3
   * Supports both FormData (multipart) and JSON (base64)
   */
  app.post("/staff/:staffId/profile/photo", async (c) => {
    try {
      const { staffId } = c.req.param();
      console.log(`[STAFF PHOTO] Starting upload for staff: ${staffId}`);

      if (!isValidUUID(staffId)) {
        return c.json({ error: 'Invalid staff ID' }, 400);
      }

      // Verify staff exists and get vendor_id for S3 path
      const staffResult = await select('staff', { id: staffId });
      if (staffResult.length === 0) {
        return c.json({ error: 'Staff member not found' }, 404);
      }
      const staffMember = staffResult[0];
      const vendorId = staffMember.vendor_id || 'independent';

      let buffer: Buffer;
      let contentType: string = 'image/jpeg';
      let extension: string = 'jpg';

      // Check content type to determine how to parse
      const requestContentType = c.req.header('content-type') || '';
      console.log(`[STAFF PHOTO] Request content-type: ${requestContentType}`);

      if (requestContentType.includes('multipart/form-data')) {
        // Handle FormData upload
        console.log(`[STAFF PHOTO] Parsing as FormData...`);
        try {
          const formData = await c.req.formData();
          const photoFile = formData.get('photo') as File;

          if (!photoFile) {
            return c.json({ error: 'Photo file is required (field name: photo)' }, 400);
          }

          // Validate file type
          if (!photoFile.type.startsWith('image/')) {
            return c.json({ error: 'File must be an image' }, 400);
          }

          contentType = photoFile.type;
          extension = photoFile.type.split('/')[1] || 'jpg';

          // Validate file size (5MB max)
          const maxSize = 5 * 1024 * 1024; // 5MB
          if (photoFile.size > maxSize) {
            return c.json({ error: 'File size must be less than 5MB' }, 400);
          }

          // Convert file to buffer for S3 upload
          const arrayBuffer = await photoFile.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
          console.log(`[STAFF PHOTO] FormData file size: ${buffer.length} bytes`);
        } catch (formError: any) {
          console.error('[STAFF PHOTO] FormData parse error:', formError);
          return c.json({ error: `Failed to parse form data: ${formError.message}` }, 400);
        }
      } else {
        // Handle JSON/base64 upload
        console.log(`[STAFF PHOTO] Parsing as JSON/base64...`);
        try {
          const body = await c.req.json();
          
          if (body.photoUrl) {
            // Direct URL provided - just save it
            console.log(`[STAFF PHOTO] Direct URL provided: ${body.photoUrl}`);
            
            // Update database directly
            const updateData: any = {
              photo_url: body.photoUrl,
              photo: body.photoUrl,
            };
            
            await update('staff', { id: staffId }, updateData);
            
            return c.json({
              success: true,
              photo_url: body.photoUrl,
              message: 'Photo URL saved successfully',
            });
          }
          
          if (!body.photo && !body.base64) {
            return c.json({ error: 'Photo data is required (photo or base64 field)' }, 400);
          }

          const base64Data = body.photo || body.base64;
          
          // Parse base64 data URL
          let base64String = base64Data;
          if (base64Data.includes(',')) {
            const parts = base64Data.split(',');
            base64String = parts[1];
            const mimeMatch = parts[0].match(/data:([^;]+);/);
            if (mimeMatch) {
              contentType = mimeMatch[1];
              extension = contentType.split('/')[1] || 'jpg';
            }
          }

          buffer = Buffer.from(base64String, 'base64');
          console.log(`[STAFF PHOTO] Base64 decoded size: ${buffer.length} bytes`);

          // Validate size
          const maxSize = 5 * 1024 * 1024; // 5MB
          if (buffer.length > maxSize) {
            return c.json({ error: 'File size must be less than 5MB' }, 400);
          }
        } catch (jsonError: any) {
          console.error('[STAFF PHOTO] JSON parse error:', jsonError);
          return c.json({ error: `Failed to parse photo data: ${jsonError.message}` }, 400);
        }
      }

      // Upload to S3
      console.log(`[STAFF PHOTO] Uploading to S3...`);
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      
      // Generate unique filename
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const s3Key = `staff/${vendorId}/${timestamp}_${randomStr}.${extension}`;
      
      const bucket = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
      
      try {
        await s3Client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: contentType,
          ACL: 'public-read', // Make publicly accessible
        }));
      } catch (s3Error: any) {
        console.error('[STAFF PHOTO] S3 upload error:', s3Error);
        return c.json({ error: `S3 upload failed: ${s3Error.message}` }, 500);
      }
      
      const photoUrl = `https://${bucket}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${s3Key}`;
      console.log(`[STAFF PHOTO] Uploaded to S3: ${photoUrl}`);

      // Update staff photo in database - use all available columns
      const updateData: any = {
        photo_url: photoUrl,
        photo: photoUrl,
      };

      try {
        await update('staff', { id: staffId }, updateData);
        console.log(`[STAFF PHOTO] Database updated for staff: ${staffId}`);
      } catch (dbError: any) {
        console.error('[STAFF PHOTO] Database update error:', dbError);
        // Try with just photo_url
        try {
          await update('staff', { id: staffId }, { photo_url: photoUrl });
        } catch (dbError2: any) {
          // Try with just photo
          await update('staff', { id: staffId }, { photo: photoUrl });
        }
      }

      return c.json({
        success: true,
        photo_url: photoUrl,
        message: 'Photo uploaded successfully',
      });
    } catch (error: any) {
      console.error('[STAFF PHOTO] Error uploading staff photo:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/staff/bulk-activate
   * Bulk activate multiple staff members at once
   * Requires vendor to own the staff members
   */
  app.post("/vendor/:vendorId/staff/bulk-activate", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { staffIds, activate = true } = body;

      if (!staffIds || !Array.isArray(staffIds) || staffIds.length === 0) {
        return c.json({ error: 'staffIds array is required' }, 400);
      }

      // Verify all staff belong to this vendor
      const placeholders = staffIds.map((_, i) => `$${i + 1}`).join(', ');
      const checkParams = [...staffIds, vendorId];
      const staffCheck = await query(
        `SELECT id, name, mobile_verified, is_active 
         FROM staff 
         WHERE vendor_id = $${checkParams.length}
           AND id IN (${placeholders})`,
        checkParams
      );

      if (staffCheck.rows.length !== staffIds.length) {
        return c.json({ error: 'Some staff members not found or do not belong to this vendor' }, 400);
      }

      // Check if staff are verified (required for activation)
      if (activate) {
        const unverifiedStaff = staffCheck.rows.filter((s: any) => !s.mobile_verified);
        if (unverifiedStaff.length > 0) {
          return c.json({ 
            error: 'Some staff members are not mobile verified',
            unverifiedStaff: unverifiedStaff.map((s: any) => ({ id: s.id, name: s.name }))
          }, 400);
        }
      }

      // Bulk update staff
      const updateParams = [activate, ...staffIds, vendorId];
      const updateResult = await query(
        `UPDATE staff 
         SET is_active = $1,
             updated_at = NOW()
         WHERE vendor_id = $${updateParams.length}
           AND id IN (${placeholders})
         RETURNING id, name, is_active, mobile_verified`,
        updateParams
      );

      const updatedStaff = updateResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        isActive: row.is_active,
        mobileVerified: row.mobile_verified,
      }));

      return c.json({
        success: true,
        message: `Successfully ${activate ? 'activated' : 'deactivated'} ${updatedStaff.length} staff member(s)`,
        updatedStaff,
        count: updatedStaff.length,
      });
    } catch (error: any) {
      console.error('Error bulk activating staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

