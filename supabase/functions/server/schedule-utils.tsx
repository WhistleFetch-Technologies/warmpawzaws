import * as kv from './kv_store.tsx';

/**
 * Get schedule settings from platform configuration
 */
async function getScheduleSettings() {
  const settings = await kv.get('platform:schedule_settings');
  if (settings) return settings;
  
  // Return default settings if not configured
  return {
    bufferTime: {
      at_center: 30,
      at_home: 120,
      tele: 15,
      instant_video: 5
    },
    vendorBufferTime: {},
    maxDaysAhead: 30,
    minSlotDuration: 30,
    slotInterval: 30,
    travelTimeBetweenLocations: 30
  };
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get next available slot for a staff member at a specific location
 * Considers: working hours, existing bookings, breaks, holidays, location availability, buffer time, past slots
 */
export async function getStaffNextAvailableSlot(
  staffId: string,
  locationId: string,
  serviceDuration: number = 30,
  serviceStyle: string = 'at_center',
  vendorRoleId?: string
): Promise<{ date: string; time: string; slot: string } | null> {
  try {
    // ✅ Get schedule settings
    const scheduleSettings = await getScheduleSettings();
    
    // ✅ Determine buffer time based on service style and vendor type
    let bufferTimeMinutes = scheduleSettings.bufferTime[serviceStyle] || scheduleSettings.bufferTime.at_center;
    
    // Check for vendor-specific override
    if (vendorRoleId && scheduleSettings.vendorBufferTime[vendorRoleId]?.[serviceStyle]) {
      bufferTimeMinutes = scheduleSettings.vendorBufferTime[vendorRoleId][serviceStyle];
    }
    
    console.log(`🕒 Buffer time for ${serviceStyle} (${vendorRoleId || 'default'}): ${bufferTimeMinutes} minutes`);
    
    // Get staff data
    const staff = await kv.get(`staff:${staffId}`);
    if (!staff || !staff.isActive) return null;

    // Get staff's location assignments
    const staffLocations = staff.assignedLocations || [locationId];
    if (!staffLocations.includes(locationId)) {
      console.log(`⚠️ Staff ${staffId} not assigned to location ${locationId}`);
      return null;
    }

    // ✅ FIX: Ensure availability is an array
    const availability = Array.isArray(staff.availability) ? staff.availability : [];
    if (availability.length === 0) {
      console.log(`⚠️ Staff ${staffId} has no availability data`);
      return null;
    }

    const locationAvailability = availability.find((a: any) => 
      a.locationId === locationId || !a.locationId
    );

    if (!locationAvailability) {
      console.log(`⚠️ Staff ${staffId} has no availability for location ${locationId}`);
      return null;
    }

    // Get staff's existing bookings
    const bookingIds = await kv.get(`staff:${staffId}:bookings`) || [];
    const existingBookings: any[] = [];
    
    for (const bookingId of bookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking && (booking.status === 'confirmed' || booking.status === 'in_progress')) {
        existingBookings.push({
          date: booking.scheduledDate,
          time: booking.scheduledTime,
          duration: booking.duration || serviceDuration,
          locationId: booking.locationId || booking.vendorId
        });
      }
    }

    // Get staff breaks
    const breaks = staff.breaks || [];
    
    // Get staff holidays
    const holidays = staff.holidays || [];

    // ✅ Start checking from current time + buffer
    const now = new Date();
    const maxDaysAhead = scheduleSettings.maxDaysAhead || 30;
    
    // ✅ Calculate minimum bookable time (now + buffer)
    const minBookableTime = new Date(now.getTime() + bufferTimeMinutes * 60 * 1000);

    for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + dayOffset);
      checkDate.setHours(0, 0, 0, 0); // Reset to start of day
      
      const dateString = checkDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const dayOfWeek = checkDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      const isToday = dayOffset === 0;

      // Check if it's a holiday
      if (holidays.some((h: any) => h.date === dateString)) continue;

      // Check if staff works on this day
      const daySchedule = locationAvailability[dayOfWeek];
      if (!daySchedule || !daySchedule.isAvailable) continue;

      // Get working hours
      const workingHours = daySchedule.slots || [];
      
      for (const slot of workingHours) {
        const [startHour, startMin] = slot.start.split(':').map(Number);
        const [endHour, endMin] = slot.end.split(':').map(Number);

        // Generate time slots
        const slotInterval = scheduleSettings.slotInterval || 30;
        let currentMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        while (currentMinutes + serviceDuration <= endMinutes) {
          const slotHour = Math.floor(currentMinutes / 60);
          const slotMin = currentMinutes % 60;
          const timeString = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

          // ✅ CRITICAL: Check if slot is in the past or within buffer time
          const slotDateTime = new Date(checkDate);
          slotDateTime.setHours(slotHour, slotMin, 0, 0);
          
          if (slotDateTime <= minBookableTime) {
            currentMinutes += slotInterval;
            continue; // Skip past slots and slots within buffer time
          }

          // Check if this slot conflicts with existing bookings
          const hasConflict = existingBookings.some(booking => {
            if (booking.date !== dateString) return false;
            
            // Parse booking time
            const [bookingHour, bookingMin] = booking.time.split(':').map(Number);
            const bookingStart = bookingHour * 60 + bookingMin;
            const bookingEnd = bookingStart + (booking.duration || 30);

            // Check overlap
            const slotStart = currentMinutes;
            const slotEnd = currentMinutes + serviceDuration;

            return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
          });

          if (hasConflict) {
            currentMinutes += slotInterval;
            continue;
          }

          // Check if this slot conflicts with breaks
          const hasBreakConflict = breaks.some((breakItem: any) => {
            if (breakItem.date && breakItem.date !== dateString) return false;
            if (breakItem.dayOfWeek && breakItem.dayOfWeek !== dayOfWeek) return false;
            
            const [breakStartHour, breakStartMin] = breakItem.start.split(':').map(Number);
            const [breakEndHour, breakEndMin] = breakItem.end.split(':').map(Number);
            const breakStart = breakStartHour * 60 + breakStartMin;
            const breakEnd = breakEndHour * 60 + breakEndMin;

            const slotStart = currentMinutes;
            const slotEnd = currentMinutes + serviceDuration;

            return !(slotEnd <= breakStart || slotStart >= breakEnd);
          });

          if (hasBreakConflict) {
            currentMinutes += slotInterval;
            continue;
          }

          // Check if staff is at another location at this time
          const hasLocationConflict = existingBookings.some(booking => {
            if (booking.date !== dateString) return false;
            if (booking.locationId === locationId) return false; // Same location is OK
            
            const [bookingHour, bookingMin] = booking.time.split(':').map(Number);
            const bookingStart = bookingHour * 60 + bookingMin;
            const bookingEnd = bookingStart + (booking.duration || 30);

            const slotStart = currentMinutes;
            const slotEnd = currentMinutes + serviceDuration;

            // Staff can't be in two locations at the same time
            return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
          });

          if (!hasLocationConflict) {
            // ✅ Found available slot!
            console.log(`✅ Found available slot: ${dateString} ${timeString}`);
            return {
              date: dateString,
              time: timeString,
              slot: formatTimeSlot(timeString, serviceDuration)
            };
          }

          currentMinutes += slotInterval;
        }
      }
    }

    return null; // No available slots found
  } catch (error) {
    console.error('❌ Error getting staff next available slot:', error);
    return null;
  }
}

/**
 * Get next available slot for a center/clinic
 * Considers: operating hours, staff availability, existing bookings
 */
export async function getCenterNextAvailableSlot(
  centerId: string,
  serviceDuration: number = 30
): Promise<{ date: string; time: string; slot: string } | null> {
  try {
    // Get center/vendor data
    const center = await kv.get(`vendor:${centerId}`);
    if (!center || !center.isActive) return null;

    // Get center's staff
    const staffIds = await kv.get(`vendor:${centerId}:staff`) || [];
    if (staffIds.length === 0) return null;

    // Get operating hours from facility
    const facility = await kv.get(`facility:${centerId}`);
    const operatingHours = facility?.operatingHours || center.operatingHours || '9:00 AM - 6:00 PM';

    // Find the earliest available slot across all staff
    let earliestSlot: any = null;

    for (const staffId of staffIds) {
      const slot = await getStaffNextAvailableSlot(staffId, centerId, serviceDuration);
      
      if (slot) {
        if (!earliestSlot) {
          earliestSlot = slot;
        } else {
          // Compare dates and times
          const slotDateTime = new Date(`${slot.date}T${slot.time}`);
          const earliestDateTime = new Date(`${earliestSlot.date}T${earliestSlot.time}`);
          
          if (slotDateTime < earliestDateTime) {
            earliestSlot = slot;
          }
        }
      }
    }

    return earliestSlot;
  } catch (error) {
    console.error('❌ Error getting center next available slot:', error);
    return null;
  }
}

/**
 * Format time slot for display
 */
function formatTimeSlot(time: string, duration: number): string {
  const [hour, min] = time.split(':').map(Number);
  const endMinutes = hour * 60 + min + duration;
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;

  const formatTime = (h: number, m: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
  };

  return `${formatTime(hour, min)} - ${formatTime(endHour, endMin)}`;
}

/**
 * Get staff availability for a specific location
 */
export async function getStaffAvailabilityByLocation(staffId: string) {
  const staff = await kv.get(`staff:${staffId}`);
  if (!staff) return {};

  const assignedLocations = staff.assignedLocations || [];
  
  // ✅ FIX: Ensure availability is an array
  const availability = Array.isArray(staff.availability) ? staff.availability : [];

  const locationAvailability: any = {};

  for (const locationId of assignedLocations) {
    const locationSlot = availability.find((a: any) => a.locationId === locationId);
    if (locationSlot) {
      locationAvailability[locationId] = locationSlot;
    }
  }

  return locationAvailability;
}