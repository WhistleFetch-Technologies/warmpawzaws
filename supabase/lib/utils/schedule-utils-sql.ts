/**
 * SCHEDULE UTILITIES - SQL VERSION
 * NO KV STORE - All data from SQL
 */

import { getDbClient } from "../db.ts";
import { getSchedulingRepository } from "../repositories/scheduling.ts";
import { getBookingsRepository } from "../repositories/bookings.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Calculate distance between two coordinates (Haversine formula)
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
 * Get schedule settings from SQL
 */
export async function getScheduleSettings(): Promise<any> {
  const client = getDbClient();
  
  const { data: policy } = await client
    .from('scheduling_policies')
    .select('policy_config')
    .eq('policy_type', 'buffer_time')
    .eq('is_active', true)
    .single();
  
  if (policy?.policy_config) {
    return {
      bufferTime: policy.policy_config.bufferTimePerServiceType || {
        at_center: 30,
        at_home: 120,
        tele: 15,
        instant_video: 5
      },
      vendorBufferTime: policy.policy_config.vendorBufferTime || {},
      maxDaysAhead: policy.policy_config.maxDaysAhead || 30,
      minSlotDuration: policy.policy_config.minSlotDuration || 30,
      slotInterval: policy.policy_config.slotInterval || 30,
      travelTimeBetweenLocations: policy.policy_config.travelTimeBetweenLocations || 30
    };
  }
  
  // Default settings
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
 * Get next available slot for a staff member at a specific location (SQL)
 */
export async function getStaffNextAvailableSlot(
  staffId: string,
  locationId: string,
  serviceDuration: number = 30,
  serviceStyle: string = 'at_center',
  vendorRoleId?: string
): Promise<{ date: string; time: string; slot: string } | null> {
  try {
    const client = getDbClient();
    const schedulingRepo = getSchedulingRepository();
    const bookingsRepo = getBookingsRepository();
    
    // Get schedule settings
    const scheduleSettings = await getScheduleSettings();
    
    // Determine buffer time
    let bufferTimeMinutes = scheduleSettings.bufferTime[serviceStyle] || scheduleSettings.bufferTime.at_center;
    if (vendorRoleId && scheduleSettings.vendorBufferTime[vendorRoleId]?.[serviceStyle]) {
      bufferTimeMinutes = scheduleSettings.vendorBufferTime[vendorRoleId][serviceStyle];
    }
    
    // Check staff exists and is active
    const { data: staff } = await client
      .from('staff')
      .select('id, vendor_id, is_active')
      .eq('id', staffId)
      .single();
    
    if (!staff || !staff.is_active) return null;
    
    // Check staff location assignment
    const { data: locationAssignment } = await client
      .from('staff_location_assignments')
      .select('*')
      .eq('staff_id', staffId)
      .eq('location_id', locationId)
      .single();
    
    if (!locationAssignment) {
      console.log(`⚠️ Staff ${staffId} not assigned to location ${locationId}`);
      return null;
    }
    
    // Get staff availability for this location
    const now = new Date();
    const maxDaysAhead = scheduleSettings.maxDaysAhead || 30;
    const minBookableTime = new Date(now.getTime() + bufferTimeMinutes * 60 * 1000);
    
    for (let dayOffset = 0; dayOffset < maxDaysAhead; dayOffset++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + dayOffset);
      checkDate.setHours(0, 0, 0, 0);
      
      const dateString = checkDate.toISOString().split('T')[0];
      const dayOfWeek = checkDate.getDay();
      
      // Check if it's a holiday
      const { data: holiday } = await client
        .from('staff_holidays')
        .select('*')
        .eq('staff_id', staffId)
        .eq('holiday_date', dateString)
        .single();
      
      if (holiday) continue;
      
      // Get staff availability for this day and location
      const availability = await schedulingRepo.getStaffAvailability(staffId, locationId, dayOfWeek);
      
      if (availability.length === 0) continue;
      
      // Get existing bookings for this staff
      const existingBookings = await bookingsRepo.findByStaff(staffId, { date: dateString });
      const activeBookings = existingBookings.filter(b => 
        ['confirmed', 'scheduled', 'in_progress', 'start_otp_pending', 'end_otp_pending', 'traveling'].includes(b.status)
      );
      
      // Get staff breaks
      const breaks = await schedulingRepo.getStaffBreaks(staffId, dateString);
      
      // Check each availability window
      for (const avail of availability) {
        const [startHour, startMin] = avail.start_time.split(':').map(Number);
        const [endHour, endMin] = avail.end_time.split(':').map(Number);
        
        const slotInterval = scheduleSettings.slotInterval || 30;
        let currentMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        while (currentMinutes + serviceDuration <= endMinutes) {
          const slotHour = Math.floor(currentMinutes / 60);
          const slotMin = currentMinutes % 60;
          const timeString = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;
          
          // Check if slot is in the past or within buffer time
          const slotDateTime = new Date(checkDate);
          slotDateTime.setHours(slotHour, slotMin, 0, 0);
          
          if (slotDateTime <= minBookableTime) {
            currentMinutes += slotInterval;
            continue;
          }
          
          // Check conflicts with existing bookings
          const hasConflict = activeBookings.some(booking => {
            if (booking.booking_date !== dateString) return false;
            
            const [bookingHour, bookingMin] = booking.booking_time.split(':').map(Number);
            const bookingStart = bookingHour * 60 + bookingMin;
            const bookingEnd = bookingStart + (booking.duration_minutes || 30);
            
            const slotStart = currentMinutes;
            const slotEnd = currentMinutes + serviceDuration;
            
            return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
          });
          
          if (hasConflict) {
            currentMinutes += slotInterval;
            continue;
          }
          
          // Check conflicts with breaks
          const hasBreakConflict = breaks.some(breakItem => {
            const [breakStartHour, breakStartMin] = breakItem.start_time.split(':').map(Number);
            const [breakEndHour, breakEndMin] = breakItem.end_time.split(':').map(Number);
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
          
          // Check location conflicts (for multi-location staff)
          if (serviceStyle === 'at_home') {
            try {
              const hasLocationConflict = await schedulingRepo.checkStaffLocationConflict(
                staffId,
                locationId,
                dateString,
                timeString,
                serviceDuration,
                30 // travel time
              );
              
              if (hasLocationConflict) {
                currentMinutes += slotInterval;
                continue;
              }
            } catch (error) {
              // If conflict check fails, continue (don't block slot)
              console.warn('Location conflict check failed:', error);
            }
          }
          
          // Found available slot!
          return {
            date: dateString,
            time: timeString,
            slot: formatTimeSlot(timeString, serviceDuration)
          };
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
 * Get next available slot for a center/clinic (SQL)
 */
export async function getCenterNextAvailableSlot(
  centerId: string,
  serviceDuration: number = 30
): Promise<{ date: string; time: string; slot: string } | null> {
  try {
    const client = getDbClient();
    
    // Check vendor exists and is active
    const { data: vendor } = await client
      .from('vendors')
      .select('id, is_active')
      .eq('id', centerId)
      .single();
    
    if (!vendor || !vendor.is_active) return null;
    
    // Get center's staff
    const { data: staffList } = await client
      .from('staff')
      .select('id')
      .eq('vendor_id', centerId)
      .eq('is_active', true);
    
    if (!staffList || staffList.length === 0) return null;
    
    // Find the earliest available slot across all staff
    let earliestSlot: { date: string; time: string; slot: string } | null = null;
    
    for (const staff of staffList) {
      const slot = await getStaffNextAvailableSlot(staff.id, centerId, serviceDuration, 'at_center');
      
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
 * Get staff availability by location (SQL)
 */
export async function getStaffAvailabilityByLocation(staffId: string): Promise<any> {
  const client = getDbClient();
  const schedulingRepo = getSchedulingRepository();
  
  // Get staff location assignments
  const { data: assignments } = await client
    .from('staff_location_assignments')
    .select('location_id')
    .eq('staff_id', staffId);
  
  if (!assignments || assignments.length === 0) return {};
  
  const locationAvailability: any = {};
  
  for (const assignment of assignments) {
    // Get availability for each day of week for this location
    const availability: any[] = [];
    
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const dayAvailability = await schedulingRepo.getStaffAvailability(
        staffId,
        assignment.location_id,
        dayOfWeek
      );
      
      if (dayAvailability.length > 0) {
        availability.push({
          dayOfWeek,
          slots: dayAvailability.map(avail => ({
            start: avail.start_time,
            end: avail.end_time
          }))
        });
      }
    }
    
    if (availability.length > 0) {
      locationAvailability[assignment.location_id] = {
        locationId: assignment.location_id,
        availability
      };
    }
  }
  
  return locationAvailability;
}

