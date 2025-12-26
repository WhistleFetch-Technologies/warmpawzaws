/**
 * STAFF AVAILABILITY ROUTES - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (11 KV operations → 0)
 * Endpoints: 6
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getSchedulingRepository } from '../../lib/repositories/scheduling.ts';

const app = new Hono();

// ============================================
// STAFF LOCATIONS MANAGEMENT
// ============================================

// GET /staff/:staffId/locations-with-availability - Get all locations with availability windows
app.get('/:staffId/locations-with-availability', async (c) => {
  const { staffId } = c.req.param();

  try {
    // ✅ SQL: Get locations from staff metadata
    const db = getDbClient();
    const { data: staffData } = await db
      .from('staff')
      .select('id, metadata')
      .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
      .single();
    
    if (!staffData) {
      return c.json({ error: 'Staff not found' }, 404);
    }
    
    const locations = (staffData.metadata as any)?.locations || [];

    // ✅ SQL: Load availability windows for each location from staff_availability_slots
    const locationsWithAvailability = await Promise.all(
      locations.map(async (location: any) => {
        const { data: slots } = await db
          .from('staff_availability_slots')
          .select('*')
          .eq('staff_id', staffId)
          .eq('location_id', location.id)
          .eq('is_available', true);
        
        return {
          ...location,
          availabilityWindows: (slots || []).map((slot: any) => ({
            id: slot.id,
            dayOfWeek: slot.day_of_week,
            startTime: slot.start_time,
            endTime: slot.end_time,
            isAvailable: slot.is_available
          }))
        };
      })
    );

    return c.json({ success: true, locations: locationsWithAvailability });
  } catch (error) {
    console.error('Error fetching staff locations with availability:', error);
    return c.json({ error: 'Failed to fetch locations' }, 500);
  }
});

// GET /staff/:staffId/locations - Get all locations for a staff member
app.get('/:staffId/locations', async (c) => {
  const { staffId } = c.req.param();

  try {
    // ✅ SQL: Get locations from staff metadata
    const db = getDbClient();
    const { data: staffData } = await db
      .from('staff')
      .select('id, metadata')
      .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
      .single();
    
    if (!staffData) {
      return c.json({ error: 'Staff not found' }, 404);
    }
    
    const locations = (staffData.metadata as any)?.locations || [];

    return c.json({ success: true, locations });
  } catch (error) {
    console.error('Error fetching staff locations:', error);
    return c.json({ error: 'Failed to fetch locations' }, 500);
  }
});

// POST /staff/:staffId/locations - Add a new location
app.post('/:staffId/locations', async (c) => {
  const { staffId } = c.req.param();
  const { name, address, latitude, longitude, contactNumber } = await c.req.json();

  if (!name || !address) {
    return c.json({ error: 'Location name and address are required' }, 400);
  }

  try {
    // ✅ SQL: Get current locations from staff metadata
    const db = getDbClient();
    const { data: staffData } = await db
      .from('staff')
      .select('id, metadata')
      .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
      .single();
    
    if (!staffData) {
      return c.json({ error: 'Staff not found' }, 404);
    }
    
    const metadata = (staffData.metadata as any) || {};
    const locations = metadata.locations || [];
    
    const newLocation = {
      id: `loc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name,
      address,
      latitude: latitude || null,
      longitude: longitude || null,
      contactNumber: contactNumber || null,
      createdAt: new Date().toISOString()
    };

    locations.push(newLocation);
    
    // ✅ SQL: Update staff metadata with new location
    metadata.locations = locations;
    await db
      .from('staff')
      .update({ metadata, updated_at: new Date().toISOString() })
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`);

    console.log(`✅ Location added for staff ${staffId}:`, newLocation);

    return c.json({ success: true, location: newLocation });
  } catch (error) {
    console.error('Error adding staff location:', error);
    return c.json({ error: 'Failed to add location' }, 500);
  }
});

// DELETE /staff/:staffId/locations/:locationId - Remove a location
app.delete('/:staffId/locations/:locationId', async (c) => {
  const { staffId, locationId } = c.req.param();

  try {
    // ✅ SQL: Get current locations
    const db = getDbClient();
    const { data: staffData } = await db
      .from('staff')
      .select('id, metadata')
      .or(`id.eq.${staffId},staff_id.eq.${staffId}`)
      .single();
    
    if (!staffData) {
      return c.json({ error: 'Staff not found' }, 404);
    }
    
    const metadata = (staffData.metadata as any) || {};
    const locations = metadata.locations || [];
    const updatedLocations = locations.filter((loc: any) => loc.id !== locationId);

    // ✅ SQL: Update staff metadata
    metadata.locations = updatedLocations;
    await db
      .from('staff')
      .update({ metadata, updated_at: new Date().toISOString() })
        .or(`id.eq.${staffId},staff_id.eq.${staffId}`);
    
    // ✅ SQL: Delete availability windows for this location
    await db
      .from('staff_availability_slots')
      .delete()
      .eq('staff_id', staffId)
      .eq('location_id', locationId);

    console.log(`✅ Location ${locationId} removed for staff ${staffId}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error removing staff location:', error);
    return c.json({ error: 'Failed to remove location' }, 500);
  }
});

// ============================================
// LOCATION-BASED AVAILABILITY WINDOWS
// ============================================

// POST /staff/:staffId/locations/:locationId/availability - Add availability window to a location
app.post('/:staffId/locations/:locationId/availability', async (c) => {
  const { staffId, locationId } = c.req.param();
  const { window } = await c.req.json();

  if (!window || typeof window.dayOfWeek !== 'number' || !window.startTime || !window.endTime) {
    return c.json({ error: 'Invalid availability window data' }, 400);
  }

  try {
    // ✅ SQL: Get existing windows for conflict checking
    const db = getDbClient();
    const { data: existingSlots } = await db
      .from('staff_availability_slots')
      .select('*')
      .eq('staff_id', staffId)
      .eq('location_id', locationId)
      .eq('day_of_week', window.dayOfWeek);
    
    const windows = (existingSlots || []).map((slot: any) => ({
      id: slot.id,
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time,
      endTime: slot.end_time
    }));
    
    // Check for time conflicts on the same day
    const hasConflict = windows.some((w: any) => {
      if (w.id === window.id) return false; // Skip self for edits
      if (w.dayOfWeek !== window.dayOfWeek) return false; // Different day
      
      // Check time overlap
      const wStart = timeToMinutes(w.startTime);
      const wEnd = timeToMinutes(w.endTime);
      const newStart = timeToMinutes(window.startTime);
      const newEnd = timeToMinutes(window.endTime);
      
      return (newStart < wEnd && newEnd > wStart);
    });

    if (hasConflict) {
      return c.json({ error: 'Time conflict detected with existing window' }, 409);
    }

    // ✅ SQL: Add or update window
    if (window.id) {
      // Update existing
      await db
        .from('staff_availability_slots')
        .update({
          day_of_week: window.dayOfWeek,
          start_time: window.startTime,
          end_time: window.endTime,
          is_available: window.isAvailable !== false,
          updated_at: new Date().toISOString()
        })
        .eq('id', window.id);
    } else {
      // Insert new
      await db
        .from('staff_availability_slots')
        .insert({
          id: window.id || `window_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          staff_id: staffId,
          location_id: locationId,
          day_of_week: window.dayOfWeek,
          start_time: window.startTime,
          end_time: window.endTime,
          is_available: window.isAvailable !== false
        });
    }

    console.log(`✅ Availability window saved for staff ${staffId} at location ${locationId}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error saving availability window:', error);
    return c.json({ error: 'Failed to save availability window' }, 500);
  }
});

// DELETE /staff/:staffId/locations/:locationId/availability/:windowId - Remove availability window
app.delete('/:staffId/locations/:locationId/availability/:windowId', async (c) => {
  const { staffId, locationId, windowId } = c.req.param();

  try {
    // ✅ SQL: Delete availability window
    const db = getDbClient();
    await db
      .from('staff_availability_slots')
      .delete()
      .eq('id', windowId)
      .eq('staff_id', staffId)
      .eq('location_id', locationId);

    console.log(`✅ Availability window ${windowId} removed`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error removing availability window:', error);
    return c.json({ error: 'Failed to remove availability window' }, 500);
  }
});

// Helper function to convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

console.log('✅ Staff availability routes registered (SQL-only)');

export default app;

