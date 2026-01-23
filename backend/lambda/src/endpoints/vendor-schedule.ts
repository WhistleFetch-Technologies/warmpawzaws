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
 * Migrated from: supabase/functions/make-server-booking/followup-endpoints-sql.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query, insert, update } from '../database/rds-connection';
import { validateScheduleSlot } from '../utils/scheduling-policy-enforcer';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

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

      // Check vendor exists and is active
      let vendor: any;
      try {
        const vendors = await select('vendors', { id: vendorId });
        if (vendors.length === 0) {
          return c.json({ error: 'Vendor not found' }, 404);
        }
        vendor = vendors[0];
      } catch (error: any) {
        // If UUID validation fails, return empty schedule
        if (error.message?.includes('invalid input syntax for type uuid')) {
          return c.json({
            success: true,
            schedule: {},
            totalSlots: 0,
          });
        }
        throw error;
      }
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
      // Handle both service_style and service_type column names (schema migration difference)
      let scheduleSlots;
      
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
             WHERE vendor_id = $1
             AND day_of_week = $2
             AND service_style = $3
             AND is_enabled = true
             ORDER BY time_window_start`,
            [vendorId, dayOfWeek, serviceStyle]
          );
        } catch (queryErr: any) {
          if (queryErr.message?.includes('service_style')) {
            scheduleSlots = await query(
              `SELECT *, start_time as time_window_start, end_time as time_window_end 
               FROM vendor_availability_v2
               WHERE vendor_id = $1
               AND day_of_week = $2
               AND service_type = $3
               AND is_available = true
               ORDER BY start_time`,
              [vendorId, dayOfWeek, serviceStyle]
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
        staffId ? [vendorId, date, staffId] : [vendorId, date]
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
   */
  app.get("/vendor/:vendorId/schedule", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs - return empty schedule
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        const scheduleByDay: Record<number, any[]> = {};
        for (let i = 0; i < 7; i++) {
          scheduleByDay[i] = [];
        }
        return c.json({
          success: true,
          schedule: scheduleByDay,
          totalSlots: 0,
        });
      }

      // ✅ FIX: Use vendor_availability_v2 table (exists in schema, migration 006)
      // Handle both column name variations
      let schedule;
      try {
        // Try with service_style/time_window columns first
        schedule = await query(
          `SELECT *, 
                  COALESCE(service_style, service_type) as service_style,
                  COALESCE(time_window_start, start_time) as time_window_start,
                  COALESCE(time_window_end, end_time) as time_window_end,
                  COALESCE(is_enabled, is_available) as is_enabled
           FROM vendor_availability_v2
           WHERE vendor_id = $1
           ORDER BY day_of_week, COALESCE(time_window_start, start_time)`,
          [vendorId]
        );
      } catch (error: any) {
        // If UUID validation fails, return empty schedule
        if (error.message?.includes('invalid input syntax for type uuid')) {
          const scheduleByDay: Record<number, any[]> = {};
          for (let i = 0; i < 7; i++) {
            scheduleByDay[i] = [];
          }
          return c.json({
            success: true,
            schedule: scheduleByDay,
            totalSlots: 0,
          });
        }
        throw error;
      }

      // Group by day of week
      const scheduleByDay: Record<number, any[]> = {};
      for (let i = 0; i < 7; i++) {
        scheduleByDay[i] = [];
      }

      schedule.rows.forEach((slot: any) => {
        if (!scheduleByDay[slot.day_of_week]) {
          scheduleByDay[slot.day_of_week] = [];
        }
        scheduleByDay[slot.day_of_week].push(slot);
      });

      return c.json({
        success: true,
        schedule: scheduleByDay,
        totalSlots: schedule.rows.length,
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

      // Verify vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

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
          vendorId,
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
              vendorId,
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
              [vendorId, dayOfWeek, serviceStyle, timeWindowStart]
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
              vendorId,
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
                vendorId,
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
        await query('DELETE FROM vendor_slot_services WHERE slot_id = $1', [slotId]).catch(() => {});
        if (Array.isArray(slotData.services)) {
          for (const service of slotData.services) {
            await insert('vendor_slot_services', {
              slot_id: slotId,
              service_id: service.serviceId,
              lead_time_minutes: service.leadTimeMinutes || 0,
              buffer_time_minutes: service.bufferTimeMinutes || 0,
              radius_km: service.radiusKm || null,
            }).catch(() => {});
          }
        }
      }

      // Update breaks (delete and recreate)
      if (slotData.breaks !== undefined) {
        await query('DELETE FROM vendor_slot_breaks WHERE slot_id = $1', [slotId]).catch(() => {});
        if (Array.isArray(slotData.breaks)) {
          for (const breakItem of slotData.breaks) {
            await insert('vendor_slot_breaks', {
              slot_id: slotId,
              start_time: breakItem.startTime,
              end_time: breakItem.endTime,
              reason: breakItem.reason || null,
            }).catch(() => {});
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
      await query('DELETE FROM vendor_slot_services WHERE slot_id = $1', [slotId]).catch(() => {});
      await query('DELETE FROM vendor_slot_breaks WHERE slot_id = $1', [slotId]).catch(() => {});
      await query('DELETE FROM vendor_availability_slots WHERE id = $1 AND vendor_id = $2', [slotId, vendorId]).catch(() => {});

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
}

