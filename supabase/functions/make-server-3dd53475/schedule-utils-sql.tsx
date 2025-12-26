/**
 * ============================================================================
 * SCHEDULE UTILS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Utility functions for schedule management
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.getByPrefix()` with SQL queries
 * - Uses `platform_settings` (for schedule settings)
 * - Uses `staff`, `bookings`, `staff_availability` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 17 - KV to SQL (8 KV operations removed)
 * ============================================================================
 */

import { getDbClient } from '../../lib/db.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';

const db = getDbClient();
const staffRepo = getStaffRepository();
const bookingsRepo = getBookingsRepository();

/**
 * Get schedule settings from platform configuration
 */
async function getScheduleSettings() {
  // ✅ SQL: Get schedule settings from platform_settings
  const { data, error } = await db
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'schedule_settings')
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching schedule settings:', error);
  }
  
  if (data?.setting_value) {
    return data.setting_value;
  }
  
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
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
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
  
  return Math.round(distance * 10) / 10;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get next available slot for a staff member at a specific location
 */
export async function getStaffNextAvailableSlot(
  staffId: string,
  locationId: string,
  serviceDuration: number = 30,
  serviceStyle: string = 'at_center',
  vendorRoleId?: string
): Promise<{ date: string; time: string; slot: string } | null> {
  try {
    const scheduleSettings = await getScheduleSettings();
    
    let bufferTimeMinutes = scheduleSettings.bufferTime[serviceStyle] || scheduleSettings.bufferTime.at_center;
    
    if (vendorRoleId && scheduleSettings.vendorBufferTime[vendorRoleId]?.[serviceStyle]) {
      bufferTimeMinutes = scheduleSettings.vendorBufferTime[vendorRoleId][serviceStyle];
    }
    
    // ✅ SQL: Get staff
    const staff = await staffRepo.findById(staffId);
    if (!staff || !staff.is_active) return null;

    // ✅ SQL: Get staff availability
    const { data: availabilityData } = await db
      .from('staff_availability')
      .select('*')
      .eq('staff_id', staffId)
      .eq('is_active', true);
    
    const availability = availabilityData || [];
    if (availability.length === 0) {
      console.log(`⚠️ Staff ${staffId} has no availability data`);
      return null;
    }

    const locationAvailability = availability.find((a: any) => 
      a.location_id === locationId || !a.location_id
    );

    if (!locationAvailability) {
      console.log(`⚠️ Staff ${staffId} has no availability for location ${locationId}`);
      return null;
    }

    // ✅ SQL: Get staff's existing bookings
    const { data: bookings } = await db
      .from('bookings')
      .select('*')
      .eq('staff_id', staffId)
      .in('status', ['confirmed', 'in_progress']);
    
    const existingBookings = (bookings || []).map((b: any) => ({
      date: b.scheduled_date,
      time: b.scheduled_time,
      duration: b.duration || serviceDuration,
      locationId: b.location_id || b.vendor_id
    }));

    // Get staff breaks and holidays from metadata
    const breaks = (staff as any).metadata?.breaks || [];
    const holidays = (staff as any).metadata?.holidays || [];

    const now = new Date();
    const maxDaysAhead = scheduleSettings.maxDaysAhead || 30;
    const minBookableTime = new Date(now.getTime() + bufferTimeMinutes * 60 * 1000);

    for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + dayOffset);
      checkDate.setHours(0, 0, 0, 0);
      
      const dateString = checkDate.toISOString().split('T')[0];
      const dayOfWeek = checkDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      if (holidays.some((h: any) => h.date === dateString)) continue;

      // Check if staff works on this day (from availability)
      const daySchedule = locationAvailability[dayOfWeek];
      if (!daySchedule || !daySchedule.is_available) continue;

      const workingHours = daySchedule.slots || [];
      const slotInterval = scheduleSettings.slotInterval || 30;
      
      for (const slot of workingHours) {
        const [startHour, startMin] = slot.start.split(':').map(Number);
        const [endHour, endMin] = slot.end.split(':').map(Number);

        let currentMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        while (currentMinutes + serviceDuration <= endMinutes) {
          const slotHour = Math.floor(currentMinutes / 60);
          const slotMin = currentMinutes % 60;
          const timeString = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

          const slotDateTime = new Date(checkDate);
          slotDateTime.setHours(slotHour, slotMin, 0, 0);
          
          if (slotDateTime <= minBookableTime) {
            currentMinutes += slotInterval;
            continue;
          }

          // Check conflicts
          const hasConflict = existingBookings.some(booking => {
            if (booking.date !== dateString) return false;
            const [bookingHour, bookingMin] = booking.time.split(':').map(Number);
            const bookingStart = bookingHour * 60 + bookingMin;
            const bookingEnd = bookingStart + (booking.duration || 30);
            const slotStart = currentMinutes;
            const slotEnd = currentMinutes + serviceDuration;
            return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
          });

          if (hasConflict) {
            currentMinutes += slotInterval;
            continue;
          }

          // Check break conflicts
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

          // Check location conflicts
          const hasLocationConflict = existingBookings.some(booking => {
            if (booking.date !== dateString) return false;
            if (booking.locationId === locationId) return false;
            const [bookingHour, bookingMin] = booking.time.split(':').map(Number);
            const bookingStart = bookingHour * 60 + bookingMin;
            const bookingEnd = bookingStart + (booking.duration || 30);
            const slotStart = currentMinutes;
            const slotEnd = currentMinutes + serviceDuration;
            return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
          });

          if (!hasLocationConflict) {
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

    return null;
  } catch (error) {
    console.error('❌ Error getting staff next available slot:', error);
    return null;
  }
}

/**
 * Get next available slot for a center/clinic
 */
export async function getCenterNextAvailableSlot(
  centerId: string,
  serviceDuration: number = 30
): Promise<{ date: string; time: string; slot: string } | null> {
  try {
    // ✅ SQL: Get center/vendor
    const center = await vendorsRepo.findById(centerId);
    if (!center || !center.is_active) return null;

    // ✅ SQL: Get center's staff
    const { data: staffList } = await db
      .from('staff')
      .select('id')
      .eq('vendor_id', centerId)
      .eq('is_active', true);
    
    const staffIds = (staffList || []).map((s: any) => s.id);
    if (staffIds.length === 0) return null;

    // Find the earliest available slot across all staff
    let earliestSlot: any = null;

    for (const staffId of staffIds) {
      const slot = await getStaffNextAvailableSlot(staffId, centerId, serviceDuration);
      
      if (slot) {
        if (!earliestSlot) {
          earliestSlot = slot;
        } else {
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
  // ✅ SQL: Get staff
  const staff = await staffRepo.findById(staffId);
  if (!staff) return {};

  // ✅ SQL: Get staff availability
  const { data: availabilityData } = await db
    .from('staff_availability')
    .select('*')
    .eq('staff_id', staffId)
    .eq('is_active', true);

  const availability = availabilityData || [];
  const locationAvailability: any = {};

  for (const slot of availability) {
    const locationId = slot.location_id;
    if (locationId) {
      locationAvailability[locationId] = slot;
    }
  }

  return locationAvailability;
}

// Import vendorsRepo for getCenterNextAvailableSlot
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
const vendorsRepo = getVendorsRepository();

console.log('✅ Schedule Utils (SQL-only) loaded');

