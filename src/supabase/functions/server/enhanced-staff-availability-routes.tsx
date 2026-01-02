/**
 * Enhanced Staff Availability Routes
 * 
 * Implements:
 * - TASK 2: Validation for lead time and distance
 * - TASK 3: Conflict detection with 409 responses
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { cors } from "hono/cors";
import { getStaffAvailabilityRepository } from '../../../supabase/lib/repositories/index';
import { 
  validateAvailabilitySlot, 
  detectConflicts,
  validateConditionalFields 
} from './staff-availability-validation';

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

    // ✅ SQL: Save to staff_availability table
    const staffAvailabilityRepo = getStaffAvailabilityRepository();
    await staffAvailabilityRepo.createOrUpdate({
      id: slot.id,
      staff_id: staffId,
      date: slot.date || null,
      day_of_week: slot.dayOfWeek,
      start_time: slot.startTime,
      end_time: slot.endTime,
      is_active: slot.isActive !== false,
      metadata: slot,
      created_at: slot.createdAt || new Date().toISOString(),
      updated_at: slot.updatedAt || new Date().toISOString()
    });

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

    // ✅ SQL: Get all availability slots for staff from staff_availability table
    const staffAvailabilityRepo = getStaffAvailabilityRepository();
    const slotsData = await staffAvailabilityRepo.findByStaff(staffId);
    const slots = slotsData
      .map((item: any) => ({
        ...item.metadata,
        id: item.id,
        staffId: item.staff_id,
        dayOfWeek: item.day_of_week,
        startTime: item.start_time,
        endTime: item.end_time,
        isActive: item.is_active,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }))
      .sort((a: any, b: any) => {
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

    // ✅ SQL: Get existing slot from staff_availability table
    const staffAvailabilityRepo = getStaffAvailabilityRepository();
    const existingSlotData = await staffAvailabilityRepo.findById(slotId);
    if (!existingSlotData || existingSlotData.staff_id !== staffId) {
      return c.json({ error: 'Availability slot not found' }, 404);
    }

    const existingSlot = {
      ...existingSlotData.metadata,
      id: existingSlotData.id,
      staffId: existingSlotData.staff_id,
      dayOfWeek: existingSlotData.day_of_week,
      startTime: existingSlotData.start_time,
      endTime: existingSlotData.end_time,
      isActive: existingSlotData.is_active
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

    // ✅ SQL: Save updates to staff_availability table
    await staffAvailabilityRepo.createOrUpdate({
      id: slotId,
      staff_id: staffId,
      date: updatedSlot.date || null,
      day_of_week: updatedSlot.dayOfWeek,
      start_time: updatedSlot.startTime,
      end_time: updatedSlot.endTime,
      is_active: updatedSlot.isActive !== false,
      metadata: updatedSlot,
      updated_at: updatedSlot.updatedAt || new Date().toISOString()
    });

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

    // ✅ SQL: Check if slot exists and delete from staff_availability table
    const staffAvailabilityRepo = getStaffAvailabilityRepository();
    const existingSlotData = await staffAvailabilityRepo.findById(slotId);
    if (!existingSlotData || existingSlotData.staff_id !== staffId) {
      return c.json({ error: 'Availability slot not found' }, 404);
    }

    // Delete the slot
    await staffAvailabilityRepo.delete(slotId);

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

    // ✅ SQL: Get all active slots from staff_availability table
    const staffAvailabilityRepo = getStaffAvailabilityRepository();
    const slotsData = await staffAvailabilityRepo.findByStaff(staffId);
    const slots = slotsData
      .filter((item: any) => item.is_active)
      .map((item: any) => ({
        ...item.metadata,
        id: item.id,
        staffId: item.staff_id,
        dayOfWeek: item.day_of_week,
        startTime: item.start_time,
        endTime: item.end_time,
        isActive: item.is_active
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
