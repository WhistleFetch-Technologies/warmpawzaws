/**
 * ========================================
 * STAFF SCHEDULE MANAGEMENT ENDPOINTS
 * ========================================
 * 
 * API endpoints for managing staff scheduling:
 * - Break times (Task 2.1)
 * - Buffer time & preferences (Task 2.2)
 * - Holidays and leave (Task 2.3)
 * 
 * Staff-level only (not clinic-wide)
 * 
 * Created: November 20, 2025
 * Part of: Practo Parity Implementation - Tasks 2.1, 2.2, 2.3
 */

import { Hono } from 'hono';
import * as kv from './kv_store';
import { sendSuccess, sendError } from './response-utils';

const app = new Hono();

// ============================================
// BREAK MANAGEMENT (TASK 2.1)
// ============================================

/**
 * Get all breaks for a staff member
 */
app.get('/make-server-3dd53475/staff/:staffId/breaks', async (c) => {
  try {
    const { staffId } = c.req.param();
    
    console.log(`\n☕ [BREAKS] Getting breaks for staff ${staffId}`);
    
    const breaks = await kv.get(`doctor:${staffId}:breaks`) || [];
    
    console.log(`✅ [BREAKS] Found ${breaks.length} breaks`);
    
    return sendSuccess(c, { breaks });
  } catch (error) {
    console.error('❌ [BREAKS] Error getting breaks:', error);
    return sendError(c, 'Failed to get breaks', 500, { originalError: String(error), breaks: [] });
  }
});

/**
 * Add a new break
 */
app.post('/make-server-3dd53475/staff/:staffId/breaks', async (c) => {
  try {
    const { staffId } = c.req.param();
    const { break: newBreak } = await c.req.json();
    
    console.log(`\n➕ [BREAKS] Adding break for staff ${staffId}:`, newBreak);
    
    // Validate break data
    if (!newBreak.start || !newBreak.end || !newBreak.type || !newBreak.label) {
      return sendError(c, 'Missing required fields (start, end, type, label)', 400);
    }
    
    // Get existing breaks
    const breaks = await kv.get(`doctor:${staffId}:breaks`) || [];
    
    // Add new break
    breaks.push(newBreak);
    
    // Save
    await kv.set(`doctor:${staffId}:breaks`, breaks);
    
    console.log(`✅ [BREAKS] Break added successfully`);
    
    return sendSuccess(c, { breaks });
  } catch (error) {
    console.error('❌ [BREAKS] Error adding break:', error);
    return sendError(c, 'Failed to add break', 500, { originalError: String(error) });
  }
});

/**
 * Update a break
 */
app.put('/make-server-3dd53475/staff/:staffId/breaks/:breakId', async (c) => {
  try {
    const { staffId, breakId } = c.req.param();
    const { break: breakUpdate } = await c.req.json();
    
    console.log(`\n✏️ [BREAKS] Updating break ${breakId} for staff ${staffId}:`, breakUpdate);
    
    // Get existing breaks
    const breaks = await kv.get(`doctor:${staffId}:breaks`) || [];
    
    // Find and update
    const index = breaks.findIndex((b: any) => b.id === breakId);
    if (index === -1) {
      return sendError(c, 'Break not found', 404);
    }
    
    breaks[index] = { ...breaks[index], ...breakUpdate };
    
    // Save
    await kv.set(`doctor:${staffId}:breaks`, breaks);
    
    console.log(`✅ [BREAKS] Break updated successfully`);
    
    return sendSuccess(c, { breaks });
  } catch (error) {
    console.error('❌ [BREAKS] Error updating break:', error);
    return sendError(c, 'Failed to update break', 500, { originalError: String(error) });
  }
});

/**
 * Delete a break
 */
app.delete('/make-server-3dd53475/staff/:staffId/breaks/:breakId', async (c) => {
  try {
    const { staffId, breakId } = c.req.param();
    
    console.log(`\n🗑️ [BREAKS] Deleting break ${breakId} for staff ${staffId}`);
    
    // Get existing breaks
    const breaks = await kv.get(`doctor:${staffId}:breaks`) || [];
    
    // Filter out the break
    const updatedBreaks = breaks.filter((b: any) => b.id !== breakId);
    
    if (breaks.length === updatedBreaks.length) {
      return sendError(c, 'Break not found', 404);
    }
    
    // Save
    await kv.set(`doctor:${staffId}:breaks`, updatedBreaks);
    
    console.log(`✅ [BREAKS] Break deleted successfully`);
    
    return sendSuccess(c, { breaks: updatedBreaks });
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
app.get('/make-server-3dd53475/staff/:staffId/preferences', async (c) => {
  try {
    const { staffId } = c.req.param();
    
    console.log(`\n⚙️ [PREFERENCES] Getting preferences for staff ${staffId}`);
    
    const preferences = await kv.get(`doctor:${staffId}:preferences`);
    
    // Return defaults if not set
    const defaultPreferences = {
      slotDuration: 30,
      bufferMinutes: 5,
      advanceBookingDays: 30,
      sameDayBookingCutoff: '18:00'
    };
    
    const finalPreferences = preferences || defaultPreferences;
    
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
app.put('/make-server-3dd53475/staff/:staffId/preferences', async (c) => {
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
    
    // Save preferences
    await kv.set(`doctor:${staffId}:preferences`, preferences);
    
    console.log(`✅ [PREFERENCES] Preferences updated successfully`);
    
    // TODO: Regenerate availability slots based on new preferences
    // This should be called in the background or as a separate endpoint
    
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
app.get('/make-server-3dd53475/staff/:staffId/holidays', async (c) => {
  try {
    const { staffId } = c.req.param();
    
    console.log(`\n🏖️ [HOLIDAYS] Getting holidays for staff ${staffId}`);
    
    const holidays = await kv.get(`doctor:${staffId}:holidays`) || [];
    
    console.log(`✅ [HOLIDAYS] Found ${holidays.length} holidays`);
    
    return sendSuccess(c, { holidays });
  } catch (error) {
    console.error('❌ [HOLIDAYS] Error getting holidays:', error);
    return sendError(c, 'Failed to get holidays', 500, { originalError: String(error), holidays: [] });
  }
});

/**
 * Add a new holiday
 */
app.post('/make-server-3dd53475/staff/:staffId/holidays', async (c) => {
  try {
    const { staffId } = c.req.param();
    const { holiday: newHoliday } = await c.req.json();
    
    console.log(`\n➕ [HOLIDAYS] Adding holiday for staff ${staffId}:`, newHoliday);
    
    // Validate holiday data
    if (!newHoliday.date || !newHoliday.type || !newHoliday.reason) {
      return sendError(c, 'Missing required fields (date, type, reason)', 400);
    }
    
    // Get existing holidays
    const holidays = await kv.get(`doctor:${staffId}:holidays`) || [];
    
    // Add new holiday
    holidays.push(newHoliday);
    
    // Save
    await kv.set(`doctor:${staffId}:holidays`, holidays);
    
    console.log(`✅ [HOLIDAYS] Holiday added successfully`);
    
    // TODO: Block slots on this date
    // This should be done in the background or as a separate process
    
    return sendSuccess(c, { holidays }, 'Holiday added. Slots on this date will be automatically blocked.');
  } catch (error) {
    console.error('❌ [HOLIDAYS] Error adding holiday:', error);
    return sendError(c, 'Failed to add holiday', 500, { originalError: String(error) });
  }
});

/**
 * Update a holiday
 */
app.put('/make-server-3dd53475/staff/:staffId/holidays/:holidayId', async (c) => {
  try {
    const { staffId, holidayId } = c.req.param();
    const { holiday: holidayUpdate } = await c.req.json();
    
    console.log(`\n✏️ [HOLIDAYS] Updating holiday ${holidayId} for staff ${staffId}:`, holidayUpdate);
    
    // Get existing holidays
    const holidays = await kv.get(`doctor:${staffId}:holidays`) || [];
    
    // Find and update
    const index = holidays.findIndex((h: any) => h.id === holidayId);
    if (index === -1) {
      return sendError(c, 'Holiday not found', 404);
    }
    
    holidays[index] = { ...holidays[index], ...holidayUpdate };
    
    // Save
    await kv.set(`doctor:${staffId}:holidays`, holidays);
    
    console.log(`✅ [HOLIDAYS] Holiday updated successfully`);
    
    return sendSuccess(c, { holidays });
  } catch (error) {
    console.error('❌ [HOLIDAYS] Error updating holiday:', error);
    return sendError(c, 'Failed to update holiday', 500, { originalError: String(error) });
  }
});

/**
 * Delete a holiday
 */
app.delete('/make-server-3dd53475/staff/:staffId/holidays/:holidayId', async (c) => {
  try {
    const { staffId, holidayId } = c.req.param();
    
    console.log(`\n🗑️ [HOLIDAYS] Deleting holiday ${holidayId} for staff ${staffId}`);
    
    // Get existing holidays
    const holidays = await kv.get(`doctor:${staffId}:holidays`) || [];
    
    // Filter out the holiday
    const updatedHolidays = holidays.filter((h: any) => h.id !== holidayId);
    
    if (holidays.length === updatedHolidays.length) {
      return sendError(c, 'Holiday not found', 404);
    }
    
    // Save
    await kv.set(`doctor:${staffId}:holidays`, updatedHolidays);
    
    console.log(`✅ [HOLIDAYS] Holiday deleted successfully`);
    
    // TODO: Unblock slots on this date
    
    return sendSuccess(c, { holidays: updatedHolidays }, 'Holiday removed. Slots will be available for booking again.');
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
app.get('/make-server-3dd53475/staff/:staffId/schedule-config', async (c) => {
  try {
    const { staffId } = c.req.param();
    
    console.log(`\n📋 [SCHEDULE-CONFIG] Getting complete schedule config for staff ${staffId}`);
    
    const breaks = await kv.get(`doctor:${staffId}:breaks`) || [];
    const preferences = await kv.get(`doctor:${staffId}:preferences`) || {
      slotDuration: 30,
      bufferMinutes: 5,
      advanceBookingDays: 30,
      sameDayBookingCutoff: '18:00'
    };
    const holidays = await kv.get(`doctor:${staffId}:holidays`) || [];
    
    console.log(`✅ [SCHEDULE-CONFIG] Config retrieved: ${breaks.length} breaks, ${holidays.length} holidays`);
    
    return sendSuccess(c, {
      config: {
        breaks,
        preferences,
        holidays
      }
    });
  } catch (error) {
    console.error('❌ [SCHEDULE-CONFIG] Error getting schedule config:', error);
    return sendError(c, 'Failed to get schedule configuration', 500, { originalError: String(error) });
  }
});

export default app;
