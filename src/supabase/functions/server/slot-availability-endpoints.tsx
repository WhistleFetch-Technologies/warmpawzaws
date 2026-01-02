/**
 * GET /make-server-3dd53475/vendor/:vendorId/availability/:date
 * 
 * Get aggregated availability for all staff at a vendor/center
 * Used for center-based services where customer doesn't select specific staff
 * Returns combined slots from all active staff members
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { 
  getVendorsRepository,
  getStaffRepository,
  getStaffAvailabilityRepository,
  getBookingsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

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
    
    // ✅ SQL: Get vendor from vendors table
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }
    
    // ✅ SQL: Get all staff for this vendor from staff table
    const staffRepo = getStaffRepository();
    const staffMembers = await staffRepo.findByVendor(vendorId);
    const staffIds = staffMembers.map(s => s.id);
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
      // ✅ SQL: Get staff from staff table
      const staff = await staffRepo.findById(staffId);
      if (!staff || !staff.is_active) {
        console.log(`⏭️  Skipping inactive staff: ${staffId}`);
        continue;
      }
      
      console.log(`   Processing staff: ${staff.full_name || staff.name}`);
      
      // ✅ SQL: Get staff schedule from staff_availability table
      const staffAvailabilityRepo = getStaffAvailabilityRepository();
      const availabilityData = await staffAvailabilityRepo.findByStaffAndDate(staffId, date);
      
      let schedule = availabilityData ? {
        date: availabilityData.date,
        slots: availabilityData.slots || []
      } : null;
      
      if (!schedule || !schedule.slots || schedule.slots.length === 0) {
        // Generate default slots based on working hours
        const workingHours = staff.metadata?.workingHours || { start: '09:00', end: '18:00' };
        schedule = {
          date,
          slots: generateDefaultSlots(date, workingHours)
        };
        console.log(`   Generated ${schedule.slots.length} default slots`);
      }
      
      // ✅ SQL: Get all bookings for this staff on this date from bookings table
      const bookingsRepo = getBookingsRepository();
      const allBookingsData = await bookingsRepo.findByStaffAndDate(staffId, date);
      const staffBookings = allBookingsData.filter((b: any) =>
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
          staffName: staff.full_name || staff.name,
          staffPhoto: staff.photo || staff.metadata?.photo || null,
          bookingId: booking?.id,
          slotId: slot.slotId || `slot_${staffId}_${date}_${slot.time.replace(':', '')}`
        };
      });
      
      const availableCount = processedSlots.filter((s: any) => s.status === 'available').length;
      
      staffAvailability.push({
        staffId,
        staffName: staff.full_name || staff.name,
        staffPhoto: staff.photo || staff.metadata?.photo || null,
        slots: processedSlots,
        availableCount,
        totalCount: processedSlots.length
      });
      
      // Add available slots to combined pool
      const availableSlots = processedSlots.filter((s: any) => s.status === 'available');
      allSlots.push(...availableSlots);
      totalAvailable += availableCount;
      
      console.log(`   Available slots for ${staff.full_name || staff.name}: ${availableCount}`);
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
      vendorName: vendor.business_name || vendor.full_name,
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