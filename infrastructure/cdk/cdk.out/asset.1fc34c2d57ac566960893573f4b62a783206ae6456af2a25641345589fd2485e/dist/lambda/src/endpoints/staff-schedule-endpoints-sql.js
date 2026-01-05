"use strict";
/**
 * STAFF SCHEDULE MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 *
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 *
 * API endpoints for managing staff scheduling:
 * - Break times (Task 2.1)
 * - Buffer time & preferences (Task 2.2)
 * - Holidays and leave (Task 2.3)
 *
 * Staff-level only (not clinic-wide)
 *
 * Date: 2025-01-28
 * Migration: KV to SQL (19 KV operations → 0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffScheduleEndpointsSQL = staffScheduleEndpointsSQL;
const db_1 = require("../lib/db");
const response_utils_1 = require("./response-utils");
function staffScheduleEndpointsSQL(app) {
    const BASE_PATH = '/make-server-3dd53475';
    // ============================================
    // BREAK MANAGEMENT (TASK 2.1)
    // ============================================
    /**
     * Get all breaks for a staff member
     */
    app.get(`${BASE_PATH}/staff/:staffId/breaks`, async (c) => {
        try {
            const { staffId } = c.req.param();
            console.log(`\n☕ [BREAKS] Getting breaks for staff ${staffId}`);
            // ✅ SQL: Get breaks from staff_breaks table
            const breaks = await (0, db_1.selectQuery)('staff_breaks', { staff_id: staffId }, {
                orderBy: 'start_time',
                orderDirection: 'asc'
            });
            // Transform to match expected format
            const formattedBreaks = (breaks || []).map((b) => ({
                id: b.id,
                start: b.start_time,
                end: b.end_time,
                type: b.break_type || 'lunch',
                label: b.break_type || 'Break',
                date: b.break_date,
                dayOfWeek: b.day_of_week,
                createdAt: b.created_at
            }));
            console.log(`✅ [BREAKS] Found ${formattedBreaks.length} breaks`);
            return (0, response_utils_1.sendSuccess)(c, { breaks: formattedBreaks });
        }
        catch (error) {
            console.error('❌ [BREAKS] Error getting breaks:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to get breaks', 500, { originalError: String(error), breaks: [] });
        }
    });
    /**
     * Add a new break
     */
    app.post(`${BASE_PATH}/staff/:staffId/breaks`, async (c) => {
        try {
            const { staffId } = c.req.param();
            const { break: newBreak } = await c.req.json();
            console.log(`\n➕ [BREAKS] Adding break for staff ${staffId}:`, newBreak);
            // Validate break data
            if (!newBreak.start || !newBreak.end || !newBreak.type || !newBreak.label) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields (start, end, type, label)', 400);
            }
            // ✅ SQL: Insert break into staff_breaks table
            const breakId = `break_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const pool = await (0, db_1.getDbClient)();
            const insertResult = await pool.query(`INSERT INTO staff_breaks (
          id, staff_id, start_time, end_time, break_type, break_date, day_of_week
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`, [
                breakId, staffId, newBreak.start, newBreak.end, newBreak.type,
                newBreak.date || null, newBreak.dayOfWeek !== undefined ? newBreak.dayOfWeek : null
            ]);
            const insertedBreak = insertResult.rows[0];
            console.log(`✅ [BREAKS] Break added successfully`);
            // Get all breaks for response
            const allBreaks = await (0, db_1.selectQuery)('staff_breaks', { staff_id: staffId }, {
                orderBy: 'start_time',
                orderDirection: 'asc'
            });
            const formattedBreaks = (allBreaks || []).map((b) => ({
                id: b.id,
                start: b.start_time,
                end: b.end_time,
                type: b.break_type,
                label: b.break_type,
                date: b.break_date,
                dayOfWeek: b.day_of_week
            }));
            return (0, response_utils_1.sendSuccess)(c, { breaks: formattedBreaks });
        }
        catch (error) {
            console.error('❌ [BREAKS] Error adding break:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to add break', 500, { originalError: String(error) });
        }
    });
    /**
     * Update a break
     */
    app.put(`${BASE_PATH}/staff/:staffId/breaks/:breakId`, async (c) => {
        try {
            const { staffId, breakId } = c.req.param();
            const { break: breakUpdate } = await c.req.json();
            console.log(`\n✏️ [BREAKS] Updating break ${breakId} for staff ${staffId}:`, breakUpdate);
            // ✅ SQL: Update break
            const updateData = {};
            if (breakUpdate.start)
                updateData.start_time = breakUpdate.start;
            if (breakUpdate.end)
                updateData.end_time = breakUpdate.end;
            if (breakUpdate.type)
                updateData.break_type = breakUpdate.type;
            if (breakUpdate.date !== undefined)
                updateData.break_date = breakUpdate.date;
            if (breakUpdate.dayOfWeek !== undefined)
                updateData.day_of_week = breakUpdate.dayOfWeek;
            const pool = await (0, db_1.getDbClient)();
            const updateFields = [];
            const updateParams = [];
            let paramIndex = 1;
            if (breakUpdate.start) {
                updateFields.push(`start_time = $${paramIndex}`);
                updateParams.push(breakUpdate.start);
                paramIndex++;
            }
            if (breakUpdate.end) {
                updateFields.push(`end_time = $${paramIndex}`);
                updateParams.push(breakUpdate.end);
                paramIndex++;
            }
            if (breakUpdate.type) {
                updateFields.push(`break_type = $${paramIndex}`);
                updateParams.push(breakUpdate.type);
                paramIndex++;
            }
            if (breakUpdate.date !== undefined) {
                updateFields.push(`break_date = $${paramIndex}`);
                updateParams.push(breakUpdate.date);
                paramIndex++;
            }
            if (breakUpdate.dayOfWeek !== undefined) {
                updateFields.push(`day_of_week = $${paramIndex}`);
                updateParams.push(breakUpdate.dayOfWeek);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return (0, response_utils_1.sendError)(c, 'No fields to update', 400);
            }
            updateParams.push(breakId, staffId);
            const updatedResult = await pool.query(`UPDATE staff_breaks SET ${updateFields.join(', ')} WHERE id = $${paramIndex} AND staff_id = $${paramIndex + 1} RETURNING *`, updateParams);
            const updatedBreak = updatedResult.rows[0];
            if (!updatedBreak) {
                return (0, response_utils_1.sendError)(c, 'Break not found', 404);
            }
            console.log(`✅ [BREAKS] Break updated successfully`);
            // Get all breaks for response
            const allBreaks = await (0, db_1.selectQuery)('staff_breaks', { staff_id: staffId }, {
                orderBy: 'start_time',
                orderDirection: 'asc'
            });
            const formattedBreaks = (allBreaks || []).map((b) => ({
                id: b.id,
                start: b.start_time,
                end: b.end_time,
                type: b.break_type,
                label: b.break_type,
                date: b.break_date,
                dayOfWeek: b.day_of_week
            }));
            return (0, response_utils_1.sendSuccess)(c, { breaks: formattedBreaks });
        }
        catch (error) {
            console.error('❌ [BREAKS] Error updating break:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to update break', 500, { originalError: String(error) });
        }
    });
    /**
     * Delete a break
     */
    app.delete(`${BASE_PATH}/staff/:staffId/breaks/:breakId`, async (c) => {
        try {
            const { staffId, breakId } = c.req.param();
            console.log(`\n🗑️ [BREAKS] Deleting break ${breakId} for staff ${staffId}`);
            // ✅ SQL: Delete break
            const pool = await (0, db_1.getDbClient)();
            const deleteResult = await pool.query('DELETE FROM staff_breaks WHERE id = $1 AND staff_id = $2', [breakId, staffId]);
            if (deleteResult.rowCount === 0) {
                return (0, response_utils_1.sendError)(c, 'Break not found', 404);
            }
            console.log(`✅ [BREAKS] Break deleted successfully`);
            // Get remaining breaks
            const allBreaks = await (0, db_1.selectQuery)('staff_breaks', { staff_id: staffId }, {
                orderBy: 'start_time',
                orderDirection: 'asc'
            });
            const formattedBreaks = (allBreaks || []).map((b) => ({
                id: b.id,
                start: b.start_time,
                end: b.end_time,
                type: b.break_type,
                label: b.break_type,
                date: b.break_date,
                dayOfWeek: b.day_of_week
            }));
            return (0, response_utils_1.sendSuccess)(c, { breaks: formattedBreaks });
        }
        catch (error) {
            console.error('❌ [BREAKS] Error deleting break:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to delete break', 500, { originalError: String(error) });
        }
    });
    // ============================================
    // PREFERENCES MANAGEMENT (TASK 2.2)
    // ============================================
    /**
     * Get staff preferences (buffer time, slot duration, etc.)
     */
    app.get(`${BASE_PATH}/staff/:staffId/preferences`, async (c) => {
        try {
            const { staffId } = c.req.param();
            console.log(`\n⚙️ [PREFERENCES] Getting preferences for staff ${staffId}`);
            // ✅ SQL: Get preferences from platform_settings
            const settingsResult = await (0, db_1.selectQuery)('platform_settings', {
                setting_key: `staff:${staffId}:preferences`
            });
            const settings = settingsResult[0] || null;
            // Return defaults if not set
            const defaultPreferences = {
                slotDuration: 30,
                bufferMinutes: 5,
                advanceBookingDays: 30,
                sameDayBookingCutoff: '18:00'
            };
            const finalPreferences = settings?.setting_value || defaultPreferences;
            console.log(`✅ [PREFERENCES] Preferences retrieved:`, finalPreferences);
            return (0, response_utils_1.sendSuccess)(c, { preferences: finalPreferences });
        }
        catch (error) {
            console.error('❌ [PREFERENCES] Error getting preferences:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to get preferences', 500, { originalError: String(error), preferences: null });
        }
    });
    /**
     * Update staff preferences
     */
    app.put(`${BASE_PATH}/staff/:staffId/preferences`, async (c) => {
        try {
            const { staffId } = c.req.param();
            const { preferences } = await c.req.json();
            console.log(`\n💾 [PREFERENCES] Updating preferences for staff ${staffId}:`, preferences);
            // Validate preferences
            if (preferences.slotDuration && (preferences.slotDuration < 15 || preferences.slotDuration > 120)) {
                return (0, response_utils_1.sendError)(c, 'Slot duration must be between 15 and 120 minutes', 400);
            }
            if (preferences.bufferMinutes && (preferences.bufferMinutes < 0 || preferences.bufferMinutes > 30)) {
                return (0, response_utils_1.sendError)(c, 'Buffer time must be between 0 and 30 minutes', 400);
            }
            // ✅ SQL: Save preferences in platform_settings
            await (0, db_1.upsertQuery)('platform_settings', {
                setting_key: `staff:${staffId}:preferences`,
                setting_value: preferences,
                setting_type: 'object',
                updated_at: new Date().toISOString()
            }, 'setting_key');
            console.log(`✅ [PREFERENCES] Preferences updated successfully`);
            return (0, response_utils_1.sendSuccess)(c, { preferences }, 'Preferences updated. Please regenerate your availability slots to apply changes.');
        }
        catch (error) {
            console.error('❌ [PREFERENCES] Error updating preferences:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to update preferences', 500, { originalError: String(error) });
        }
    });
    // ============================================
    // HOLIDAY MANAGEMENT (TASK 2.3)
    // ============================================
    /**
     * Get all holidays for a staff member
     */
    app.get(`${BASE_PATH}/staff/:staffId/holidays`, async (c) => {
        try {
            const { staffId } = c.req.param();
            console.log(`\n🏖️ [HOLIDAYS] Getting holidays for staff ${staffId}`);
            // ✅ SQL: Get holidays from staff_holidays table
            const holidays = await (0, db_1.selectQuery)('staff_holidays', { staff_id: staffId }, {
                orderBy: 'holiday_date',
                orderDirection: 'asc'
            });
            // Transform to match expected format
            const formattedHolidays = (holidays || []).map((h) => ({
                id: h.id,
                date: h.holiday_date,
                type: 'holiday', // Default type
                reason: h.holiday_name || 'Holiday',
                name: h.holiday_name,
                createdAt: h.created_at
            }));
            console.log(`✅ [HOLIDAYS] Found ${formattedHolidays.length} holidays`);
            return (0, response_utils_1.sendSuccess)(c, { holidays: formattedHolidays });
        }
        catch (error) {
            console.error('❌ [HOLIDAYS] Error getting holidays:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to get holidays', 500, { originalError: String(error), holidays: [] });
        }
    });
    /**
     * Add a new holiday
     */
    app.post(`${BASE_PATH}/staff/:staffId/holidays`, async (c) => {
        try {
            const { staffId } = c.req.param();
            const { holiday: newHoliday } = await c.req.json();
            console.log(`\n➕ [HOLIDAYS] Adding holiday for staff ${staffId}:`, newHoliday);
            // Validate holiday data
            if (!newHoliday.date || !newHoliday.type || !newHoliday.reason) {
                return (0, response_utils_1.sendError)(c, 'Missing required fields (date, type, reason)', 400);
            }
            // ✅ SQL: Insert holiday into staff_holidays table
            const holidayId = `holiday_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const pool = await (0, db_1.getDbClient)();
            const insertResult = await pool.query(`INSERT INTO staff_holidays (id, staff_id, holiday_date, holiday_name)
         VALUES ($1, $2, $3, $4) RETURNING *`, [holidayId, staffId, newHoliday.date, newHoliday.reason || newHoliday.name]);
            const insertedHoliday = insertResult.rows[0];
            console.log(`✅ [HOLIDAYS] Holiday added successfully`);
            // Get all holidays for response
            const allHolidays = await (0, db_1.selectQuery)('staff_holidays', { staff_id: staffId }, {
                orderBy: 'holiday_date',
                orderDirection: 'asc'
            });
            const formattedHolidays = (allHolidays || []).map((h) => ({
                id: h.id,
                date: h.holiday_date,
                type: 'holiday',
                reason: h.holiday_name,
                name: h.holiday_name
            }));
            return (0, response_utils_1.sendSuccess)(c, { holidays: formattedHolidays }, 'Holiday added. Slots on this date will be automatically blocked.');
        }
        catch (error) {
            console.error('❌ [HOLIDAYS] Error adding holiday:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to add holiday', 500, { originalError: String(error) });
        }
    });
    /**
     * Update a holiday
     */
    app.put(`${BASE_PATH}/staff/:staffId/holidays/:holidayId`, async (c) => {
        try {
            const { staffId, holidayId } = c.req.param();
            const { holiday: holidayUpdate } = await c.req.json();
            console.log(`\n✏️ [HOLIDAYS] Updating holiday ${holidayId} for staff ${staffId}:`, holidayUpdate);
            // ✅ SQL: Update holiday
            const pool = await (0, db_1.getDbClient)();
            const updateFields = [];
            const updateParams = [];
            let paramIndex = 1;
            if (holidayUpdate.date) {
                updateFields.push(`holiday_date = $${paramIndex}`);
                updateParams.push(holidayUpdate.date);
                paramIndex++;
            }
            if (holidayUpdate.reason || holidayUpdate.name) {
                updateFields.push(`holiday_name = $${paramIndex}`);
                updateParams.push(holidayUpdate.reason || holidayUpdate.name);
                paramIndex++;
            }
            if (updateFields.length === 0) {
                return (0, response_utils_1.sendError)(c, 'No fields to update', 400);
            }
            updateParams.push(holidayId, staffId);
            const updatedResult = await pool.query(`UPDATE staff_holidays SET ${updateFields.join(', ')} WHERE id = $${paramIndex} AND staff_id = $${paramIndex + 1} RETURNING *`, updateParams);
            const updatedHoliday = updatedResult.rows[0];
            if (!updatedHoliday) {
                return (0, response_utils_1.sendError)(c, 'Holiday not found', 404);
            }
            console.log(`✅ [HOLIDAYS] Holiday updated successfully`);
            // Get all holidays for response
            const allHolidays = await (0, db_1.selectQuery)('staff_holidays', { staff_id: staffId }, {
                orderBy: 'holiday_date',
                orderDirection: 'asc'
            });
            const formattedHolidays = (allHolidays || []).map((h) => ({
                id: h.id,
                date: h.holiday_date,
                type: 'holiday',
                reason: h.holiday_name,
                name: h.holiday_name
            }));
            return (0, response_utils_1.sendSuccess)(c, { holidays: formattedHolidays });
        }
        catch (error) {
            console.error('❌ [HOLIDAYS] Error updating holiday:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to update holiday', 500, { originalError: String(error) });
        }
    });
    /**
     * Delete a holiday
     */
    app.delete(`${BASE_PATH}/staff/:staffId/holidays/:holidayId`, async (c) => {
        try {
            const { staffId, holidayId } = c.req.param();
            console.log(`\n🗑️ [HOLIDAYS] Deleting holiday ${holidayId} for staff ${staffId}`);
            // ✅ SQL: Delete holiday
            const pool = await (0, db_1.getDbClient)();
            const deleteResult = await pool.query('DELETE FROM staff_holidays WHERE id = $1 AND staff_id = $2', [holidayId, staffId]);
            if (deleteResult.rowCount === 0) {
                return (0, response_utils_1.sendError)(c, 'Holiday not found', 404);
            }
            console.log(`✅ [HOLIDAYS] Holiday deleted successfully`);
            // Get remaining holidays
            const allHolidays = await (0, db_1.selectQuery)('staff_holidays', { staff_id: staffId }, {
                orderBy: 'holiday_date',
                orderDirection: 'asc'
            });
            const formattedHolidays = (allHolidays || []).map((h) => ({
                id: h.id,
                date: h.holiday_date,
                type: 'holiday',
                reason: h.holiday_name,
                name: h.holiday_name
            }));
            return (0, response_utils_1.sendSuccess)(c, { holidays: formattedHolidays }, 'Holiday removed. Slots will be available for booking again.');
        }
        catch (error) {
            console.error('❌ [HOLIDAYS] Error deleting holiday:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to delete holiday', 500, { originalError: String(error) });
        }
    });
    // ============================================
    // UTILITY ENDPOINTS
    // ============================================
    /**
     * Get complete schedule configuration (breaks + preferences + holidays)
     */
    app.get(`${BASE_PATH}/staff/:staffId/schedule-config`, async (c) => {
        try {
            const { staffId } = c.req.param();
            console.log(`\n📋 [SCHEDULE-CONFIG] Getting complete schedule config for staff ${staffId}`);
            // ✅ SQL: Get breaks
            const breaks = await (0, db_1.selectQuery)('staff_breaks', { staff_id: staffId }, {
                orderBy: 'start_time',
                orderDirection: 'asc'
            });
            // ✅ SQL: Get preferences
            const settingsResult = await (0, db_1.selectQuery)('platform_settings', {
                setting_key: `staff:${staffId}:preferences`
            });
            const settings = settingsResult[0] || null;
            // ✅ SQL: Get holidays
            const holidays = await (0, db_1.selectQuery)('staff_holidays', { staff_id: staffId }, {
                orderBy: 'holiday_date',
                orderDirection: 'asc'
            });
            const formattedBreaks = (breaks || []).map((b) => ({
                id: b.id,
                start: b.start_time,
                end: b.end_time,
                type: b.break_type,
                label: b.break_type,
                date: b.break_date,
                dayOfWeek: b.day_of_week
            }));
            const preferences = settings?.setting_value || {
                slotDuration: 30,
                bufferMinutes: 5,
                advanceBookingDays: 30,
                sameDayBookingCutoff: '18:00'
            };
            const formattedHolidays = (holidays || []).map((h) => ({
                id: h.id,
                date: h.holiday_date,
                type: 'holiday',
                reason: h.holiday_name,
                name: h.holiday_name
            }));
            console.log(`✅ [SCHEDULE-CONFIG] Config retrieved: ${formattedBreaks.length} breaks, ${formattedHolidays.length} holidays`);
            return (0, response_utils_1.sendSuccess)(c, {
                config: {
                    breaks: formattedBreaks,
                    preferences,
                    holidays: formattedHolidays
                }
            });
        }
        catch (error) {
            console.error('❌ [SCHEDULE-CONFIG] Error getting schedule config:', error);
            return (0, response_utils_1.sendError)(c, 'Failed to get schedule configuration', 500, { originalError: String(error) });
        }
    });
    console.log('✅ Staff schedule endpoints registered (SQL-only)');
}
//# sourceMappingURL=staff-schedule-endpoints-sql.js.map