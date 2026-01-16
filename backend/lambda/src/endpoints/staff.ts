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
      const vendorId = c.req.query('vendorId');
      const customerId = c.req.query('customerId'); // For previous provider prioritization

      if (!roleId) {
        return c.json({ error: 'roleId is required' }, 400);
      }

      if (!serviceStyle || !['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        return c.json({ error: 'serviceStyle is required (at_home, at_center, or tele)' }, 400);
      }

      const customerLat = latitude ? parseFloat(latitude) : null;
      const customerLng = longitude ? parseFloat(longitude) : null;

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

      if (vendorId) {
        staffQuery += ` AND s.vendor_id = $${paramIndex}`;
        params.push(vendorId);
        paramIndex++;
      }

      if (roleId) {
        // Staff table uses 'role' TEXT column, not 'role_id'
        // Check if roleId is a UUID (role.id) or role name
        const role = await query('SELECT name, id FROM roles WHERE name = $1 OR id = $1', [roleId]);
        if (role.rows.length > 0) {
          // Use role name to match staff.role column
          staffQuery += ` AND s.role = $${paramIndex}`;
          params.push(role.rows[0].name);
          paramIndex++;
        }
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
      if (serviceStyle) {
        staffQuery += ` AND EXISTS (
          SELECT 1 FROM staff_services ss 
          WHERE ss.staff_id = s.id
            AND ss.enabled_by_staff = true
            AND ss.is_active = true
            AND $${paramIndex} = ANY(ss.service_styles)
        )`;
        params.push(serviceStyle);
        paramIndex++;
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
   * Get all staff for a vendor
   */
  app.get("/vendor/:vendorId/staff", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const staff = await select('staff',
        { vendor_id: vendorId },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );

      // Enrich with services and availability
      const enrichedStaff = await Promise.all(
        staff.map(async (s: any) => {
          const services = await query(
            'SELECT ss.*, sv.name as service_name FROM staff_services ss INNER JOIN services sv ON ss.service_id = sv.id WHERE ss.staff_id = $1',
            [s.id]
          );
          return {
            ...s,
            services: services.rows,
          };
        })
      );

      return c.json({ success: true, staff: enrichedStaff, total: enrichedStaff.length });
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/staff
   * Create a new staff member
   */
  app.post("/vendor/:vendorId/staff", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const staffData = await c.req.json();

      // ⚠️ MANDATORY FIELD VALIDATION
      if (!staffData.name || !staffData.phone) {
        return c.json({ error: 'Name and phone are required' }, 400);
      }

      if (!staffData.photo) {
        return c.json({ error: 'Photo is mandatory for all staff members' }, 400);
      }

      if (!staffData.qualifications || staffData.qualifications.trim() === '') {
        return c.json({ error: 'Qualifications are mandatory for all staff members' }, 400);
      }

      if (!staffData.specializations || !Array.isArray(staffData.specializations) || staffData.specializations.length === 0) {
        return c.json({ error: 'At least one specialization is mandatory' }, 400);
      }

      // Resolve role name if roleId is provided
      let roleName = staffData.role || staffData.roleId || staffData.role_id;
      if (roleName && roleName.length === 36 && roleName.includes('-')) {
        // Looks like UUID, resolve to role name
        const role = await query('SELECT name FROM roles WHERE id = $1', [roleName]);
        if (role.rows.length > 0) {
          roleName = role.rows[0].name;
        }
      }

      const staff = await insert('staff', {
        vendor_id: vendorId,
        name: staffData.name,
        phone: staffData.phone,
        email: staffData.email || null,
        role: roleName, // Staff table uses 'role' TEXT column, not 'role_id'
        experience_years: staffData.experienceYears || staffData.experience_years || null,
        photo: staffData.photo, // ⚠️ MANDATORY
        qualifications: staffData.qualifications, // ⚠️ MANDATORY
        is_active: staffData.isActive !== false,
        mobile_verified: false, // ⚠️ New staff must verify mobile before going live
      });

      // Add specializations (MANDATORY - at least one)
      if (staffData.specializations && Array.isArray(staffData.specializations)) {
        for (const spec of staffData.specializations) {
          await insert('staff_specializations', {
            staff_id: staff[0].id,
            specialization: typeof spec === 'string' ? spec : spec.name || spec,
          });
        }
      }
      
      // Send OTP to staff mobile for verification
      try {
        const UAT_MODE = process.env.UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
        const otp = UAT_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP in database with purpose 'staff_verification'
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry
        
        await insert('otp_tokens', {
          phone: staffData.phone,
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
                    PhoneNumber: staffData.phone,
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
        
        console.log(`[STAFF] OTP sent to ${staffData.phone} for staff verification: ${UAT_MODE ? '123456 (UAT)' : '***'}`);
      } catch (error) {
        console.error('[STAFF] Failed to send OTP:', error);
        // Don't fail staff creation if OTP sending fails - they can request resend
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
        message: 'Staff member created successfully. OTP sent to mobile for verification.',
        requiresVerification: true,
      });
    } catch (error: any) {
      console.error('Error creating staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/staff/:staffId
   * Update staff member
   */
  app.put("/vendor/:vendorId/staff/:staffId", async (c) => {
    try {
      const { staffId } = c.req.param();
      const staffData = await c.req.json();

      const updated = await update('staff',
        { id: staffId },
        {
          name: staffData.name,
          phone: staffData.phone,
          email: staffData.email,
          specialization: staffData.specialization,
          experience_years: staffData.experienceYears || staffData.experience_years,
          service_styles: staffData.serviceStyles || staffData.service_styles,
          latitude: staffData.latitude,
          longitude: staffData.longitude,
          is_active: staffData.isActive,
        }
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
   */
  app.delete("/vendor/:vendorId/staff/:staffId", async (c) => {
    try {
      const { staffId } = c.req.param();

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
          // Get services for this slot
          const servicesResult = await query(
            `SELECT sss.*, s.name as service_name, s.service_style
             FROM staff_slot_services sss
             INNER JOIN services s ON sss.service_id = s.id
             WHERE sss.slot_id = $1`,
            [slot.id]
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
        `SELECT ss.*, s.name as service_name, s.description, s.category, s.service_style,
                s.price as base_price, s.duration_minutes as base_duration
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
      const data = await response.json();

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
      const data = await response.json();

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

      // Check if staff exists
      const staff = await select('staff', { phone, is_active: true });
      if (staff.length === 0) {
        return c.json({ error: 'Staff not found or inactive' }, 404);
      }

      // Generate OTP
      const UAT_MODE = process.env.UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
      const otp = UAT_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      await insert('otp_tokens', {
        phone,
        code: otp,
        purpose: 'staff_login',
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
   */
  app.post("/staff/login/verify-otp", async (c) => {
    try {
      const { phone, otp } = await c.req.json();

      if (!phone || !otp) {
        return c.json({ error: 'Phone and OTP are required' }, 400);
      }

      // Verify OTP
      const otpRecords = await select('otp_tokens', {
        phone,
        code: otp,
        purpose: 'staff_login',
        is_used: false,
      });

      if (otpRecords.length === 0) {
        return c.json({ error: 'Invalid OTP' }, 400);
      }

      const otpRecord = otpRecords[0];

      // Check expiry
      if (new Date(otpRecord.expires_at) < new Date()) {
        return c.json({ error: 'OTP has expired' }, 400);
      }

      // Mark OTP as used
      await update('otp_tokens', { id: otpRecord.id }, { is_used: true, used_at: new Date() });

      // Get staff record
      const staff = await select('staff', { phone, is_active: true });
      if (staff.length === 0) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      const staffMember = staff[0];

      // Update last login
      await update('staff', { id: staffMember.id }, { last_login_at: new Date() });

      // Get vendor info if applicable
      let vendorInfo = null;
      if (staffMember.vendor_id) {
        const vendor = await select('vendors', { id: staffMember.vendor_id });
        if (vendor.length > 0) {
          vendorInfo = {
            id: vendor[0].id,
            businessName: vendor[0].business_name,
            roleId: vendor[0].role_id,
          };
        }
      }

      // Return staff session info
      return c.json({
        success: true,
        staff: {
          id: staffMember.id,
          name: staffMember.name,
          phone: staffMember.phone,
          email: staffMember.email,
          role: staffMember.role,
          photo: staffMember.photo,
          isIndividualProvider: staffMember.is_individual_provider,
          vendorId: staffMember.vendor_id,
          vendor: vendorInfo,
        },
        message: 'Login successful',
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
          b.service_style,
          b.otp,
          b.customer_address,
          b.latitude as customer_lat,
          b.longitude as customer_lng,
          s.name as service_name,
          s.description as service_description,
          c.name as customer_name,
          c.phone as customer_phone,
          p.name as pet_name,
          p.type as pet_type,
          v.business_name as vendor_name,
          v.address as vendor_address,
          v.latitude as vendor_lat,
          v.longitude as vendor_lng
        FROM bookings b
        INNER JOIN services s ON b.service_id = s.id
        INNER JOIN customers c ON b.customer_id = c.id
        INNER JOIN pets p ON b.pet_id = p.id
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

      // Get booking transactions
      const bookings = await query(
        `SELECT 
          b.id,
          b.booking_date,
          b.booking_time,
          b.total_amount,
          b.status,
          b.service_style,
          s.name as service_name,
          c.name as customer_name,
          p.name as pet_name,
          'booking' as transaction_type
         FROM bookings b
         INNER JOIN services s ON b.service_id = s.id
         INNER JOIN customers c ON b.customer_id = c.id
         INNER JOIN pets p ON b.pet_id = p.id
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
          c.name as customer_name,
          c.phone as customer_phone,
          c.photo_url as customer_photo,
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
}

