/**
 * Enhanced Staff Availability Routes
 * 
 * Implements:
 * - TASK 2: Validation for lead time and distance
 * - TASK 3: Conflict detection with 409 responses
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';
import { 
  validateAvailabilitySlot, 
  detectConflicts,
  validateConditionalFields 
} from './staff-availability-validation.tsx';

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

    // Save to KV store
    await kv.set(`staff:${staffId}:availability:${slot.id}`, slot);

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

    const slotsData = await kv.getByPrefix(`staff:${staffId}:availability:`);
    const slots = slotsData
      .filter((item: any) => item.value)
      .map((item: any) => item.value)
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

    // Get existing slot
    const existingData = await kv.get(`staff:${staffId}:availability:${slotId}`);
    if (!existingData || !existingData.value) {
      return c.json({ error: 'Availability slot not found' }, 404);
    }

    const existingSlot = existingData.value;

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

    // Save updates
    await kv.set(`staff:${staffId}:availability:${slotId}`, updatedSlot);

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

    // Check if slot exists
    const existingData = await kv.get(`staff:${staffId}:availability:${slotId}`);
    if (!existingData || !existingData.value) {
      return c.json({ error: 'Availability slot not found' }, 404);
    }

    // Delete the slot
    await kv.del(`staff:${staffId}:availability:${slotId}`);

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

    // Get all slots
    const slotsData = await kv.getByPrefix(`staff:${staffId}:availability:`);
    const slots = slotsData
      .filter((item: any) => item.value && item.value.isActive)
      .map((item: any) => item.value);

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
