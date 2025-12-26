/**
 * ENHANCED STAFF AVAILABILITY WITH CONFLICT DETECTION - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Adds missing features from handoff checklist:
 * - Conflict detection with 409 responses
 * - mode field (location vs centre)
 * - Conditional field validation (leadTime >= 30 for home)
 * - maxDistance validation
 * - Centre concurrency validation
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (8 KV operations → 0)
 * Endpoints: 1
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient } from '../../lib/db.ts';
import { getSchedulingRepository } from '../../lib/repositories/scheduling.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';

const app = new Hono();
app.use('*', cors());

/**
 * POST /staff/:staffId/availability-slots
 * Enhanced availability creation with conflict detection
 * 
 * Status: ✅ NOW IMPLEMENTED (matches checklist spec)
 */
app.post('/staff/:staffId/availability-slots', async (c) => {
  try {
    const staffId = c.req.param('staffId');
    const { slot } = await c.req.json();

    // Validation
    if (!slot) {
      return c.json({ error: 'Slot object required' }, 400);
    }

    if (!slot.dayOfWeek || !slot.startTime || !slot.endTime) {
      return c.json({ 
        error: 'Missing required fields',
        required: ['dayOfWeek', 'startTime', 'endTime']
      }, 400);
    }

    // ✅ FEATURE 1: Mode Validation (location vs centre)
    if (!slot.mode || !['location', 'centre'].includes(slot.mode)) {
      return c.json({
        error: 'Invalid mode',
        message: 'Mode must be either "location" or "centre"',
        provided: slot.mode
      }, 400);
    }

    // ✅ FEATURE 2: Location Mode Validation
    if (slot.mode === 'location') {
      if (!slot.location || !slot.location.latitude || !slot.location.longitude) {
        return c.json({
          error: 'Location required for location mode',
          message: 'Provide location with latitude, longitude, and radius',
          required: ['location.latitude', 'location.longitude', 'location.radius']
        }, 400);
      }

      if (!slot.location.radius || slot.location.radius <= 0) {
        return c.json({
          error: 'Service radius required',
          message: 'Radius must be greater than 0 km',
          provided: slot.location.radius
        }, 400);
      }
    }

    // ✅ FEATURE 3: Centre Mode Validation
    if (slot.mode === 'centre') {
      if (!slot.centreId) {
        return c.json({
          error: 'Centre ID required for centre mode',
          message: 'Provide centreId when mode is "centre"'
        }, 400);
      }

      // ✅ SQL: Validate centre exists
      const vendor = await getVendorsRepository().findById(slot.centreId);
      if (!vendor) {
        return c.json({
          error: 'Centre not found',
          centreId: slot.centreId
        }, 404);
      }

      slot.centreName = vendor.business_name;
    }

    // ✅ FEATURE 4: Conditional Field Validation for Home Services
    if (slot.hasHomeServices) {
      // Lead time validation
      if (!slot.leadTime || slot.leadTime < 30) {
        return c.json({
          error: 'Invalid lead time for home services',
          message: 'Lead time must be at least 30 minutes for home services',
          provided: slot.leadTime,
          minimum: 30
        }, 400);
      }

      // Max distance validation
      if (!slot.maxDistance || slot.maxDistance <= 0) {
        return c.json({
          error: 'Max distance required for home services',
          message: 'maxDistance must be greater than 0 km',
          provided: slot.maxDistance
        }, 400);
      }

      if (slot.maxDistance > 100) {
        return c.json({
          error: 'Max distance exceeds limit',
          message: 'maxDistance cannot exceed 100 km',
          provided: slot.maxDistance,
          maximum: 100
        }, 400);
      }
    }

    // ✅ FEATURE 5: Centre Concurrency Validation
    if (slot.mode === 'centre' && slot.centreId) {
      if (slot.maxConcurrent === undefined || slot.maxConcurrent < 1) {
        return c.json({
          error: 'Max concurrent bookings required for centre mode',
          message: 'maxConcurrent must be at least 1',
          provided: slot.maxConcurrent
        }, 400);
      }
    }

    // ✅ SQL: Check for conflicts using scheduling repository
    const schedulingRepo = getSchedulingRepository();
    const db = getDbClient();
    
    // Check for existing slots on same day with time overlap
    const { data: existingSlots } = await db
      .from('staff_availability_slots')
      .select('*')
      .eq('staff_id', staffId)
      .eq('day_of_week', slot.dayOfWeek)
      .eq('is_available', true);
    
    // Check time conflicts
    const hasConflict = (existingSlots || []).some((existing: any) => {
      if (existing.id === slot.id) return false; // Skip self for edits
      
      const existingStart = timeToMinutes(existing.start_time);
      const existingEnd = timeToMinutes(existing.end_time);
      const newStart = timeToMinutes(slot.startTime);
      const newEnd = timeToMinutes(slot.endTime);
      
      return (newStart < existingEnd && newEnd > existingStart);
    });

    if (hasConflict) {
      return c.json({
        error: 'Time conflict detected',
        message: 'This time slot overlaps with an existing availability window',
        conflict: true,
        httpStatus: 409
      }, 409);
    }

    // ✅ SQL: Create availability slot
    const slotData: any = {
      staff_id: staffId,
      day_of_week: slot.dayOfWeek,
      start_time: slot.startTime,
      end_time: slot.endTime,
      is_available: true
    };
    
    if (slot.mode === 'location' && slot.location) {
      slotData.location_id = slot.location.id || null;
      // Store location details in metadata
      slotData.metadata = {
        mode: 'location',
        location: slot.location,
        maxDistance: slot.maxDistance,
        leadTime: slot.leadTime
      };
    } else if (slot.mode === 'centre' && slot.centreId) {
      slotData.location_id = slot.centreId;
      slotData.metadata = {
        mode: 'centre',
        centreId: slot.centreId,
        centreName: slot.centreName,
        maxConcurrent: slot.maxConcurrent
      };
    }

    if (slot.id) {
      // Update existing
      await db
        .from('staff_availability_slots')
        .update(slotData)
        .eq('id', slot.id);
    } else {
      // Insert new
      await db
        .from('staff_availability_slots')
        .insert(slotData);
    }

    console.log(`✅ Availability slot created for staff ${staffId}`);

    return c.json({
      success: true,
      slot: {
        ...slot,
        id: slot.id || slotData.id
      },
      message: 'Availability slot created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating availability slot:', error);
    return c.json({ 
      error: 'Failed to create availability slot',
      details: String(error)
    }, 500);
  }
});

// Helper function to convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

console.log('✅ Enhanced staff availability with conflicts registered (SQL-only)');

export default app;

