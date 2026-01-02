// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { getStaffRepository } from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

const app = new Hono();

// ============================================
// STAFF LOCATIONS MANAGEMENT
// ============================================

// GET /staff/:staffId/locations-with-availability - Get all locations with availability windows
app.get('/:staffId/locations-with-availability', async (c) => {
  const { staffId } = c.req.param();

  try {
    // ✅ SQL: Get staff locations
    const db = getDbClient();
    const { data: locations } = await db
      .from('staff_locations')
      .select('*')
      .eq('staff_id', staffId);

    // ✅ SQL: Load availability windows for each location
    const locationsWithAvailability = await Promise.all(
      (locations || []).map(async (location: any) => {
        const { data: windows } = await db
          .from('staff_location_availability')
          .select('*')
          .eq('staff_id', staffId)
          .eq('location_id', location.id);
        return {
          ...location,
          availabilityWindows: windows
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
    // ✅ SQL: Get staff locations
    const db = getDbClient();
    const { data: locations } = await db
      .from('staff_locations')
      .select('*')
      .eq('staff_id', staffId);

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
    // ✅ SQL: Get staff locations
    const db = getDbClient();
    const { data: locations } = await db
      .from('staff_locations')
      .select('*')
      .eq('staff_id', staffId);
    
    const newLocation = {
      id: `loc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name,
      address,
      latitude: latitude || null,
      longitude: longitude || null,
      contactNumber: contactNumber || null,
      createdAt: new Date().toISOString()
    };

    // ✅ SQL: Insert new location
    const db = getDbClient();
    await db.from('staff_locations').insert({
      id: newLocation.id,
      staff_id: staffId,
      name: newLocation.name,
      address: newLocation.address,
      latitude: newLocation.latitude,
      longitude: newLocation.longitude,
      contact_number: newLocation.contactNumber,
      created_at: newLocation.createdAt
    });

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
    // ✅ SQL: Get staff locations
    const db = getDbClient();
    const { data: locations } = await db
      .from('staff_locations')
      .select('*')
      .eq('staff_id', staffId);
    
    // ✅ SQL: Delete location and its availability windows
    await db.from('staff_location_availability')
      .delete()
      .eq('staff_id', staffId)
      .eq('location_id', locationId);
    
    await db.from('staff_locations')
      .delete()
      .eq('staff_id', staffId)
      .eq('id', locationId);

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
    // ✅ SQL: Get availability windows
    const db = getDbClient();
    const { data: windows } = await db
      .from('staff_location_availability')
      .select('*')
      .eq('staff_id', staffId)
      .eq('location_id', locationId);
    
    const windowsArray = windows || [];
    
    // Check for time conflicts on the same day
    const hasConflict = windowsArray.some((w: any) => {
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
    const windowId = window.id || `window_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const windowData = {
      id: windowId,
      staff_id: staffId,
      location_id: locationId,
      day_of_week: window.dayOfWeek,
      start_time: window.startTime,
      end_time: window.endTime,
      updated_at: new Date().toISOString(),
      created_at: window.createdAt || new Date().toISOString()
    };
    
    const { data: existing } = await db
      .from('staff_location_availability')
      .select('*')
      .eq('id', windowId)
      .single();
    
    if (existing) {
      await db.from('staff_location_availability')
        .update(windowData)
        .eq('id', windowId);
    } else {
      await db.from('staff_location_availability').insert(windowData);
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
    // ✅ SQL: Get availability windows
    const db = getDbClient();
    const { data: windows } = await db
      .from('staff_location_availability')
      .select('*')
      .eq('staff_id', staffId)
      .eq('location_id', locationId);
    
    // ✅ SQL: Delete availability window
    const db = getDbClient();
    await db.from('staff_location_availability')
      .delete()
      .eq('staff_id', staffId)
      .eq('location_id', locationId)
      .eq('id', windowId);

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

export default app;