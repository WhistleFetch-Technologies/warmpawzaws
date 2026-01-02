/**
 * FOLLOWUP ENDPOINTS - SQL VERSION
 * NO KV STORE - All data from SQL
 */

import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';
import { getSchedulingRepository } from '../../../supabase/lib/repositories/scheduling';

export function followupEndpointsSQL(app: Hono) {
  
  /**
   * GET /make-server-3dd53475/vendor/:vendorId/slots/:date (SQL)
   * Get available slots with validation
   */
  app.get('/make-server-3dd53475/vendor/:vendorId/slots/:date', async (c) => {
    try {
      const { vendorId, date } = c.req.param();
      const serviceStyle = c.req.query('serviceStyle') || 'at_center';
      
      console.log(`📅 [SLOTS] Fetching slots for vendor ${vendorId} on ${date} (SQL)`);
      
      const client = getDbClient();
      const schedulingRepo = getSchedulingRepository();
      
      // Check vendor exists and is active
      const { data: vendor } = await client
        .from('vendors')
        .select('id, is_active')
        .eq('id', vendorId)
        .single();
      
      if (!vendor || !vendor.is_active) {
        return c.json({
          success: true,
          slots: [],
          message: 'Vendor not available'
        });
      }
      
      // Get vendor availability for this day
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      
      const vendorAvailability = await schedulingRepo.getVendorAvailability(vendorId, dayOfWeek);
      const dayAvailability = vendorAvailability.filter(avail => 
        avail.service_style === serviceStyle && avail.is_enabled
      );
      
      if (dayAvailability.length === 0) {
        return c.json({
          success: true,
          slots: [],
          message: 'Vendor not available on this day'
        });
      }
      
      // Generate slots from time windows
      const allSlots: any[] = [];
      const now = new Date();
      const minBookingTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 min buffer
      
      for (const avail of dayAvailability) {
        const [startHour, startMin] = avail.time_window_start.split(':').map(Number);
        const [endHour, endMin] = avail.time_window_end.split(':').map(Number);
        const slotDuration = avail.slot_duration_minutes || 30;
        
        let currentHour = startHour;
        let currentMin = startMin;
        
        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
          const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
          
          // Check if slot is in the past
          const slotDateTime = new Date(date);
          slotDateTime.setHours(currentHour, currentMin, 0, 0);
          
          if (slotDateTime >= minBookingTime) {
            // Check if slot is booked
            const capacity = await schedulingRepo.getSlotCapacity(
              vendorId,
              null,
              date,
              timeStr,
              serviceStyle
            );
            
            const isBooked = capacity && capacity.current_bookings >= capacity.max_capacity;
            
            allSlots.push({
              time: timeStr,
              available: !isBooked,
              bookedCount: capacity?.current_bookings || 0,
              isPast: false
            });
          }
          
          // Increment time
          currentMin += slotDuration;
          if (currentMin >= 60) {
            currentMin -= 60;
            currentHour += 1;
          }
        }
      }
      
      console.log(`✅ [SLOTS] Found ${allSlots.length} slots (${allSlots.filter(s => s.available).length} available) (SQL)`);
      
      return c.json({
        success: true,
        slots: allSlots,
        date: date,
        onVacation: false
      });
    } catch (error) {
      console.error('❌ [SLOTS] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

// Export as default for compatibility
export default followupEndpointsSQL;

