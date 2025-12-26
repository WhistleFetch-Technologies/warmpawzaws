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

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { sendSuccess, sendError } from './response-utils.ts';
import { selectQuery, insertQuery, updateQuery, deleteQuery } from '../../lib/db.ts';

export function staffScheduleEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const db = getDbClient();

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
      const { data: breaks, error } = await db
        .from('staff_breaks')
        .select('*')
        .eq('staff_id', staffId)
        .order('start_time', { ascending: true });

      if (error) {
        throw error;
      }

      // Transform to match expected format
      const formattedBreaks = (breaks || []).map((b: any) => ({
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
      
      return sendSuccess(c, { breaks: formattedBreaks });
    } catch (error) {
      console.error('❌ [BREAKS] Error getting breaks:', error);
      return sendError(c, 'Failed to get breaks', 500, { originalError: String(error), breaks: [] });
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
        return sendError(c, 'Missing required fields (start, end, type, label)', 400);
      }
      
      // ✅ SQL: Insert break into staff_breaks table
      const { data: insertedBreak, error } = await db
        .from('staff_breaks')
        .insert({
          staff_id: staffId,
          start_time: newBreak.start,
          end_time: newBreak.end,
          break_type: newBreak.type,
          break_date: newBreak.date || null,
          day_of_week: newBreak.dayOfWeek !== undefined ? newBreak.dayOfWeek : null
        })
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      console.log(`✅ [BREAKS] Break added successfully`);
      
      // Get all breaks for response
      const { data: allBreaks } = await db
        .from('staff_breaks')
        .select('*')
        .eq('staff_id', staffId)
        .order('start_time', { ascending: true });

      const formattedBreaks = (allBreaks || []).map((b: any) => ({
        id: b.id,
        start: b.start_time,
        end: b.end_time,
        type: b.break_type,
        label: b.break_type,
        date: b.break_date,
        dayOfWeek: b.day_of_week
      }));
      
      return sendSuccess(c, { breaks: formattedBreaks });
    } catch (error) {
      console.error('❌ [BREAKS] Error adding break:', error);
      return sendError(c, 'Failed to add break', 500, { originalError: String(error) });
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
      const updateData: any = {};
      if (breakUpdate.start) updateData.start_time = breakUpdate.start;
      if (breakUpdate.end) updateData.end_time = breakUpdate.end;
      if (breakUpdate.type) updateData.break_type = breakUpdate.type;
      if (breakUpdate.date !== undefined) updateData.break_date = breakUpdate.date;
      if (breakUpdate.dayOfWeek !== undefined) updateData.day_of_week = breakUpdate.dayOfWeek;

      const { data: updatedBreak, error } = await db
        .from('staff_breaks')
        .update(updateData)
        .eq('id', breakId)
        .eq('staff_id', staffId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return sendError(c, 'Break not found', 404);
        }
        throw error;
      }
      
      console.log(`✅ [BREAKS] Break updated successfully`);
      
      // Get all breaks for response
      const { data: allBreaks } = await db
        .from('staff_breaks')
        .select('*')
        .eq('staff_id', staffId)
        .order('start_time', { ascending: true });

      const formattedBreaks = (allBreaks || []).map((b: any) => ({
        id: b.id,
        start: b.start_time,
        end: b.end_time,
        type: b.break_type,
        label: b.break_type,
        date: b.break_date,
        dayOfWeek: b.day_of_week
      }));
      
      return sendSuccess(c, { breaks: formattedBreaks });
    } catch (error) {
      console.error('❌ [BREAKS] Error updating break:', error);
      return sendError(c, 'Failed to update break', 500, { originalError: String(error) });
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
      const { error } = await db
        .from('staff_breaks')
        .delete()
        .eq('id', breakId)
        .eq('staff_id', staffId);

      if (error) {
        throw error;
      }
      
      console.log(`✅ [BREAKS] Break deleted successfully`);
      
      // Get remaining breaks
      const { data: allBreaks } = await db
        .from('staff_breaks')
        .select('*')
        .eq('staff_id', staffId)
        .order('start_time', { ascending: true });

      const formattedBreaks = (allBreaks || []).map((b: any) => ({
        id: b.id,
        start: b.start_time,
        end: b.end_time,
        type: b.break_type,
        label: b.break_type,
        date: b.break_date,
        dayOfWeek: b.day_of_week
      }));
      
      return sendSuccess(c, { breaks: formattedBreaks });
    } catch (error) {
      console.error('❌ [BREAKS] Error deleting break:', error);
      return sendError(c, 'Failed to delete break', 500, { originalError: String(error) });
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
      const { data: settings } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `staff:${staffId}:preferences`)
        .single();
      
      // Return defaults if not set
      const defaultPreferences = {
        slotDuration: 30,
        bufferMinutes: 5,
        advanceBookingDays: 30,
        sameDayBookingCutoff: '18:00'
      };
      
      const finalPreferences = settings?.setting_value || defaultPreferences;
      
      console.log(`✅ [PREFERENCES] Preferences retrieved:`, finalPreferences);
      
      return sendSuccess(c, { preferences: finalPreferences });
    } catch (error) {
      console.error('❌ [PREFERENCES] Error getting preferences:', error);
      return sendError(c, 'Failed to get preferences', 500, { originalError: String(error), preferences: null });
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
        return sendError(c, 'Slot duration must be between 15 and 120 minutes', 400);
      }
      
      if (preferences.bufferMinutes && (preferences.bufferMinutes < 0 || preferences.bufferMinutes > 30)) {
        return sendError(c, 'Buffer time must be between 0 and 30 minutes', 400);
      }
      
      // ✅ SQL: Save preferences in platform_settings
      await db
        .from('platform_settings')
        .upsert({
          setting_key: `staff:${staffId}:preferences`,
          setting_value: preferences,
          setting_type: 'object',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });
      
      console.log(`✅ [PREFERENCES] Preferences updated successfully`);
      
      return sendSuccess(c, { preferences }, 'Preferences updated. Please regenerate your availability slots to apply changes.');
    } catch (error) {
      console.error('❌ [PREFERENCES] Error updating preferences:', error);
      return sendError(c, 'Failed to update preferences', 500, { originalError: String(error) });
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
      const { data: holidays, error } = await db
        .from('staff_holidays')
        .select('*')
        .eq('staff_id', staffId)
        .order('holiday_date', { ascending: true });

      if (error) {
        throw error;
      }

      // Transform to match expected format
      const formattedHolidays = (holidays || []).map((h: any) => ({
        id: h.id,
        date: h.holiday_date,
        type: 'holiday', // Default type
        reason: h.holiday_name || 'Holiday',
        name: h.holiday_name,
        createdAt: h.created_at
      }));
      
      console.log(`✅ [HOLIDAYS] Found ${formattedHolidays.length} holidays`);
      
      return sendSuccess(c, { holidays: formattedHolidays });
    } catch (error) {
      console.error('❌ [HOLIDAYS] Error getting holidays:', error);
      return sendError(c, 'Failed to get holidays', 500, { originalError: String(error), holidays: [] });
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
        return sendError(c, 'Missing required fields (date, type, reason)', 400);
      }
      
      // ✅ SQL: Insert holiday into staff_holidays table
      const { data: insertedHoliday, error } = await db
        .from('staff_holidays')
        .insert({
          staff_id: staffId,
          holiday_date: newHoliday.date,
          holiday_name: newHoliday.reason || newHoliday.name
        })
        .select()
        .single();

      if (error) {
        throw error;
      }
      
      console.log(`✅ [HOLIDAYS] Holiday added successfully`);
      
      // Get all holidays for response
      const { data: allHolidays } = await db
        .from('staff_holidays')
        .select('*')
        .eq('staff_id', staffId)
        .order('holiday_date', { ascending: true });

      const formattedHolidays = (allHolidays || []).map((h: any) => ({
        id: h.id,
        date: h.holiday_date,
        type: 'holiday',
        reason: h.holiday_name,
        name: h.holiday_name
      }));
      
      return sendSuccess(c, { holidays: formattedHolidays }, 'Holiday added. Slots on this date will be automatically blocked.');
    } catch (error) {
      console.error('❌ [HOLIDAYS] Error adding holiday:', error);
      return sendError(c, 'Failed to add holiday', 500, { originalError: String(error) });
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
      const updateData: any = {};
      if (holidayUpdate.date) updateData.holiday_date = holidayUpdate.date;
      if (holidayUpdate.reason || holidayUpdate.name) updateData.holiday_name = holidayUpdate.reason || holidayUpdate.name;

      const { data: updatedHoliday, error } = await db
        .from('staff_holidays')
        .update(updateData)
        .eq('id', holidayId)
        .eq('staff_id', staffId)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return sendError(c, 'Holiday not found', 404);
        }
        throw error;
      }
      
      console.log(`✅ [HOLIDAYS] Holiday updated successfully`);
      
      // Get all holidays for response
      const { data: allHolidays } = await db
        .from('staff_holidays')
        .select('*')
        .eq('staff_id', staffId)
        .order('holiday_date', { ascending: true });

      const formattedHolidays = (allHolidays || []).map((h: any) => ({
        id: h.id,
        date: h.holiday_date,
        type: 'holiday',
        reason: h.holiday_name,
        name: h.holiday_name
      }));
      
      return sendSuccess(c, { holidays: formattedHolidays });
    } catch (error) {
      console.error('❌ [HOLIDAYS] Error updating holiday:', error);
      return sendError(c, 'Failed to update holiday', 500, { originalError: String(error) });
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
      const { error } = await db
        .from('staff_holidays')
        .delete()
        .eq('id', holidayId)
        .eq('staff_id', staffId);

      if (error) {
        throw error;
      }
      
      console.log(`✅ [HOLIDAYS] Holiday deleted successfully`);
      
      // Get remaining holidays
      const { data: allHolidays } = await db
        .from('staff_holidays')
        .select('*')
        .eq('staff_id', staffId)
        .order('holiday_date', { ascending: true });

      const formattedHolidays = (allHolidays || []).map((h: any) => ({
        id: h.id,
        date: h.holiday_date,
        type: 'holiday',
        reason: h.holiday_name,
        name: h.holiday_name
      }));
      
      return sendSuccess(c, { holidays: formattedHolidays }, 'Holiday removed. Slots will be available for booking again.');
    } catch (error) {
      console.error('❌ [HOLIDAYS] Error deleting holiday:', error);
      return sendError(c, 'Failed to delete holiday', 500, { originalError: String(error) });
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
      const { data: breaks } = await db
        .from('staff_breaks')
        .select('*')
        .eq('staff_id', staffId)
        .order('start_time', { ascending: true });

      // ✅ SQL: Get preferences
      const { data: settings } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `staff:${staffId}:preferences`)
        .single();

      // ✅ SQL: Get holidays
      const { data: holidays } = await db
        .from('staff_holidays')
        .select('*')
        .eq('staff_id', staffId)
        .order('holiday_date', { ascending: true });

      const formattedBreaks = (breaks || []).map((b: any) => ({
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

      const formattedHolidays = (holidays || []).map((h: any) => ({
        id: h.id,
        date: h.holiday_date,
        type: 'holiday',
        reason: h.holiday_name,
        name: h.holiday_name
      }));
      
      console.log(`✅ [SCHEDULE-CONFIG] Config retrieved: ${formattedBreaks.length} breaks, ${formattedHolidays.length} holidays`);
      
      return sendSuccess(c, {
        config: {
          breaks: formattedBreaks,
          preferences,
          holidays: formattedHolidays
        }
      });
    } catch (error) {
      console.error('❌ [SCHEDULE-CONFIG] Error getting schedule config:', error);
      return sendError(c, 'Failed to get schedule configuration', 500, { originalError: String(error) });
    }
  });

  console.log('✅ Staff schedule endpoints registered (SQL-only)');
}

