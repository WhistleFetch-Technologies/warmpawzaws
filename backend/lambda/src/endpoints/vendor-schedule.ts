/**
 * ============================================================================
 * VENDOR SCHEDULE & AVAILABILITY ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor schedule and availability:
 * - Get available slots for a date
 * - Set vendor schedule
 * - Check vacation mode
 * - Generate time slots
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query, insert, update } from '../database/rds-connection';
import {
  resolveVendorById,
  getVendorIdsForAvailabilityLookup,
  resolveAndPersistVendorType,
  parseRoleConfigJson,
} from './vendor/endpoints/vendor-profile.vendor';
import {
  computeEffectiveAllowedServiceStyles,
  parseRoleConfigSelectedServiceStyles,
} from '../utils/effective-service-styles';
import { validateScheduleSlot } from '../utils/scheduling-policy-enforcer';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { geocodeAddress } from '../lib/utils/geocode';

/**
 * Generate time slots from a time window
 */
function generateTimeSlots(
  startTime: string,
  endTime: string,
  slotDuration: number = 30
): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentHour = startHour;
  let currentMin = startMin;

  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    slots.push(timeStr);

    currentMin += slotDuration;
    if (currentMin >= 60) {
      currentMin -= 60;
      currentHour += 1;
    }
  }

  return slots;
}

export function registerVendorScheduleEndpoints(app: Hono) {
  /**
   * GET /vendor/:vendorId/slots/:date
   * Get available slots for a vendor on a specific date
   */
  app.get("/vendor/:vendorId/slots/:date", async (c) => {
    try {
      const { vendorId, date } = c.req.param();
      const serviceStyle = c.req.query('serviceStyle') || 'at_center';
      const staffId = c.req.query('staffId');

      // Handle test IDs - return empty schedule
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          schedule: {},
          totalSlots: 0,
        });
      }

      // Resolve vendor (frontend may pass vendor_identity.id)
      let vendor: any;
      try {
        vendor = await resolveVendorById(vendorId);
        if (!vendor) {
          return c.json({ error: 'Vendor not found' }, 404);
        }
      } catch (error: any) {
        if (error.message?.includes('invalid input syntax for type uuid')) {
          return c.json({
            success: true,
            schedule: {},
            totalSlots: 0,
          });
        }
        throw error;
      }
      const resolvedVendorId = vendor.id;
      if (!vendor.is_active || vendor.status !== 'approved') {
        return c.json({
          success: true,
          slots: [],
          message: 'Vendor is not available',
        });
      }

      // Check vacation mode
      if (vendor.metadata && typeof vendor.metadata === 'object') {
        const vacationMode = (vendor.metadata as any).vacation_mode;
        if (vacationMode && vacationMode.isActive) {
          const vacationStart = new Date(vacationMode.startDate);
          const vacationEnd = new Date(vacationMode.endDate);
          const requestedDate = new Date(date);

          if (requestedDate >= vacationStart && requestedDate <= vacationEnd) {
            return c.json({
              success: true,
              slots: [],
              onVacation: true,
              vacationMessage: vacationMode.message || 'Vendor is on vacation',
            });
          }
        }
      }

      // Get day of week (0 = Sunday, 6 = Saturday)
      const requestedDate = new Date(date);
      const dayOfWeek = requestedDate.getDay();

      // Get vendor schedule slots for this day (use vendor_availability_v2 table)
      // Query by vendor_id OR vendor_identity_id so slots are found regardless of which id was used when saving
      let scheduleSlots;
      const availabilityIds = await getVendorIdsForAvailabilityLookup(resolvedVendorId);
      
      if (staffId) {
        scheduleSlots = await query(
          `SELECT * FROM staff_schedules
           WHERE staff_id = $1
           AND day_of_week = $2
           AND is_available = true
           ORDER BY start_time`,
          [staffId, dayOfWeek]
        );
      } else {
        // Try with service_style first, then service_type
        try {
          scheduleSlots = await query(
            `SELECT *, time_window_start as start_time, time_window_end as end_time 
             FROM vendor_availability_v2
             WHERE vendor_id::text = ANY($1::text[])
             AND day_of_week = $2
             AND (COALESCE(service_style, service_type) = $3 
                  OR $3 = ANY(COALESCE(service_styles, ARRAY[]::text[])))
             AND COALESCE(is_enabled, is_available, true) = true
             ORDER BY COALESCE(time_window_start, start_time)`,
            [availabilityIds, dayOfWeek, serviceStyle]
          );
        } catch (queryErr: any) {
          if (queryErr.message?.includes('service_style') || queryErr.message?.includes('service_styles')) {
            scheduleSlots = await query(
              `SELECT *, start_time as time_window_start, end_time as time_window_end 
               FROM vendor_availability_v2
               WHERE vendor_id::text = ANY($1::text[])
               AND day_of_week = $2
               AND (COALESCE(service_style, service_type) = $3 OR $3 = ANY(COALESCE(service_styles, ARRAY[]::text[])))
               AND COALESCE(is_available, is_enabled, true) = true
               ORDER BY start_time`,
              [availabilityIds, dayOfWeek, serviceStyle]
            );
          } else {
            throw queryErr;
          }
        }
      }

      if (scheduleSlots.rows.length === 0) {
        return c.json({
          success: true,
          slots: [],
          message: 'No availability configured for this day',
        });
      }

      // Get existing bookings for this date
      const bookings = await query(
        `SELECT booking_time, status, staff_id
         FROM bookings
         WHERE vendor_id = $1
         AND booking_date = $2
         AND status NOT IN ('cancelled', 'no_show')
         ${staffId ? 'AND staff_id = $3' : ''}`,
        staffId ? [resolvedVendorId, date, staffId] : [resolvedVendorId, date]
      );

      // ✅ ENFORCE: Get scheduling policies for validation
      const policies = await query(
        `SELECT * FROM scheduling_policies WHERE is_active = true`
      ).catch(() => ({ rows: [] }));

      // Get policy configs
      const bufferPolicy = policies.rows.find((p: any) => p.policy_type === 'buffer_time');
      const capacityPolicy = policies.rows.find((p: any) => p.policy_type === 'booking_capacity');
      const minNoticeMinutes = bufferPolicy?.policy_config?.minBufferTime || 30;

      // Generate all possible slots
      const allSlots: any[] = [];
      const now = new Date();
      const minBookingTime = new Date(now.getTime() + minNoticeMinutes * 60 * 1000); // Configurable buffer

      for (const slot of scheduleSlots.rows) {
        const startTime = staffId ? slot.start_time : slot.time_window_start;
        const endTime = staffId ? slot.end_time : slot.time_window_end;
        const slotDuration = slot.slot_duration_minutes || 30;

        const timeSlots = generateTimeSlots(startTime, endTime, slotDuration);

        for (const timeStr of timeSlots) {
          // ✅ ENFORCE: Check if slot is in the past (using policy buffer time)
          const slotDateTime = new Date(date);
          const [hour, min] = timeStr.split(':').map(Number);
          slotDateTime.setHours(hour, min, 0, 0);

          const isPast = slotDateTime < minBookingTime;
          if (isPast) {
            continue; // Skip past slots
          }

          // ✅ ENFORCE: Check if slot is already booked (double booking prevention)
          const bookedCount = bookings.rows.filter(
            (b: any) => b.booking_time === timeStr && 
            !['cancelled', 'no_show', 'completed'].includes(b.status)
          ).length;

          // ✅ ENFORCE: Capacity policy
          const maxCapacityPerSlot = capacityPolicy?.policy_config?.maxConcurrentBookingsPerVendor || 
                                    slot.max_capacity || 1;
          const slotMaxCapacity = Math.min(slot.max_capacity || 1, maxCapacityPerSlot);
          const isAvailable = bookedCount < slotMaxCapacity;

          allSlots.push({
            time: timeStr,
            available: isAvailable,
            bookedCount,
            maxCapacity: slotMaxCapacity,
            isPast: false, // Already filtered out past slots above
          });
        }
      }

      return c.json({
        success: true,
        slots: allSlots,
        date,
        onVacation: false,
        totalAvailable: allSlots.filter((s) => s.available).length,
        totalSlots: allSlots.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor slots:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/schedule
   * Get vendor schedule configuration
   * ✅ Resolves vendor via resolveVendorById so identity ID works (new vendors)
   */
  app.get("/vendor/:vendorId/schedule", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const trimmedId = (vendorId || '').trim();

      // Always return schedule as Record<number, any[]> so UI never gets .map on non-array
      const emptyScheduleByDay: Record<number, any[]> = {};
      for (let i = 0; i < 7; i++) {
        emptyScheduleByDay[i] = [];
      }
      const emptyResponse = () => c.json({
        success: true,
        schedule: emptyScheduleByDay,
        totalSlots: 0,
      });

      // Handle test IDs - return empty schedule
      if (trimmedId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId)) {
        return emptyResponse();
      }

      // ✅ Resolve vendor (frontend may pass vendor_identity id; data may be stored by vendors.id or vendor_identity.id)
      const vendor = await resolveVendorById(trimmedId);
      const actualVendorId = vendor?.id ?? trimmedId;
      const availabilityIds = await getVendorIdsForAvailabilityLookup(actualVendorId);

      // ✅ Use vendor_availability_v2; query by vendor_id::text = ANY($1::text[]) so slots are found when stored under either vendors.id or vendor_identity.id
      const scheduleByDay: Record<number, any[]> = {};
      for (let i = 0; i < 7; i++) {
        scheduleByDay[i] = [];
      }
      let schedule: { rows: any[] };
      try {
        schedule = await query(
          `SELECT id, vendor_id, staff_id, day_of_week,
                  COALESCE(time_window_start, start_time) AS time_window_start,
                  COALESCE(time_window_end, end_time) AS time_window_end,
                  COALESCE(is_enabled, is_available, true) AS is_enabled
           FROM vendor_availability_v2
           WHERE vendor_id::text = ANY($1::text[])
           ORDER BY day_of_week, COALESCE(time_window_start, start_time)`,
          [availabilityIds]
        );
      } catch (error: any) {
        if (error.message?.includes('invalid input syntax for type uuid')) {
          return emptyResponse();
        }
        if (error.message?.includes('does not exist')) {
          try {
            schedule = await query(
              `SELECT id, vendor_id, staff_id, day_of_week,
                      start_time AS time_window_start, end_time AS time_window_end,
                      is_available AS is_enabled
               FROM vendor_availability_v2
               WHERE vendor_id::text = ANY($1::text[])
               ORDER BY day_of_week, start_time`,
              [availabilityIds]
            );
          } catch (_) {
            return emptyResponse();
          }
        } else {
          throw error;
        }
      }

      const rows = Array.isArray(schedule?.rows) ? schedule.rows : [];
      rows.forEach((slot: any) => {
        const day = slot.day_of_week;
        if (day != null && day >= 0 && day <= 6) {
          if (!scheduleByDay[day]) scheduleByDay[day] = [];
          scheduleByDay[day].push(slot);
        }
      });

      return c.json({
        success: true,
        schedule: scheduleByDay,
        totalSlots: rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor schedule:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/schedule
   * Set vendor schedule
   * ✅ ENFORCES: Admin policies, past booking prevention, double booking prevention
   */
  app.post("/vendor/:vendorId/schedule", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const scheduleData = await c.req.json();

      // Resolve vendor (frontend may pass vendor_identity.id; use canonical vendors.id for storage)
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const resolvedVendorId = vendor.id;

      // Expect array of schedule slots
      const slots = Array.isArray(scheduleData.slots) ? scheduleData.slots : [scheduleData];

      const results = [];
      const validationErrors: string[] = [];

      // ✅ VALIDATION: Validate all slots before making any changes
      for (const slot of slots) {
        const dayOfWeek = slot.dayOfWeek || slot.day_of_week;
        const serviceStyle = slot.serviceStyle || slot.service_style || 'at_center';
        const timeWindowStart = slot.timeWindowStart || slot.time_window_start;
        const timeWindowEnd = slot.timeWindowEnd || slot.time_window_end;
        const maxCapacity = slot.maxCapacity || slot.max_capacity || 1;

        // ✅ ENFORCE: Admin policies, past booking, double booking
        const validation = await validateScheduleSlot(
          resolvedVendorId,
          dayOfWeek,
          timeWindowStart,
          timeWindowEnd,
          serviceStyle,
          maxCapacity
        );

        if (!validation.valid) {
          validationErrors.push(...validation.errors.map(err => 
            `Slot ${timeWindowStart}-${timeWindowEnd} (${serviceStyle}): ${err}`
          ));
        }
      }

      // If any validation errors, return them without making changes
      if (validationErrors.length > 0) {
        return c.json({
          success: false,
          error: 'Schedule validation failed',
          validationErrors,
          message: 'Please fix validation errors before saving schedule'
        }, 400);
      }

      // ✅ All validations passed - proceed with updates
      for (const slot of slots) {
        const dayOfWeek = slot.dayOfWeek || slot.day_of_week;
        const serviceStyle = slot.serviceStyle || slot.service_style || 'at_center';
        const timeWindowStart = slot.timeWindowStart || slot.time_window_start;
        
        // ✅ FIX: Use vendor_availability_v2 table
        // Support both service_style and service_type column names (schema migration difference)
        // Delete existing slot for this day/service style if exists
        try {
          await query(
            `DELETE FROM vendor_availability_v2
             WHERE vendor_id = $1
             AND day_of_week = $2
             AND COALESCE(service_style, service_type) = $3
             AND COALESCE(time_window_start, start_time) = $4`,
            [
              resolvedVendorId,
              dayOfWeek,
              serviceStyle,
              timeWindowStart,
            ]
          );
        } catch (deleteErr: any) {
          // Try with service_type if service_style doesn't exist
          if (deleteErr.message?.includes('service_style')) {
            await query(
              `DELETE FROM vendor_availability_v2
               WHERE vendor_id = $1
               AND day_of_week = $2
               AND service_type = $3
               AND start_time = $4`,
              [resolvedVendorId, dayOfWeek, serviceStyle, timeWindowStart]
            );
          }
        }

        // Insert new slot - try with service_style first, then service_type
        let result;
        try {
          result = await query(
            `INSERT INTO vendor_availability_v2
             (vendor_id, day_of_week, service_style, time_window_start, time_window_end, slot_duration_minutes, max_capacity, is_enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
              resolvedVendorId,
              dayOfWeek,
              serviceStyle,
              timeWindowStart,
              slot.timeWindowEnd || slot.time_window_end,
              slot.slotDurationMinutes || slot.slot_duration_minutes || 30,
              slot.maxCapacity || slot.max_capacity || 1,
              slot.isEnabled !== false,
            ]
          );
        } catch (insertErr: any) {
          // Fallback to service_type column if service_style doesn't exist
          if (insertErr.message?.includes('service_style')) {
            result = await query(
              `INSERT INTO vendor_availability_v2
               (vendor_id, day_of_week, service_type, start_time, end_time, is_available)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *`,
              [
                resolvedVendorId,
                dayOfWeek,
                serviceStyle,
                timeWindowStart,
                slot.timeWindowEnd || slot.time_window_end,
                slot.isEnabled !== false,
              ]
            );
          } else {
            throw insertErr;
          }
        }

        if (result && result.rows.length > 0) {
          results.push(result.rows[0]);
        }
      }

      return c.json({
        success: true,
        slots: results,
        message: 'Schedule updated successfully',
      });
    } catch (error: any) {
      console.error('Error setting vendor schedule:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/vacation
   * Set vacation mode for vendor
   */
  app.put("/vendor/:vendorId/vacation", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { startDate, endDate, message, isActive } = await c.req.json();

      // Get current vendor metadata
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];
      // ✅ FIX: Check if metadata column exists before using it
      try {
        const columnCheck = await query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_name = 'vendors' AND column_name = 'metadata'`
        );
        
        if (columnCheck.rows.length === 0) {
          // Column doesn't exist, add it
          console.log('[VACATION] Metadata column missing, adding it...');
          await query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS metadata JSONB');
          console.log('[VACATION] Metadata column added successfully');
        }
      } catch (metadataError: any) {
        console.error('[VACATION] Error checking/adding metadata column:', metadataError);
      }

      const metadata = (vendor.metadata || {}) as any;

      // Update vacation mode
      metadata.vacation_mode = {
        isActive: isActive !== false,
        startDate: startDate,
        endDate: endDate,
        message: message || 'Vendor is on vacation',
      };

      await query(
        'UPDATE vendors SET metadata = $1 WHERE id = $2',
        [JSON.stringify(metadata), vendorId]
      );

      return c.json({
        success: true,
        vacationMode: metadata.vacation_mode,
        message: 'Vacation mode updated successfully',
      });
    } catch (error: any) {
      console.error('Error setting vacation mode:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // VENDOR AVAILABILITY SLOTS (for solo providers)
  // Similar to staff availability slots but for vendors
  // ============================================

  /**
   * GET /vendor/:vendorId/availability-slots
   * Get all availability slots for a vendor (solo provider)
   */
  app.get("/vendor/:vendorId/availability-slots", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const startDate = c.req.query('startDate') || new Date().toISOString().split('T')[0];
      const endDate = c.req.query('endDate');

      // Handle test IDs
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({ success: true, slots: [] });
      }

      // Check if vendor_availability_slots table exists
      let slotsQuery = `
        SELECT vas.*
        FROM vendor_availability_slots vas
        WHERE vas.vendor_id = $1
        AND vas.date >= $2
      `;
      const params: any[] = [vendorId, startDate];

      if (endDate) {
        slotsQuery += ` AND vas.date <= $3`;
        params.push(endDate);
      }

      slotsQuery += ` ORDER BY vas.date, vas.start_time`;

      const slotsResult = await query(slotsQuery, params).catch(() => ({ rows: [] }));
      const slots = slotsResult.rows;

      // Enrich with services and breaks
      const enrichedSlots = await Promise.all(
        slots.map(async (slot: any) => {
          // Get services for this slot
          const servicesResult = await query(
            `SELECT vss.*, vs.service_name, vs.service_style
             FROM vendor_slot_services vss
             INNER JOIN vendor_services vs ON vss.service_id = vs.id
             WHERE vss.slot_id = $1`,
            [slot.id]
          ).catch(() => ({ rows: [] }));

          // Get breaks for this slot
          const breaksResult = await query(
            `SELECT * FROM vendor_slot_breaks
             WHERE slot_id = $1`,
            [slot.id]
          ).catch(() => ({ rows: [] }));

          return {
            ...slot,
            services: servicesResult.rows,
            breaks: breaksResult.rows,
            service_styles: slot.service_styles || (servicesResult.rows.length > 0 
              ? [...new Set(servicesResult.rows.map((s: any) => s.service_style).filter(Boolean))]
              : []),
          };
        })
      );

      return c.json({ success: true, slots: enrichedSlots });
    } catch (error: any) {
      console.error('Error fetching vendor availability slots:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/availability-slots
   * Create a new availability slot for vendor (solo provider)
   */
  app.post("/vendor/:vendorId/availability-slots", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const slotData = await c.req.json();

      // Validate required fields
      if (!slotData.date || !slotData.startTime || !slotData.endTime) {
        return c.json({ error: 'date, startTime, and endTime are required' }, 400);
      }

      // Check for overlapping slots
      const overlappingCheck = await query(
        `SELECT id FROM vendor_availability_slots
         WHERE vendor_id = $1
         AND date = $2
         AND is_available = true
         AND (
           (start_time <= $3 AND end_time > $3) OR
           (start_time < $4 AND end_time >= $4) OR
           (start_time >= $3 AND end_time <= $4)
         )`,
        [vendorId, slotData.date, slotData.startTime, slotData.endTime]
      ).catch(() => ({ rows: [] }));

      if (overlappingCheck.rows.length > 0) {
        return c.json({ error: 'Slot overlaps with existing availability' }, 400);
      }

      // Create slot - check if table exists, create if not
      let slot;
      try {
        slot = await insert('vendor_availability_slots', {
          vendor_id: vendorId,
          date: slotData.date,
          start_time: slotData.startTime,
          end_time: slotData.endTime,
          location_override: slotData.locationOverride || null,
          is_available: slotData.isAvailable !== false,
          notes: slotData.notes || null,
          service_styles: slotData.serviceStyles || [],
        });
      } catch (insertError: any) {
        // Table might not exist - create it
        if (insertError.message?.includes('does not exist') || insertError.message?.includes('relation')) {
          console.log('[VENDOR SLOTS] Creating vendor_availability_slots table...');
          await query(`
            CREATE TABLE IF NOT EXISTS vendor_availability_slots (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              vendor_id UUID NOT NULL REFERENCES vendors(id),
              date DATE NOT NULL,
              start_time TIME NOT NULL,
              end_time TIME NOT NULL,
              location_override JSONB,
              is_available BOOLEAN DEFAULT true,
              notes TEXT,
              service_styles TEXT[],
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            )
          `).catch(() => {});
          
          await query(`
            CREATE TABLE IF NOT EXISTS vendor_slot_services (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              slot_id UUID NOT NULL REFERENCES vendor_availability_slots(id) ON DELETE CASCADE,
              service_id UUID NOT NULL,
              lead_time_minutes INTEGER DEFAULT 0,
              buffer_time_minutes INTEGER DEFAULT 0,
              radius_km NUMERIC,
              created_at TIMESTAMP DEFAULT NOW()
            )
          `).catch(() => {});
          
          await query(`
            CREATE TABLE IF NOT EXISTS vendor_slot_breaks (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              slot_id UUID NOT NULL REFERENCES vendor_availability_slots(id) ON DELETE CASCADE,
              start_time TIME NOT NULL,
              end_time TIME NOT NULL,
              reason TEXT,
              created_at TIMESTAMP DEFAULT NOW()
            )
          `).catch(() => {});

          // Retry insert
          slot = await insert('vendor_availability_slots', {
            vendor_id: vendorId,
            date: slotData.date,
            start_time: slotData.startTime,
            end_time: slotData.endTime,
            location_override: slotData.locationOverride || null,
            is_available: slotData.isAvailable !== false,
            notes: slotData.notes || null,
            service_styles: slotData.serviceStyles || [],
          });
        } else {
          throw insertError;
        }
      }

      const slotId = slot[0].id;

      // Add services to slot
      if (slotData.services && Array.isArray(slotData.services)) {
        for (const service of slotData.services) {
          await insert('vendor_slot_services', {
            slot_id: slotId,
            service_id: service.serviceId,
            lead_time_minutes: service.leadTimeMinutes || 0,
            buffer_time_minutes: service.bufferTimeMinutes || 0,
            radius_km: service.radiusKm || null,
          }).catch((err) => {
            console.error('Error inserting slot service:', err);
          });
        }
      }

      // Add breaks to slot
      if (slotData.breaks && Array.isArray(slotData.breaks)) {
        for (const breakItem of slotData.breaks) {
          await insert('vendor_slot_breaks', {
            slot_id: slotId,
            start_time: breakItem.startTime,
            end_time: breakItem.endTime,
            reason: breakItem.reason || null,
          }).catch((err) => {
            console.error('Error inserting slot break:', err);
          });
        }
      }

      return c.json({ success: true, slot: slot[0], message: 'Availability slot created successfully' });
    } catch (error: any) {
      console.error('Error creating vendor availability slot:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/availability-slots/:slotId
   * Update an availability slot for vendor (solo provider)
   */
  app.put("/vendor/:vendorId/availability-slots/:slotId", async (c) => {
    try {
      const { vendorId, slotId } = c.req.param();
      const slotData = await c.req.json();

      // Update slot
      const updated = await update('vendor_availability_slots',
        { id: slotId, vendor_id: vendorId },
        {
          date: slotData.date,
          start_time: slotData.startTime,
          end_time: slotData.endTime,
          location_override: slotData.locationOverride,
          is_available: slotData.isAvailable,
          notes: slotData.notes,
          service_styles: slotData.serviceStyles || [],
        }
      ).catch(() => []);

      if (updated.length === 0) {
        return c.json({ error: 'Slot not found' }, 404);
      }

      // Update services (delete and recreate)
      if (slotData.services !== undefined) {
        try {
          await query('DELETE FROM vendor_slot_services WHERE slot_id = $1', [slotId]);
        } catch (err) {
          console.warn(`[VendorSchedule] Failed to delete slot services for ${slotId}:`, err instanceof Error ? err.message : err);
        }
        if (Array.isArray(slotData.services)) {
          for (const service of slotData.services) {
            try {
              await insert('vendor_slot_services', {
                slot_id: slotId,
                service_id: service.serviceId,
                lead_time_minutes: service.leadTimeMinutes || 0,
                buffer_time_minutes: service.bufferTimeMinutes || 0,
                radius_km: service.radiusKm || null,
              });
            } catch (err) {
              console.warn(`[VendorSchedule] Failed to insert slot service for ${slotId}:`, err instanceof Error ? err.message : err);
            }
          }
        }
      }

      // Update breaks (delete and recreate)
      if (slotData.breaks !== undefined) {
        try {
          await query('DELETE FROM vendor_slot_breaks WHERE slot_id = $1', [slotId]);
        } catch (err) {
          console.warn(`[VendorSchedule] Failed to delete slot breaks for ${slotId}:`, err instanceof Error ? err.message : err);
        }
        if (Array.isArray(slotData.breaks)) {
          for (const breakItem of slotData.breaks) {
            try {
              await insert('vendor_slot_breaks', {
                slot_id: slotId,
                start_time: breakItem.startTime,
                end_time: breakItem.endTime,
                reason: breakItem.reason || null,
              });
            } catch (err) {
              console.warn(`[VendorSchedule] Failed to insert slot break for ${slotId}:`, err instanceof Error ? err.message : err);
            }
          }
        }
      }

      return c.json({ success: true, slot: updated[0], message: 'Slot updated successfully' });
    } catch (error: any) {
      console.error('Error updating vendor availability slot:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/availability-slots/:slotId
   * Delete an availability slot for vendor (solo provider)
   */
  app.delete("/vendor/:vendorId/availability-slots/:slotId", async (c) => {
    try {
      const { vendorId, slotId } = c.req.param();

      // Delete related records first
      try {
        await query('DELETE FROM vendor_slot_services WHERE slot_id = $1', [slotId]);
      } catch (err) {
        console.warn(`[VendorSchedule] Failed to delete slot services for ${slotId}:`, err instanceof Error ? err.message : err);
      }
      try {
        await query('DELETE FROM vendor_slot_breaks WHERE slot_id = $1', [slotId]);
      } catch (err) {
        console.warn(`[VendorSchedule] Failed to delete slot breaks for ${slotId}:`, err instanceof Error ? err.message : err);
      }
      try {
        await query('DELETE FROM vendor_availability_slots WHERE id = $1 AND vendor_id = $2', [slotId, vendorId]);
      } catch (err) {
        console.warn(`[VendorSchedule] Failed to delete availability slot ${slotId}:`, err instanceof Error ? err.message : err);
      }

      return c.json({ success: true, message: 'Slot deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting vendor availability slot:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holidays
   * Get holidays for vendor (solo provider)
   */
  app.get("/vendor/:vendorId/holidays", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Check if vendor_holidays table exists
      const holidays = await query(
        `SELECT * FROM vendor_holidays
         WHERE vendor_id = $1
         AND date >= CURRENT_DATE
         ORDER BY date ASC`,
        [vendorId]
      ).catch(() => ({ rows: [] }));

      return c.json({ success: true, holidays: holidays.rows });
    } catch (error: any) {
      console.error('Error fetching vendor holidays:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/holidays
   * Add holiday for vendor (solo provider)
   */
  app.post("/vendor/:vendorId/holidays", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { date, name } = await c.req.json();

      if (!date) {
        return c.json({ error: 'date is required' }, 400);
      }

      // Check if table exists, create if not
      try {
        await insert('vendor_holidays', {
          vendor_id: vendorId,
          date: date,
          name: name || 'Day Off',
        });
      } catch (insertError: any) {
        if (insertError.message?.includes('does not exist') || insertError.message?.includes('relation')) {
          await query(`
            CREATE TABLE IF NOT EXISTS vendor_holidays (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              vendor_id UUID NOT NULL REFERENCES vendors(id),
              date DATE NOT NULL,
              name TEXT,
              created_at TIMESTAMP DEFAULT NOW(),
              UNIQUE(vendor_id, date)
            )
          `).catch(() => {});
          
          await insert('vendor_holidays', {
            vendor_id: vendorId,
            date: date,
            name: name || 'Day Off',
          });
        } else {
          throw insertError;
        }
      }

      return c.json({ success: true, message: 'Holiday added successfully' });
    } catch (error: any) {
      console.error('Error adding vendor holiday:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/holidays/:holidayId
   * Delete holiday for vendor (solo provider)
   */
  app.delete("/vendor/:vendorId/holidays/:holidayId", async (c) => {
    try {
      const { vendorId, holidayId } = c.req.param();

      await query(
        'DELETE FROM vendor_holidays WHERE id = $1 AND vendor_id = $2',
        [holidayId, vendorId]
      ).catch(() => {});

      return c.json({ success: true, message: 'Holiday removed successfully' });
    } catch (error: any) {
      console.error('Error deleting vendor holiday:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // ADVANCED AVAILABILITY ENDPOINTS (Phase 4 Enhancement)
  // ============================================================================

  /**
   * GET /vendor/:vendorId/breaks
   * Get all breaks for a vendor.
   * ✅ Resolves vendorId via resolveVendorById so vendor_identity works (breaks persist on refresh).
   */
  app.get("/vendor/:vendorId/breaks", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const actualVendorId = vendor.id;

      const breaksResult = await query(
        `SELECT * FROM vendor_breaks
         WHERE vendor_id = $1
           AND is_active = true
         ORDER BY day_of_week ASC, start_time ASC`,
        [actualVendorId]
      ).catch(() => ({ rows: [] }));

      return c.json({ 
        success: true, 
        breaks: breaksResult.rows.map((b: any) => ({
          id: b.id,
          dayOfWeek: b.day_of_week,
          breakDate: b.break_date,
          startTime: b.start_time,
          endTime: b.end_time,
          breakType: b.break_type,
          reason: b.reason,
          isRecurring: b.is_recurring,
        }))
      });
    } catch (error: any) {
      console.error('Error fetching vendor breaks:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/breaks
   * Save breaks for a vendor (replaces all breaks).
   * ✅ Resolves vendorId via resolveVendorById so vendor_identity works (breaks persist on refresh).
   */
  app.post("/vendor/:vendorId/breaks", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const actualVendorId = vendor.id;

      const { breaks } = await c.req.json();

      if (!Array.isArray(breaks)) {
        return c.json({ error: 'breaks array is required' }, 400);
      }

      // Ensure vendor_breaks table exists
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS vendor_breaks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            slot_id UUID,
            day_of_week INTEGER,
            break_date DATE,
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            break_type VARCHAR(50) DEFAULT 'custom',
            reason TEXT,
            is_recurring BOOLEAN DEFAULT true,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )
        `);
      } catch (createErr: any) {
        console.log('[BREAKS] Table likely exists:', createErr.message);
      }

      // Delete existing breaks
      await query(
        'DELETE FROM vendor_breaks WHERE vendor_id = $1',
        [actualVendorId]
      ).catch((err) => {
        console.warn('[BREAKS] Delete error (may be OK):', err.message);
      });

      // Insert new breaks - track results
      const insertedBreaks: any[] = [];
      const insertErrors: string[] = [];

      for (const breakItem of breaks) {
        try {
          const result = await query(
            `INSERT INTO vendor_breaks (
              vendor_id, day_of_week, break_date, start_time, end_time,
              break_type, reason, is_recurring, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
            RETURNING id`,
            [
              actualVendorId,
              breakItem.dayOfWeek ?? breakItem.day_of_week ?? null,
              breakItem.breakDate || breakItem.break_date || null,
              breakItem.startTime || breakItem.start_time,
              breakItem.endTime || breakItem.end_time,
              breakItem.breakType || breakItem.break_type || 'custom',
              breakItem.reason || null,
              breakItem.isRecurring ?? breakItem.is_recurring ?? true,
            ]
          );
          if (result.rows.length > 0) {
            insertedBreaks.push(result.rows[0]);
          }
        } catch (e: any) {
          console.error('[BREAKS] Error inserting break:', e.message, breakItem);
          insertErrors.push(`Break ${breakItem.startTime}-${breakItem.endTime}: ${e.message}`);
        }
      }

      if (insertErrors.length > 0) {
        return c.json({
          success: false,
          message: `Some breaks failed to save (${insertedBreaks.length} saved, ${insertErrors.length} failed)`,
          insertedCount: insertedBreaks.length,
          errorCount: insertErrors.length,
          insertErrors,
        }, 400);
      }

      return c.json({
        success: true,
        message: `Breaks saved successfully (${insertedBreaks.length} breaks)`,
        insertedCount: insertedBreaks.length,
        errorCount: 0,
      });
    } catch (error: any) {
      console.error('Error saving vendor breaks:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/holidays-enhanced
   * Get enhanced holidays with vacation support.
   * Resolves vendorId via resolveVendorById so vendor_identity works (holidays persist on refresh).
   */
  app.get("/vendor/:vendorId/holidays-enhanced", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const actualVendorId = vendor.id;

      const holidaysResult = await query(
        `SELECT * FROM vendor_holidays_enhanced
         WHERE vendor_id = $1
           AND is_active = true
           AND (end_date >= CURRENT_DATE OR is_recurring_yearly = true)
         ORDER BY start_date ASC`,
        [actualVendorId]
      ).catch(() => ({ rows: [] }));

      return c.json({ 
        success: true, 
        holidays: holidaysResult.rows.map((h: any) => ({
          id: h.id,
          startDate: h.start_date,
          endDate: h.end_date,
          holidayType: h.holiday_type,
          reason: h.reason,
          isRecurringYearly: h.is_recurring_yearly,
        }))
      });
    } catch (error: any) {
      console.error('Error fetching enhanced holidays:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/holidays-enhanced
   * Save enhanced holidays (replaces all holidays).
   * Resolves vendorId via resolveVendorById so vendor_identity works (holidays persist on refresh).
   */
  app.post("/vendor/:vendorId/holidays-enhanced", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const actualVendorId = vendor.id;

      const { holidays } = await c.req.json();

      if (!Array.isArray(holidays)) {
        return c.json({ error: 'holidays array is required' }, 400);
      }

      // Ensure vendor_holidays_enhanced table exists
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS vendor_holidays_enhanced (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            holiday_type VARCHAR(50) DEFAULT 'holiday',
            reason TEXT,
            is_recurring_yearly BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )
        `);
      } catch (createErr: any) {
        console.log('[HOLIDAYS] Table likely exists:', createErr.message);
      }

      // Delete existing holidays
      await query(
        'DELETE FROM vendor_holidays_enhanced WHERE vendor_id = $1',
        [actualVendorId]
      ).catch((err) => {
        console.warn('[HOLIDAYS] Delete error (may be OK):', err.message);
      });

      // Insert new holidays - track results
      const insertedHolidays: any[] = [];
      const insertErrors: string[] = [];

      for (const holiday of holidays) {
        try {
          const result = await query(
            `INSERT INTO vendor_holidays_enhanced (
              vendor_id, start_date, end_date, holiday_type, reason, is_recurring_yearly, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, true)
            RETURNING id`,
            [
              actualVendorId,
              holiday.startDate || holiday.start_date,
              holiday.endDate || holiday.end_date,
              holiday.holidayType || holiday.holiday_type || 'holiday',
              holiday.reason || null,
              holiday.isRecurringYearly ?? holiday.is_recurring_yearly ?? false,
            ]
          );
          if (result.rows.length > 0) {
            insertedHolidays.push(result.rows[0]);
          }
        } catch (e: any) {
          console.error('[HOLIDAYS] Error inserting holiday:', e.message, holiday);
          insertErrors.push(`Holiday ${holiday.startDate}: ${e.message}`);
        }
      }

      return c.json({ 
        success: true, 
        message: `Holidays saved successfully (${insertedHolidays.length} holidays)`,
        insertedCount: insertedHolidays.length,
        errorCount: insertErrors.length
      });
    } catch (error: any) {
      console.error('Error saving enhanced holidays:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/toggle-online
   * Toggle vendor online status (for solo providers)
   */
  app.post("/vendor/:vendorId/toggle-online", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { isOnline } = await c.req.json();

      if (typeof isOnline !== 'boolean') {
        return c.json({ error: 'isOnline boolean is required' }, 400);
      }

      await query(
        `UPDATE vendors SET 
          is_online = $1, 
          went_offline_at = $2,
          updated_at = NOW()
         WHERE id = $3`,
        [
          isOnline,
          isOnline ? null : new Date(),
          vendorId
        ]
      );

      return c.json({ 
        success: true, 
        isOnline,
        message: isOnline ? 'You are now online' : 'You are now offline' 
      });
    } catch (error: any) {
      console.error('Error toggling online status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/availability
   * Save advanced availability slots with service_styles
   */
  app.post("/vendor/:vendorId/availability", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { slots } = await c.req.json();

      if (!Array.isArray(slots)) {
        return c.json({ error: 'slots array is required' }, 400);
      }

      const trimmedVendorId = (vendorId || '').trim();
      if (!trimmedVendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // ✅ FIX: Use shared resolution (vendors + vendor_identity + auto-create) so newly onboarded vendors work
      let actualVendorId = trimmedVendorId;
      let vendorFound = false;
      const resolvedVendor = await resolveVendorById(trimmedVendorId);
      if (resolvedVendor && resolvedVendor.id) {
        actualVendorId = resolvedVendor.id;
        vendorFound = true;
        console.log(`[AVAILABILITY] ✅ Resolved vendor via resolveVendorById: ${actualVendorId}`);
      }

      if (!vendorFound) {
        console.log(`[AVAILABILITY] 🔍 Looking up vendor with ID: ${trimmedVendorId}`);
        let existingVendor = await select('vendors', { id: trimmedVendorId });
        if (existingVendor.length > 0) {
          vendorFound = true;
          actualVendorId = trimmedVendorId;
          console.log(`[AVAILABILITY] ✅ Vendor found in vendors table: ${actualVendorId}`);
        }
      }

      // Step 2: If not found, check vendor_identity by id
      let identity: any = null;
      if (!vendorFound) {
        const identitiesById = await select('vendor_identity', { id: trimmedVendorId });
        if (identitiesById.length > 0) {
          identity = identitiesById[0];
          console.log(`[AVAILABILITY] ✅ Found vendor_identity by id: ${identity.id}, vendor_id: ${identity.vendor_id}`);
          
          // Check if identity has vendor_id pointing to an existing vendor
          if (identity.vendor_id) {
            const vendorByVendorId = await select('vendors', { id: identity.vendor_id });
            if (vendorByVendorId.length > 0) {
              actualVendorId = identity.vendor_id;
              vendorFound = true;
              console.log(`[AVAILABILITY] ✅ Vendor found via identity.vendor_id: ${actualVendorId}`);
            }
          }
          
          // Also check vendors by phone
          if (!vendorFound && identity.phone) {
            const vendorByPhone = await select('vendors', { phone: identity.phone });
            if (vendorByPhone.length > 0) {
              actualVendorId = vendorByPhone[0].id;
              vendorFound = true;
              console.log(`[AVAILABILITY] ✅ Vendor found by phone: ${actualVendorId}`);
            }
          }
        }
      }
      
      // Step 3: If still not found, check vendor_identity by vendor_id field
      if (!vendorFound && !identity) {
        const identitiesByVendorId = await query(
          `SELECT * FROM vendor_identity WHERE vendor_id = $1 LIMIT 1`,
          [trimmedVendorId]
        );
        if (identitiesByVendorId.rows && identitiesByVendorId.rows.length > 0) {
          identity = identitiesByVendorId.rows[0];
          console.log(`[AVAILABILITY] ✅ Found vendor_identity by vendor_id field: ${identity.id}`);
          const vendorCheck = await select('vendors', { id: trimmedVendorId });
          if (vendorCheck.length > 0) {
            actualVendorId = trimmedVendorId;
            vendorFound = true;
            console.log(`[AVAILABILITY] ✅ Vendor exists with ID: ${actualVendorId}`);
          }
        }
      }
      
      // Step 4: If still not found, try to get phone from JWT and search by phone
      if (!vendorFound && !identity) {
        console.log(`[AVAILABILITY] 🔍 Vendor not found, trying JWT phone lookup...`);
        try {
          const authHeader = c.req.header('Authorization');
          if (authHeader) {
            const token = authHeader.replace(/^Bearer\s+/i, '');
            if (token) {
              const parts = token.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
                const phone = payload.phone || payload.phone_number || payload['cognito:username'];
                if (phone) {
                  console.log(`[AVAILABILITY] 🔍 Trying to find vendor_identity by phone from JWT: ${phone}`);
                  const identitiesByPhone = await select('vendor_identity', { phone });
                  if (identitiesByPhone.length > 0) {
                    identity = identitiesByPhone[0];
                    console.log(`[AVAILABILITY] ✅ Found vendor_identity by phone: ${identity.id}`);
                    // Try to find vendor by phone or use identity.vendor_id
                    if (identity.vendor_id) {
                      const vendorCheck = await select('vendors', { id: identity.vendor_id });
                      if (vendorCheck.length > 0) {
                        actualVendorId = identity.vendor_id;
                        vendorFound = true;
                        console.log(`[AVAILABILITY] ✅ Vendor found via identity.vendor_id: ${actualVendorId}`);
                      }
                    }
                    if (!vendorFound && identity.phone) {
                      const vendorByPhone = await select('vendors', { phone: identity.phone });
                      if (vendorByPhone.length > 0) {
                        actualVendorId = vendorByPhone[0].id;
                        vendorFound = true;
                        console.log(`[AVAILABILITY] ✅ Vendor found by phone: ${actualVendorId}`);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (jwtError) {
          console.warn('[AVAILABILITY] Could not extract phone from JWT:', jwtError);
        }
      }
      
      // If we have identity but no vendor, create vendor record
      if (!vendorFound && identity) {
        if (identity.onboarding_status === 'APPROVED' || identity.onboarding_status === 'ACTIVATED') {
          // Check if vendor exists by phone (there might be an existing vendor with different ID)
          const vendorByPhone = await select('vendors', { phone: identity.phone });
          if (vendorByPhone.length > 0) {
            actualVendorId = vendorByPhone[0].id;
            vendorFound = true;
            console.log(`[AVAILABILITY] ✅ Found existing vendor by phone: ${actualVendorId}`);
          } else {
            // Get application data for vendor details
            const identityId = identity.id;
            const applications = await select('vendor_onboarding_applications', { vendor_identity_id: identityId });
            const application = applications.length > 0 ? applications[0] : null;
            const payload = application?.application_payload || {};
            
            // Create vendors record
            // ✅ FIX: Use identity.vendor_id if it exists, otherwise use identity.id
            const newVendorId = identity.vendor_id || identityId;
            console.log(`[AVAILABILITY] 🔨 Auto-creating vendor record for approved vendor ${identityId}, using vendor ID: ${newVendorId}`);
            try {
              const { resolveNewVendorOnboardingTier } = await import('../utils/onboarding-f100-tier');
              const tr = await resolveNewVendorOnboardingTier({
                email: payload.email,
                businessName: payload.businessName || payload.business_name,
              });
              const newVendor = await insert('vendors', {
                id: newVendorId,
                phone: identity.phone,
                email: payload.email || `vendor-${identity.phone}@warmpawz.app`,
                business_name: payload.businessName || payload.business_name || `Vendor ${identity.phone}`,
                owner_name: payload.contactPersonName || payload.ownerName || 'Vendor Owner',
                role_id: identity.selected_role_id,
                category: 'general',
                address: payload.address || 'Not specified',
                city: payload.city || 'Not specified',
                state: payload.state || 'Not specified',
                pincode: payload.pin || payload.pincode || '',
                status: 'active',
                is_active: true,
                is_deleted: false,
                tier: tr.tier,
                commission_percentage: tr.commission_percentage,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              console.log(`[AVAILABILITY] ✅ Created vendor record for ${newVendorId}`);
              actualVendorId = newVendorId;
              vendorFound = true;
            } catch (createError: any) {
              console.error(`[AVAILABILITY] ❌ Failed to create vendor record:`, createError);
              return c.json({ 
                error: 'Failed to create vendor record',
                details: `Vendor exists in vendor_identity but could not be created in vendors table: ${createError.message}`
              }, 500);
            }
          }
        } else {
          return c.json({ 
            error: 'Vendor not approved or activated',
            details: `Vendor onboarding status is ${identity.onboarding_status}. Please complete approval first.`
          }, 403);
        }
      }
      
      // Final check - if vendor still not found, return error
      if (!vendorFound) {
        const finalCheck = await select('vendors', { id: actualVendorId });
        if (finalCheck.length === 0) {
          console.error(`[AVAILABILITY] ❌ Vendor ${trimmedVendorId} not found after all checks`);
          return c.json({ 
            error: 'Vendor not found',
            details: `Vendor with ID ${trimmedVendorId} does not exist in vendor_identity or vendors table. If you are logged in, please ensure your vendor account is properly set up.`
          }, 404);
        }
        vendorFound = true;
      }
      
      // Use the actual vendor ID (might be different if found by phone or vendor_id)
      const finalVendorId = actualVendorId;

      const vendorGeoRows = await select('vendors', { id: finalVendorId });
      const vendorRowForGeo = vendorGeoRows[0] ?? null;

      async function enrichSlotLocationData(
        raw: unknown,
        vendorRow: { latitude?: unknown; longitude?: unknown; service_radius?: unknown } | null
      ): Promise<Record<string, unknown> | null> {
        if (raw == null || typeof raw !== 'object') return null;
        const loc = { ...(raw as Record<string, unknown>) };
        const address = typeof loc.address === 'string' ? loc.address.trim() : '';
        let latRaw = loc.lat ?? loc.latitude;
        let lngRaw = loc.lng ?? loc.longitude;
        let lat = latRaw != null && latRaw !== '' ? Number(latRaw) : NaN;
        let lng = lngRaw != null && lngRaw !== '' ? Number(lngRaw) : NaN;
        const hasValid = Number.isFinite(lat) && Number.isFinite(lng);
        if (!hasValid && address) {
          const geo = await geocodeAddress(address);
          if (geo) {
            lat = geo.latitude;
            lng = geo.longitude;
          } else if (vendorRow?.latitude != null && vendorRow?.longitude != null) {
            lat = Number(vendorRow.latitude);
            lng = Number(vendorRow.longitude);
          }
        }
        let serviceRadiusKm = loc.serviceRadiusKm ?? loc.service_radius_km;
        if (serviceRadiusKm == null || serviceRadiusKm === '') {
          const sr = vendorRow?.service_radius;
          if (sr != null && sr !== '') serviceRadiusKm = Number(sr);
        } else {
          serviceRadiusKm = Number(serviceRadiusKm);
        }
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          loc.lat = lat;
          loc.lng = lng;
        }
        if (Number.isFinite(Number(serviceRadiusKm))) {
          loc.serviceRadiusKm = Number(serviceRadiusKm);
        }
        return loc;
      }

      // Ensure vendor_availability_v2 has the required columns (add individually to avoid conflicts)
      try {
        await query(`ALTER TABLE vendor_availability_v2 ADD COLUMN IF NOT EXISTS service_styles TEXT[] DEFAULT '{}'`).catch(() => {});
        await query(`ALTER TABLE vendor_availability_v2 ADD COLUMN IF NOT EXISTS location_data JSONB`).catch(() => {});
        await query(`ALTER TABLE vendor_availability_v2 ADD COLUMN IF NOT EXISTS buffer_time INTEGER DEFAULT 15`).catch(() => {});
        await query(`ALTER TABLE vendor_availability_v2 ADD COLUMN IF NOT EXISTS lead_time_by_style JSONB`).catch(() => {});
        // max_capacity column already exists per schema check
      } catch (alterErr: any) {
        console.log('[AVAILABILITY] Column migration note:', alterErr.message);
      }

      // Delete existing availability for this vendor (use finalVendorId)
      await query(
        'DELETE FROM vendor_availability_v2 WHERE vendor_id = $1',
        [finalVendorId]
      ).catch((err) => {
        console.warn('[AVAILABILITY] Delete error (may be OK):', err.message);
      });

      // Insert new slots - track errors properly
      const insertedSlots: any[] = [];
      const insertErrors: string[] = [];

      for (const slot of slots) {
        const serviceStyles = slot.serviceStyles || slot.service_styles || ['at_center'];
        let locationData = slot.locationData || slot.location_data || null;
        if (locationData && typeof locationData === 'object') {
          locationData = await enrichSlotLocationData(locationData, vendorRowForGeo);
        }
        // Lead time per service style (e.g. at_home: 45 travel, at_center: 15 prep, tele: 5 setup); replaces single buffer_time
        const leadTimeByStyle = slot.leadTimeByStyle || slot.lead_time_by_style || null;
        let startTime = slot.timeWindowStart || slot.time_window_start || slot.startTime;
        let endTime = slot.timeWindowEnd || slot.time_window_end || slot.endTime;
        
        // ✅ FIX: Validate and normalize time values
        if (!startTime || !endTime) {
          insertErrors.push(`Slot day ${slot.dayOfWeek ?? slot.day_of_week}: Missing start_time or end_time`);
          continue;
        }
        
        // Convert to string if needed and normalize format
        const normalizeTime = (time: any): string => {
          if (!time) throw new Error('Time value is required');
          const timeStr = String(time).trim();
          
          // Handle various formats: "09:00", "09:00:00", "9:00 AM", etc.
          let normalized = timeStr.toUpperCase().trim();
          const isPM = normalized.includes('PM');
          const isAM = normalized.includes('AM');
          
          // Remove AM/PM
          normalized = normalized.replace(/\s*(AM|PM)\s*/i, '').trim();
          
          // Parse time components
          const parts = normalized.split(':').map(p => p.trim());
          if (parts.length < 2) {
            throw new Error(`Invalid time format: ${timeStr}. Expected HH:MM or HH:MM:SS`);
          }
          
          let hours = parseInt(parts[0], 10);
          const minutes = parseInt(parts[1], 10) || 0;
          const seconds = parts[2] ? parseInt(parts[2], 10) : 0;
          
          // Validate numeric values
          if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
            throw new Error(`Invalid time format: ${timeStr}. Non-numeric values found`);
          }
          
          // Convert 12-hour to 24-hour
          if (isPM && hours !== 12) {
            hours += 12;
          } else if (isAM && hours === 12) {
            hours = 0;
          }
          
          // Validate ranges
          if (hours < 0 || hours > 23) {
            throw new Error(`Invalid hours: ${hours}. Must be 0-23`);
          }
          if (minutes < 0 || minutes > 59) {
            throw new Error(`Invalid minutes: ${minutes}. Must be 0-59`);
          }
          if (seconds < 0 || seconds > 59) {
            throw new Error(`Invalid seconds: ${seconds}. Must be 0-59`);
          }
          
          // Return in HH:MM:SS format (PostgreSQL TIME format)
          return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        };
        
        try {
          const normalizedStartTime = normalizeTime(startTime);
          const normalizedEndTime = normalizeTime(endTime);
          
          // ✅ FIX: Validate that end_time > start_time (required by constraint)
          if (normalizedEndTime <= normalizedStartTime) {
            insertErrors.push(`Slot day ${slot.dayOfWeek ?? slot.day_of_week}: end_time (${normalizedEndTime}) must be greater than start_time (${normalizedStartTime}). Current values violate the valid_time_range constraint.`);
            continue;
          }
          
          // Use correct column names for the vendor_availability_v2 table (supports both 006 and 057+ schemas)
          const isEnabledVal = slot.isEnabled ?? slot.is_enabled ?? true;
          let result: { rows: any[] } = { rows: [] };
          try {
            result = await query(
              `INSERT INTO vendor_availability_v2 (
                vendor_id, day_of_week,
                start_time, end_time,
                time_window_start, time_window_end,
                service_styles, service_type,
                location_data, buffer_time, lead_time_by_style, max_capacity, is_available
              ) VALUES ($1, $2, $3::TIME, $4::TIME, $5::TIME, $6::TIME, $7, $8, $9, $10, $11, $12, $13)
              RETURNING id`,
              [
                finalVendorId,
                slot.dayOfWeek ?? slot.day_of_week,
                normalizedStartTime,
                normalizedEndTime,
                normalizedStartTime,
                normalizedEndTime,
                serviceStyles,
                serviceStyles[0] || 'at_center',
                locationData ? JSON.stringify(locationData) : null,
                null,
                leadTimeByStyle ? JSON.stringify(leadTimeByStyle) : null,
                slot.maxCapacity ?? slot.max_capacity ?? 1,
                isEnabledVal,
              ]
            );
          } catch (insertErr: any) {
            const msg = String(insertErr?.message || '');
            if (msg.includes('is_available') && msg.includes('does not exist')) {
              // 006 schema: table has is_enabled, no is_available; may also have time_window_* and service_style only
              result = await query(
                `INSERT INTO vendor_availability_v2 (
                  vendor_id, day_of_week,
                  time_window_start, time_window_end,
                  service_style, slot_duration_minutes, max_capacity, is_enabled
                ) VALUES ($1, $2, $3::TIME, $4::TIME, $5, 30, $6, $7)
                RETURNING id`,
                [
                  finalVendorId,
                  slot.dayOfWeek ?? slot.day_of_week,
                  normalizedStartTime,
                  normalizedEndTime,
                  serviceStyles[0] || 'at_center',
                  slot.maxCapacity ?? slot.max_capacity ?? 1,
                  isEnabledVal,
                ]
              );
            } else {
              throw insertErr;
            }
          }
          if (result.rows.length > 0) {
            insertedSlots.push(result.rows[0]);
          }
        } catch (e: any) {
          console.error('[AVAILABILITY] Error inserting slot:', e.message, slot);
          insertErrors.push(`Slot day ${slot.dayOfWeek ?? slot.day_of_week}: ${e.message}`);
        }
      }

      // Return detailed response
      if (insertErrors.length > 0 && insertedSlots.length === 0) {
        return c.json({ 
          success: false, 
          error: 'Failed to save all slots',
          details: insertErrors,
          message: 'No slots were saved. Please check your data and try again.'
        }, 500);
      }

      return c.json({ 
        success: true, 
        message: `Availability saved successfully (${insertedSlots.length} slots)`,
        insertedCount: insertedSlots.length,
        errorCount: insertErrors.length,
        errors: insertErrors.length > 0 ? insertErrors : undefined
      });
    } catch (error: any) {
      console.error('Error saving availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/availability
   * Get full availability including slots, breaks, and holidays
   * ✅ Uses resolveVendorById so vendor_identity id (e.g. e23c969e) resolves to actual vendors.id (e.g. 45f32970)
   */
  app.get("/vendor/:vendorId/availability", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Resolve vendor (frontend may pass vendor_identity id; data is stored by vendors.id)
      let vendor = await resolveVendorById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      const persistedVt = await resolveAndPersistVendorType(vendor);
      vendor = { ...vendor, vendor_type: persistedVt };
      const actualVendorId = vendor.id;
      const availabilityIds = await getVendorIdsForAvailabilityLookup(actualVendorId);

      // Align with GET /vendor/:id/profile: parse role config + effective styles (solo strips at_center).
      let roleConfig: Record<string, any> = {};
      let vendorConfiguration: 'solo' | 'business' | null = null;
      let selectedServiceStyles: string[] = [];
      try {
        const roles = await select('roles', { id: vendor.role_id });
        if (roles.length > 0) {
          roleConfig = parseRoleConfigJson(roles[0].config);
          const rawVt = (vendor as any).vendor_type;
          vendorConfiguration =
            rawVt === 'solo' || rawVt === 'business'
              ? rawVt
              : roleConfig.vendorConfiguration === 'solo' || roleConfig.vendorConfiguration === 'business'
                ? roleConfig.vendorConfiguration
                : null;
          selectedServiceStyles = parseRoleConfigSelectedServiceStyles(roleConfig?.serviceStyles);
        }
      } catch (_) {
        /* ignore */
      }

      const computedAllowedStyles = computeEffectiveAllowedServiceStyles(
        selectedServiceStyles,
        vendorConfiguration,
        roleConfig?.serviceStyles
      );
      const allowedServiceStyles = computedAllowedStyles.length > 0 ? computedAllowedStyles : ['at_home', 'tele'];

      const vLat =
        vendor.latitude != null && vendor.latitude !== '' ? Number(vendor.latitude) : NaN;
      const vLng =
        vendor.longitude != null && vendor.longitude !== '' ? Number(vendor.longitude) : NaN;
      const vendorCoordsOk = Number.isFinite(vLat) && Number.isFinite(vLng);

      const mapSlotLocationData = (raw: unknown): Record<string, unknown> | null => {
        if (raw == null) return null;
        let ld: Record<string, unknown>;
        try {
          ld =
            typeof raw === 'string'
              ? JSON.parse(raw || '{}')
              : ({ ...(raw as Record<string, unknown>) } as Record<string, unknown>);
        } catch {
          return null;
        }
        if (!ld || typeof ld !== 'object') return null;
        const lat = ld.lat ?? ld.latitude;
        const lng = ld.lng ?? ld.longitude;
        const has = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
        if (!has && vendorCoordsOk) {
          return { ...ld, lat: vLat, lng: vLng };
        }
        return ld;
      };

      // Get availability slots (query by vendor_id OR vendor_identity_id so slots are found regardless of which id was used when saving)
      let slotsResult: { rows: any[] } = { rows: [] };
      try {
        slotsResult = await query(
          `SELECT * FROM vendor_availability_v2
           WHERE vendor_id::text = ANY($1::text[]) AND (COALESCE(is_available, is_enabled, true) = true OR (is_available IS NULL AND is_enabled IS NULL))
           ORDER BY day_of_week ASC, COALESCE(time_window_start, start_time) ASC`,
          [availabilityIds]
        );
      } catch (_) {
        try {
          slotsResult = await query(
            `SELECT * FROM vendor_availability_v2
             WHERE vendor_id::text = ANY($1::text[]) AND (is_enabled = true OR is_enabled IS NULL)
             ORDER BY day_of_week ASC, time_window_start ASC`,
            [availabilityIds]
          );
        } catch (_) {
          slotsResult = await query(
            `SELECT * FROM vendor_availability_v2
             WHERE vendor_id::text = ANY($1::text[]) AND (is_available = true OR is_available IS NULL)
             ORDER BY day_of_week ASC, start_time ASC`,
            [availabilityIds]
          ).catch(() => ({ rows: [] }));
        }
      }

      // Get breaks
      const breaksResult = await query(
        `SELECT * FROM vendor_breaks
         WHERE vendor_id = $1 AND is_active = true
         ORDER BY day_of_week ASC, start_time ASC`,
        [actualVendorId]
      ).catch(() => ({ rows: [] }));

      // Get holidays (try enhanced table first, fallback to basic)
      let holidaysResult: any = { rows: [] };
      try {
        holidaysResult = await query(
          `SELECT * FROM vendor_holidays_enhanced
           WHERE vendor_id = $1
             AND is_active = true
             AND (end_date >= CURRENT_DATE OR is_recurring_yearly = true)
           ORDER BY start_date ASC`,
          [actualVendorId]
        );
      } catch {
        // Fallback to basic holidays
        holidaysResult = await query(
          `SELECT id, date as start_date, date as end_date, name as reason, 
                  'holiday' as holiday_type, false as is_recurring_yearly
           FROM vendor_holidays
           WHERE vendor_id = $1 AND date >= CURRENT_DATE
           ORDER BY date ASC`,
          [actualVendorId]
        ).catch(() => ({ rows: [] }));
      }

      return c.json({
        success: true,
        allowedServiceStyles,
        availability: {
          slots: slotsResult.rows.map((s: any) => {
            let leadTimeByStyle: Record<string, unknown> | null = null;
            if (s.lead_time_by_style != null) {
              try {
                leadTimeByStyle =
                  typeof s.lead_time_by_style === 'string'
                    ? JSON.parse(s.lead_time_by_style)
                    : s.lead_time_by_style;
              } catch {
                leadTimeByStyle = null;
              }
            }
            return {
              id: s.id,
              dayOfWeek: s.day_of_week,
              startTime: s.time_window_start || s.start_time,
              endTime: s.time_window_end || s.end_time,
              serviceStyles: s.service_styles || (s.service_type ? [s.service_type] : ['at_center']),
              locationData: mapSlotLocationData(s.location_data),
              leadTimeByStyle: leadTimeByStyle || undefined,
              bufferTime: leadTimeByStyle ? undefined : (s.buffer_time || s.buffer_time_minutes || 15),
              maxCapacity: s.max_capacity || 1,
              isEnabled: s.is_available ?? s.is_enabled ?? true,
            };
          }),
          breaks: breaksResult.rows.map((b: any) => ({
            id: b.id,
            dayOfWeek: b.day_of_week,
            breakDate: b.break_date,
            startTime: b.start_time,
            endTime: b.end_time,
            breakType: b.break_type,
            reason: b.reason,
            isRecurring: b.is_recurring,
          })),
          holidays: holidaysResult.rows.map((h: any) => ({
            id: h.id,
            startDate: h.start_date,
            endDate: h.end_date,
            holidayType: h.holiday_type,
            reason: h.reason,
            isRecurringYearly: h.is_recurring_yearly,
          })),
        },
        isOnline: vendor.is_online ?? true,
        vendorType: (vendor as any).vendor_type || vendorConfiguration || 'business',
      });
    } catch (error: any) {
      console.error('Error fetching availability:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

