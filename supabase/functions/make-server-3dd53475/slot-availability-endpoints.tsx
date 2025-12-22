/**
 * GET /make-server-3dd53475/vendor/:vendorId/availability/:date
 * 
 * Get aggregated availability for all staff at a vendor/center
 * Used for center-based services where customer doesn't select specific staff
 * Returns combined slots from all active staff members
 */

import { Hono } from "npm:hono@4";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.get('/make-server-3dd53475/vendor/:vendorId/availability/:date', async (c) => {
  try {
    const { vendorId, date } = c.req.param();
    
    console.log(`\n🏥 ===== GET VENDOR AVAILABILITY (ALL STAFF) =====`);
    console.log(`🏢 Vendor ID: ${vendorId}`);
    console.log(`📅 Date: ${date}`);
    
    // Validate date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
    }
    
    // Get vendor
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }
    
    // Get all staff for this vendor
    const staffIds = await kv.get(`vendor:${vendorId}:staff`) || [];
    console.log(`👥 Found ${staffIds.length} staff members for ${vendor.businessName || vendor.fullName}`);
    
    if (staffIds.length === 0) {
      return c.json({
        success: false,
        error: 'No staff members found for this vendor',
        message: 'Please contact support to add staff members'
      }, 404);
    }
    
    // Fetch availability for each active staff member
    const allSlots: any[] = [];
    const staffAvailability: any[] = [];
    let totalAvailable = 0;
    
    for (const staffId of staffIds) {
      const staff = await kv.get(`staff:${staffId}`);
      if (!staff || !staff.isActive) {
        console.log(`⏭️  Skipping inactive staff: ${staffId}`);
        continue;
      }
      
      console.log(`   Processing staff: ${staff.fullName || staff.name}`);
      
      // Get staff schedule - try multiple key patterns
      let schedule = await kv.get(`doctor:${staffId}:availability:${date}`) ||
                     await kv.get(`staff:${staffId}:availability:${date}`) ||
                     await kv.get(`groomer:${staffId}:availability:${date}`) ||
                     await kv.get(`trainer:${staffId}:availability:${date}`);
      
      if (!schedule || !schedule.slots) {
        // Generate default slots based on working hours
        const workingHours = staff.workingHours || { start: '09:00', end: '18:00' };
        schedule = {
          date,
          slots: generateDefaultSlots(date, workingHours)
        };
        console.log(`   Generated ${schedule.slots.length} default slots`);
      }
      
      // Get all bookings for this staff on this date
      const allBookings = await kv.getByPrefix(`booking:`);
      const staffBookings = allBookings.filter((b: any) =>
        (b.staffId === staffId || b.assignedStaffId === staffId) &&
        b.scheduledDate === date &&
        ['scheduled', 'in_progress', 'start_otp_pending', 'end_otp_pending'].includes(b.status)
      );
      
      console.log(`   Found ${staffBookings.length} bookings for this staff on ${date}`);
      
      // Process slots and mark booked ones
      const processedSlots = schedule.slots.map((slot: any) => {
        const booking = staffBookings.find((b: any) => b.scheduledTime === slot.time);
        const isAvailable = !booking && slot.status !== 'blocked';
        
        return {
          time: slot.time,
          status: booking ? 'booked' : (slot.status || 'available'),
          staffId,
          staffName: staff.fullName || staff.name,
          staffPhoto: staff.photo || null,
          bookingId: booking?.id,
          slotId: slot.slotId || `slot_${staffId}_${date}_${slot.time.replace(':', '')}`
        };
      });
      
      const availableCount = processedSlots.filter((s: any) => s.status === 'available').length;
      
      staffAvailability.push({
        staffId,
        staffName: staff.fullName || staff.name,
        staffPhoto: staff.photo || null,
        slots: processedSlots,
        availableCount,
        totalCount: processedSlots.length
      });
      
      // Add available slots to combined pool
      const availableSlots = processedSlots.filter((s: any) => s.status === 'available');
      allSlots.push(...availableSlots);
      totalAvailable += availableCount;
      
      console.log(`   Available slots for ${staff.fullName || staff.name}: ${availableCount}`);
    }
    
    // Deduplicate slots by time (in case multiple staff have same time available)
    // Group by time and include all available staff for that time
    const slotsByTime = new Map<string, any>();
    
    allSlots.forEach(slot => {
      if (!slotsByTime.has(slot.time)) {
        slotsByTime.set(slot.time, {
          time: slot.time,
          status: 'available',
          availableStaff: []
        });
      }
      slotsByTime.get(slot.time).availableStaff.push({
        staffId: slot.staffId,
        staffName: slot.staffName,
        staffPhoto: slot.staffPhoto
      });
    });
    
    // Convert to array and sort by time
    const uniqueSlots = Array.from(slotsByTime.values()).sort((a, b) => 
      a.time.localeCompare(b.time)
    );
    
    console.log(`✅ Aggregated ${uniqueSlots.length} unique time slots across ${staffAvailability.length} active staff`);
    console.log(`   Total available slots: ${totalAvailable}`);
    
    return c.json({
      success: true,
      date,
      vendorId,
      vendorName: vendor.businessName || vendor.fullName,
      slots: uniqueSlots,
      staffAvailability,
      availableCount: uniqueSlots.length,
      totalSlotsAcrossAllStaff: totalAvailable,
      staffCount: staffAvailability.length,
      message: `Found ${uniqueSlots.length} available time slots`
    });
    
  } catch (error: any) {
    console.error('❌ Error fetching vendor availability:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch availability',
      message: error.message || String(error)
    }, 500);
  }
});

// Helper function to generate default slots
function generateDefaultSlots(date: string, workingHours: { start: string; end: string }) {
  const slots: any[] = [];
  const [startHour, startMin] = workingHours.start.split(':').map(Number);
  const [endHour, endMin] = workingHours.end.split(':').map(Number);
  
  let currentHour = startHour;
  let currentMin = startMin;
  
  while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
    const time = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    slots.push({
      time,
      status: 'available',
      slotId: `slot_${date}_${time.replace(':', '')}`
    });
    
    // Increment by 30 minutes
    currentMin += 30;
    if (currentMin >= 60) {
      currentMin -= 60;
      currentHour += 1;
    }
  }
  
  return slots;
}

export default app;