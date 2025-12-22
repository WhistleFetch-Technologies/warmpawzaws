/**
 * STAFF AVAILABILITY ROUTES - SQL VERSION
 * NO KV STORE - All data from SQL
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../../supabase/lib/db.ts';
import { getSchedulingRepository } from '../../../supabase/lib/repositories/scheduling.ts';

export function staffAvailabilityRoutesSQL(app: Hono) {
  
  /**
   * POST /make-server-3dd53475/staff/:staffId/locations/:locationId/availability (SQL)
   * Add availability window to a location
   */
  app.post('/make-server-3dd53475/staff/:staffId/locations/:locationId/availability', async (c) => {
    try {
      const { staffId, locationId } = c.req.param();
      const { window } = await c.req.json();
      
      if (!window || typeof window.dayOfWeek !== 'number' || !window.startTime || !window.endTime) {
        return c.json({ error: 'Invalid availability window data' }, 400);
      }
      
      const client = getDbClient();
      
      // Check staff exists
      const { data: staff } = await client
        .from('staff')
        .select('id')
        .eq('id', staffId)
        .single();
      
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }
      
      // Check location assignment exists
      const { data: assignment } = await client
        .from('staff_location_assignments')
        .select('*')
        .eq('staff_id', staffId)
        .eq('location_id', locationId)
        .single();
      
      if (!assignment) {
        // Create location assignment first
        await client
          .from('staff_location_assignments')
          .insert({
            staff_id: staffId,
            location_id: locationId,
            is_primary: false
          });
      }
      
      // Insert availability slot
      const { data: availability, error } = await client
        .from('staff_availability_slots')
        .insert({
          staff_id: staffId,
          location_id: locationId,
          day_of_week: window.dayOfWeek,
          start_time: window.startTime,
          end_time: window.endTime,
          is_available: true
        })
        .select()
        .single();
      
      if (error) {
        // If duplicate, update instead
        if (error.code === '23505') { // Unique violation
          const { data: updated } = await client
            .from('staff_availability_slots')
            .update({
              start_time: window.startTime,
              end_time: window.endTime,
              is_available: true,
              updated_at: new Date().toISOString()
            })
            .eq('staff_id', staffId)
            .eq('location_id', locationId)
            .eq('day_of_week', window.dayOfWeek)
            .select()
            .single();
          
          return c.json({ success: true, availability: updated });
        }
        
        throw error;
      }
      
      return c.json({ success: true, availability });
    } catch (error) {
      console.error('Error adding availability window:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * DELETE /make-server-3dd53475/staff/:staffId/locations/:locationId/availability/:availabilityId (SQL)
   * Remove availability window
   */
  app.delete('/make-server-3dd53475/staff/:staffId/locations/:locationId/availability/:availabilityId', async (c) => {
    try {
      const { availabilityId } = c.req.param();
      const client = getDbClient();
      
      await client
        .from('staff_availability_slots')
        .delete()
        .eq('id', availabilityId);
      
      return c.json({ success: true });
    } catch (error) {
      console.error('Error removing availability window:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * DELETE /make-server-3dd53475/staff/:staffId/locations/:locationId (SQL)
   * Remove location assignment
   */
  app.delete('/make-server-3dd53475/staff/:staffId/locations/:locationId', async (c) => {
    try {
      const { staffId, locationId } = c.req.param();
      const client = getDbClient();
      
      // Delete availability windows for this location
      await client
        .from('staff_availability_slots')
        .delete()
        .eq('staff_id', staffId)
        .eq('location_id', locationId);
      
      // Delete location assignment
      await client
        .from('staff_location_assignments')
        .delete()
        .eq('staff_id', staffId)
        .eq('location_id', locationId);
      
      console.log(`✅ Location ${locationId} removed for staff ${staffId} (SQL)`);
      
      return c.json({ success: true });
    } catch (error) {
      console.error('Error removing staff location:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

// Export as default for compatibility
export default staffAvailabilityRoutesSQL;

