"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerVendorScheduleEndpoints = registerVendorScheduleEndpoints;
const rds_connection_1 = require("../database/rds-connection");
/**
 * Generate time slots from a time window
 */
function generateTimeSlots(startTime, endTime, slotDuration = 30) {
    const slots = [];
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
function registerVendorScheduleEndpoints(app) {
    /**
     * GET /vendor/:vendorId/slots/:date
     * Get available slots for a vendor on a specific date
     */
    app.get("/vendor/:vendorId/slots/:date", async (c) => {
        try {
            const { vendorId, date } = c.req.param();
            const serviceStyle = c.req.query('serviceStyle') || 'at_center';
            const staffId = c.req.query('staffId');
            // Check vendor exists and is active
            const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
            if (vendors.length === 0) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            const vendor = vendors[0];
            if (!vendor.is_active || vendor.status !== 'approved') {
                return c.json({
                    success: true,
                    slots: [],
                    message: 'Vendor is not available',
                });
            }
            // Check vacation mode
            if (vendor.metadata && typeof vendor.metadata === 'object') {
                const vacationMode = vendor.metadata.vacation_mode;
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
            let scheduleQuery = `
        SELECT * FROM vendor_availability_v2
        WHERE vendor_id = $1
        AND day_of_week = $2
        AND service_style = $3
        AND is_enabled = true
        ORDER BY time_window_start
      `;
            const scheduleParams = [vendorId, dayOfWeek, serviceStyle];
            if (staffId) {
                scheduleQuery = `
          SELECT * FROM staff_schedules
          WHERE staff_id = $1
          AND day_of_week = $2
          AND is_available = true
          ORDER BY start_time
        `;
                scheduleParams[0] = staffId;
                scheduleParams[2] = dayOfWeek;
            }
            const scheduleSlots = await (0, rds_connection_1.query)(scheduleQuery, scheduleParams);
            if (scheduleSlots.rows.length === 0) {
                return c.json({
                    success: true,
                    slots: [],
                    message: 'No availability configured for this day',
                });
            }
            // Get existing bookings for this date
            const bookings = await (0, rds_connection_1.query)(`SELECT booking_time, status, staff_id
         FROM bookings
         WHERE vendor_id = $1
         AND booking_date = $2
         AND status NOT IN ('cancelled', 'no_show')
         ${staffId ? 'AND staff_id = $3' : ''}`, staffId ? [vendorId, date, staffId] : [vendorId, date]);
            // Generate all possible slots
            const allSlots = [];
            const now = new Date();
            const minBookingTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 min from now
            for (const slot of scheduleSlots.rows) {
                const startTime = staffId ? slot.start_time : slot.time_window_start;
                const endTime = staffId ? slot.end_time : slot.time_window_end;
                const slotDuration = slot.slot_duration_minutes || 30;
                const timeSlots = generateTimeSlots(startTime, endTime, slotDuration);
                for (const timeStr of timeSlots) {
                    // Check if slot is in the past
                    const slotDateTime = new Date(date);
                    const [hour, min] = timeStr.split(':').map(Number);
                    slotDateTime.setHours(hour, min, 0, 0);
                    if (slotDateTime < minBookingTime) {
                        continue; // Skip past slots
                    }
                    // Check if slot is already booked
                    const bookedCount = bookings.rows.filter((b) => b.booking_time === timeStr).length;
                    const maxCapacity = slot.max_capacity || 1;
                    const isAvailable = bookedCount < maxCapacity;
                    allSlots.push({
                        time: timeStr,
                        available: isAvailable,
                        bookedCount,
                        maxCapacity,
                        isPast: false,
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
        }
        catch (error) {
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
            const schedule = await (0, rds_connection_1.query)(`SELECT * FROM vendor_schedule_slots
         WHERE vendor_id = $1
         ORDER BY day_of_week, time_window_start`, [vendorId]);
            // Group by day of week
            const scheduleByDay = {};
            for (let i = 0; i < 7; i++) {
                scheduleByDay[i] = [];
            }
            schedule.rows.forEach((slot) => {
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
        }
        catch (error) {
            console.error('Error fetching vendor schedule:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /vendor/:vendorId/schedule
     * Set vendor schedule
     */
    app.post("/vendor/:vendorId/schedule", async (c) => {
        try {
            const { vendorId } = c.req.param();
            const scheduleData = await c.req.json();
            // Expect array of schedule slots
            const slots = Array.isArray(scheduleData.slots) ? scheduleData.slots : [scheduleData];
            const results = [];
            for (const slot of slots) {
                // Delete existing slot for this day/service style if exists
                await (0, rds_connection_1.query)(`DELETE FROM vendor_schedule_slots
           WHERE vendor_id = $1
           AND day_of_week = $2
           AND service_style = $3
           AND time_window_start = $4`, [
                    vendorId,
                    slot.dayOfWeek || slot.day_of_week,
                    slot.serviceStyle || slot.service_style,
                    slot.timeWindowStart || slot.time_window_start,
                ]);
                // Insert new slot
                const result = await (0, rds_connection_1.query)(`INSERT INTO vendor_schedule_slots
           (vendor_id, day_of_week, service_style, time_window_start, time_window_end, slot_duration_minutes, max_capacity, is_enabled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`, [
                    vendorId,
                    slot.dayOfWeek || slot.day_of_week,
                    slot.serviceStyle || slot.service_style,
                    slot.timeWindowStart || slot.time_window_start,
                    slot.timeWindowEnd || slot.time_window_end,
                    slot.slotDurationMinutes || slot.slot_duration_minutes || 30,
                    slot.maxCapacity || slot.max_capacity || 1,
                    slot.isEnabled !== false,
                ]);
                if (result.rows.length > 0) {
                    results.push(result.rows[0]);
                }
            }
            return c.json({
                success: true,
                slots: results,
                message: 'Schedule updated successfully',
            });
        }
        catch (error) {
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
            const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
            if (vendors.length === 0) {
                return c.json({ error: 'Vendor not found' }, 404);
            }
            const vendor = vendors[0];
            const metadata = (vendor.metadata || {});
            // Update vacation mode
            metadata.vacation_mode = {
                isActive: isActive !== false,
                startDate: startDate,
                endDate: endDate,
                message: message || 'Vendor is on vacation',
            };
            await (0, rds_connection_1.query)('UPDATE vendors SET metadata = $1 WHERE id = $2', [JSON.stringify(metadata), vendorId]);
            return c.json({
                success: true,
                vacationMode: metadata.vacation_mode,
                message: 'Vacation mode updated successfully',
            });
        }
        catch (error) {
            console.error('Error setting vacation mode:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=vendor-schedule.js.map