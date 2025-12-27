/**
 * ============================================================================
 * ENHANCED STAFF AVAILABILITY ROUTES - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()`, `kv.getByPrefix()` with SQL repository calls
 * - Uses `staff_availability_slots` table for availability slots
 * - All data now comes from SQL tables
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL
 * KV Operations Removed: 6
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient } from '../../lib/db.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { 
  validateAvailabilitySlot, 
  detectConflicts,
  validateConditionalFields 
} from './staff-availability-validation-sql.tsx'; // ✅ SQL-only version

const app = new Hono();

app.use('*', cors());

/**
 * POST /staff/:staffId/availability-slots
 * Create or update an availability slot with validation
 * 
 * TASK 3: Returns 409 on conflicts with details
 */
app.post('/staff/:staffId/availability-slots', async (c) => {
  try {
    const staffId = c.req.param('staffId');
    const body = await c.req.json();
    const slot = body.slot;

    if (!slot) {
      return c.json({ error: 'Slot data is required' }, 400);
    }

    // ✅ SQL: Verify staff exists
    const staffRepo = getStaffRepository();
    const staff = await staffRepo.findById(staffId);
    if (!staff) {
      return c.json({ error: 'Staff not found' }, 404);
    }

    // Assign staff ID
    slot.staffId = staffId;

    // Generate ID if creating new
    if (!slot.id || slot.id.startsWith('slot_')) {
      slot.id = `availability_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    console.log('🔍 Validating availability slot:', slot.id);

    // TASK 2 & 3: Comprehensive validation
    const validation = await validateAvailabilitySlot(slot, staffId);

    if (!validation.valid) {
      // TASK 3: Return 409 for conflicts
      if (validation.conflicts && validation.conflicts.length > 0) {
        console.log('❌ Conflicts detected:', validation.conflicts);
        return c.json({
          error: 'Scheduling conflicts detected',
          message: 'The availability slot conflicts with existing schedules',
          conflicts: validation.conflicts,
          details: {
            conflictCount: validation.conflicts.length,
            conflictTypes: [...new Set(validation.conflicts.map(c => c.type))]
          }
        }, 409); // HTTP 409 Conflict
      }

      // Return 400 for validation errors
      console.log('❌ Validation errors:', validation.errors);
      return c.json({
        error: 'Validation failed',
        message: validation.errors[0],
        errors: validation.errors
      }, 400);
    }

    // Add timestamps
    const now = new Date().toISOString();
    if (!slot.createdAt) {
      slot.createdAt = now;
    }
    slot.updatedAt = now;

    // ✅ SQL: Save to staff_availability_slots table
    const db = getDbClient();
    
    // Convert day name to number if needed
    let dayOfWeek = slot.dayOfWeek;
    if (typeof dayOfWeek === 'string') {
      const days: Record<string, number> = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
      };
      dayOfWeek = days[dayOfWeek.toLowerCase()] ?? 0;
    }

    // Check if slot already exists
    const { data: existing } = await db
      .from('staff_availability_slots')
      .select('*')
      .eq('staff_id', staffId)
      .eq('day_of_week', dayOfWeek)
      .eq('start_time', slot.startTime)
      .maybeSingle();

    if (existing) {
      // Update existing slot
      await db
        .from('staff_availability_slots')
        .update({
          end_time: slot.endTime,
          is_available: slot.isActive !== false,
          location_id: slot.locationId || null,
          updated_at: now
        })
        .eq('id', existing.id);
    } else {
      // Insert new slot
      await db
        .from('staff_availability_slots')
        .insert({
          id: slot.id,
          staff_id: staffId,
          location_id: slot.locationId || null,
          day_of_week: dayOfWeek,
          start_time: slot.startTime,
          end_time: slot.endTime,
          is_available: slot.isActive !== false
        });
    }

    console.log('✅ Availability slot saved:', slot.id);

    return c.json({
      success: true,
      message: 'Availability slot saved successfully',
      slot: slot
    });

  } catch (error: any) {
    console.error('Error creating availability slot:', error);
    return c.json({
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

/**
 * GET /staff/:staffId/availability-slots
 * Get all availability slots for a staff member
 */
app.get('/staff/:staffId/availability-slots', async (c) => {
  try {
    const staffId = c.req.param('staffId');

    // ✅ SQL: Get all availability slots for staff
    const db = getDbClient();
    const { data: slotsData, error } = await db
      .from('staff_availability_slots')
      .select('*')
      .eq('staff_id', staffId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      throw error;
    }

    const slots = (slotsData || []).map((s: any) => ({
      id: s.id,
      staffId: s.staff_id,
      locationId: s.location_id,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      isActive: s.is_available,
      createdAt: s.created_at,
      updatedAt: s.updated_at
    })).sort((a: any, b: any) => {
      // Sort by day of week, then start time
      if (a.dayOfWeek !== b.dayOfWeek) {
        return a.dayOfWeek - b.dayOfWeek;
      }
      return a.startTime.localeCompare(b.startTime);
    });

    return c.json({
      success: true,
      slots,
      count: slots.length
    });

  } catch (error: any) {
    console.error('Error fetching availability slots:', error);
    return c.json({
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

/**
 * PUT /staff/:staffId/availability-slots/:slotId
 * Update an existing availability slot
 * 
 * TASK 3: Returns 409 on conflicts
 */
app.put('/staff/:staffId/availability-slots/:slotId', async (c) => {
  try {
    const staffId = c.req.param('staffId');
    const slotId = c.req.param('slotId');
    const body = await c.req.json();
    const updates = body.slot;

    // ✅ SQL: Get existing slot
    const db = getDbClient();
    const { data: existingSlotData, error: fetchError } = await db
      .from('staff_availability_slots')
      .select('*')
      .eq('id', slotId)
      .eq('staff_id', staffId)
      .maybeSingle();

    if (fetchError || !existingSlotData) {
      return c.json({ error: 'Availability slot not found' }, 404);
    }

    const existingSlot = {
      id: existingSlotData.id,
      staffId: existingSlotData.staff_id,
      locationId: existingSlotData.location_id,
      dayOfWeek: existingSlotData.day_of_week,
      startTime: existingSlotData.start_time,
      endTime: existingSlotData.end_time,
      isActive: existingSlotData.is_available
    };

    // Merge updates
    const updatedSlot = {
      ...existingSlot,
      ...updates,
      id: slotId,
      staffId: staffId,
      updatedAt: new Date().toISOString()
    };

    console.log('🔍 Validating updated availability slot:', slotId);

    // TASK 2 & 3: Validate
    const validation = await validateAvailabilitySlot(updatedSlot, staffId);

    if (!validation.valid) {
      if (validation.conflicts && validation.conflicts.length > 0) {
        console.log('❌ Conflicts detected on update:', validation.conflicts);
        return c.json({
          error: 'Scheduling conflicts detected',
          message: 'The updated availability slot conflicts with existing schedules',
          conflicts: validation.conflicts,
          details: {
            conflictCount: validation.conflicts.length,
            conflictTypes: [...new Set(validation.conflicts.map(c => c.type))]
          }
        }, 409);
      }

      return c.json({
        error: 'Validation failed',
        message: validation.errors[0],
        errors: validation.errors
      }, 400);
    }

    // ✅ SQL: Update slot
    let dayOfWeek = updatedSlot.dayOfWeek;
    if (typeof dayOfWeek === 'string') {
      const days: Record<string, number> = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
        'thursday': 4, 'friday': 5, 'saturday': 6
      };
      dayOfWeek = days[dayOfWeek.toLowerCase()] ?? 0;
    }

    await db
      .from('staff_availability_slots')
      .update({
        day_of_week: dayOfWeek,
        start_time: updatedSlot.startTime,
        end_time: updatedSlot.endTime,
        is_available: updatedSlot.isActive !== false,
        location_id: updatedSlot.locationId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', slotId)
      .eq('staff_id', staffId);

    console.log('✅ Availability slot updated:', slotId);

    return c.json({
      success: true,
      message: 'Availability slot updated successfully',
      slot: updatedSlot
    });

  } catch (error: any) {
    console.error('Error updating availability slot:', error);
    return c.json({
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

/**
 * DELETE /staff/:staffId/availability-slots/:slotId
 * Delete an availability slot
 */
app.delete('/staff/:staffId/availability-slots/:slotId', async (c) => {
  try {
    const staffId = c.req.param('staffId');
    const slotId = c.req.param('slotId');

    // ✅ SQL: Check if slot exists
    const db = getDbClient();
    const { data: existingSlot, error: fetchError } = await db
      .from('staff_availability_slots')
      .select('*')
      .eq('id', slotId)
      .eq('staff_id', staffId)
      .maybeSingle();

    if (fetchError || !existingSlot) {
      return c.json({ error: 'Availability slot not found' }, 404);
    }

    // ✅ SQL: Delete the slot
    await db
      .from('staff_availability_slots')
      .delete()
      .eq('id', slotId)
      .eq('staff_id', staffId);

    console.log('✅ Availability slot deleted:', slotId);

    return c.json({
      success: true,
      message: 'Availability slot deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting availability slot:', error);
    return c.json({
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

/**
 * POST /staff/:staffId/availability-slots/validate
 * Validate a slot without saving (for preview/testing)
 */
app.post('/staff/:staffId/availability-slots/validate', async (c) => {
  try {
    const staffId = c.req.param('staffId');
    const body = await c.req.json();
    const slot = body.slot;

    if (!slot) {
      return c.json({ error: 'Slot data is required' }, 400);
    }

    slot.staffId = staffId;

    const validation = await validateAvailabilitySlot(slot, staffId);

    if (!validation.valid) {
      return c.json({
        valid: false,
        errors: validation.errors,
        conflicts: validation.conflicts || []
      });
    }

    return c.json({
      valid: true,
      message: 'Slot is valid'
    });

  } catch (error: any) {
    console.error('Error validating slot:', error);
    return c.json({
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

/**
 * GET /staff/:staffId/availability-conflicts
 * Get all current conflicts for a staff member's schedule
 */
app.get('/staff/:staffId/availability-conflicts', async (c) => {
  try {
    const staffId = c.req.param('staffId');

    // ✅ SQL: Get all slots
    const db = getDbClient();
    const { data: slotsData, error } = await db
      .from('staff_availability_slots')
      .select('*')
      .eq('staff_id', staffId)
      .eq('is_available', true);

    if (error) {
      throw error;
    }

    const slots = (slotsData || []).map((s: any) => ({
      id: s.id,
      staffId: s.staff_id,
      locationId: s.location_id,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
      isActive: s.is_available
    }));

    const allConflicts = [];

    // Check each slot for conflicts
    for (const slot of slots) {
      const conflicts = await detectConflicts(slot, staffId);
      if (conflicts.length > 0) {
        allConflicts.push({
          slotId: slot.id,
          day: getDayName(slot.dayOfWeek),
          time: `${slot.startTime} - ${slot.endTime}`,
          conflicts
        });
      }
    }

    return c.json({
      success: true,
      conflictCount: allConflicts.length,
      conflicts: allConflicts
    });

  } catch (error: any) {
    console.error('Error checking conflicts:', error);
    return c.json({
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

/**
 * Helper: Get day name
 */
function getDayName(dayNumber: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber] || 'Unknown';
}

export default app;

