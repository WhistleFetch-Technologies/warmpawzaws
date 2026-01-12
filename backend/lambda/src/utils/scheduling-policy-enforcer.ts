/**
 * ============================================================================
 * SCHEDULING POLICY ENFORCER
 * ============================================================================
 * 
 * Utility functions for enforcing scheduling policies from Admin
 * - Policy retrieval
 * - Policy validation
 * - Past booking prevention
 * - Double booking prevention
 * - Capacity enforcement
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { query, select } from '../database/rds-connection';

/**
 * Get active scheduling policies
 */
export async function getSchedulingPolicies() {
  try {
    const policies = await select('scheduling_policies', { is_active: true });
    return policies;
  } catch (error: any) {
    console.warn('Failed to fetch scheduling policies, using defaults:', error.message);
    return [];
  }
}

/**
 * Get specific policy by type
 */
export async function getPolicyByType(policyType: string) {
  try {
    const policies = await select('scheduling_policies', { 
      policy_type: policyType,
      is_active: true 
    });
    return policies.length > 0 ? policies[0] : null;
  } catch (error: any) {
    console.warn(`Failed to fetch policy ${policyType}, using defaults:`, error.message);
    return null;
  }
}

/**
 * Validate schedule slot is not in the past
 */
export function validateScheduleSlotNotPast(dayOfWeek: number, timeWindowStart: string): { valid: boolean; error?: string } {
  const now = new Date();
  const today = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // If setting schedule for today, check if time is in the past
  if (dayOfWeek === today) {
    const [hours, minutes] = timeWindowStart.split(':').map(Number);
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);
    
    // Add 30 minutes buffer (can't set schedule for immediate past)
    const minTime = new Date(now.getTime() + 30 * 60 * 1000);
    
    if (slotTime < minTime) {
      return { 
        valid: false, 
        error: 'Cannot set schedule in the past. Time must be at least 30 minutes from now' 
      };
    }
  }
  
  // If setting for a day earlier in the week (e.g., setting Monday when it's Wednesday)
  // This would be a past day relative to current week, which is allowed for recurring schedules
  
  return { valid: true };
}

/**
 * Check for double booking (overlapping slots) for a vendor
 */
export async function checkDoubleBooking(
  vendorId: string,
  dayOfWeek: number,
  timeWindowStart: string,
  timeWindowEnd: string,
  serviceStyle: string,
  excludeSlotId?: string
): Promise<{ hasConflict: boolean; conflictingSlot?: any; error?: string }> {
  try {
    // Convert time strings to comparable format
    const startMinutes = timeToMinutes(timeWindowStart);
    const endMinutes = timeToMinutes(timeWindowEnd);
    
    // Get existing slots for this vendor, day, and service style
    const existingSlots = await query(
      `SELECT * FROM vendor_availability_v2
       WHERE vendor_id = $1
       AND day_of_week = $2
       AND service_style = $3
       AND is_enabled = true
       ${excludeSlotId ? 'AND id != $4' : ''}`,
      excludeSlotId ? [vendorId, dayOfWeek, serviceStyle, excludeSlotId] : [vendorId, dayOfWeek, serviceStyle]
    );
    
    // Check for overlapping time windows
    for (const slot of existingSlots.rows) {
      const slotStartMinutes = timeToMinutes(slot.time_window_start);
      const slotEndMinutes = timeToMinutes(slot.time_window_end);
      
      // Check if time windows overlap
      // Overlap occurs when: start1 < end2 AND end1 > start2
      if (startMinutes < slotEndMinutes && endMinutes > slotStartMinutes) {
        return {
          hasConflict: true,
          conflictingSlot: slot,
          error: `Time window overlaps with existing schedule (${slot.time_window_start} - ${slot.time_window_end})`
        };
      }
    }
    
    return { hasConflict: false };
  } catch (error: any) {
    console.error('Error checking double booking:', error);
    return {
      hasConflict: false, // Fail open - allow schedule if check fails
      error: error.message
    };
  }
}

/**
 * Check for double booking conflicts with existing bookings
 */
export async function checkBookingConflicts(
  vendorId: string,
  dayOfWeek: number,
  timeWindowStart: string,
  timeWindowEnd: string,
  staffId?: string
): Promise<{ hasConflict: boolean; conflictingBookings?: any[]; error?: string }> {
  try {
    // Get all dates that fall on this day of week in the next 90 days
    const today = new Date();
    const conflictDates: string[] = [];
    
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      if (date.getDay() === dayOfWeek) {
        conflictDates.push(date.toISOString().split('T')[0]);
      }
    }
    
    if (conflictDates.length === 0) {
      return { hasConflict: false };
    }
    
    // Check for bookings in these dates within the time window
    const startMinutes = timeToMinutes(timeWindowStart);
    const endMinutes = timeToMinutes(timeWindowEnd);
    
    const placeholders = conflictDates.map((_, i) => `$${i + 1}`).join(',');
    const params: any[] = [...conflictDates, vendorId];
    
    let bookingQuery = `
      SELECT booking_date, booking_time, status, staff_id
      FROM bookings
      WHERE booking_date = ANY(ARRAY[${placeholders}])
      AND vendor_id = $${conflictDates.length + 1}
      AND status NOT IN ('cancelled', 'no_show', 'completed')
    `;
    
    if (staffId) {
      params.push(staffId);
      bookingQuery += ` AND staff_id = $${params.length}`;
    }
    
    const bookings = await query(bookingQuery, params);
    
    const conflictingBookings: any[] = [];
    for (const booking of bookings.rows) {
      const bookingTimeMinutes = timeToMinutes(booking.booking_time);
      
      // Check if booking time falls within the schedule window
      if (bookingTimeMinutes >= startMinutes && bookingTimeMinutes < endMinutes) {
        conflictingBookings.push(booking);
      }
    }
    
    if (conflictingBookings.length > 0) {
      return {
        hasConflict: true,
        conflictingBookings,
        error: `Schedule window conflicts with ${conflictingBookings.length} existing booking(s)`
      };
    }
    
    return { hasConflict: false };
  } catch (error: any) {
    console.error('Error checking booking conflicts:', error);
    return {
      hasConflict: false, // Fail open
      error: error.message
    };
  }
}

/**
 * Enforce buffer time policy between slots
 */
export async function enforceBufferTimePolicy(
  vendorId: string,
  dayOfWeek: number,
  timeWindowStart: string,
  serviceStyle: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const bufferPolicy = await getPolicyByType('buffer_time');
    if (!bufferPolicy) {
      return { valid: true }; // No policy, allow
    }
    
    const config = bufferPolicy.policy_config || {};
    const bufferTimePerServiceType = config.bufferTimePerServiceType || {};
    const minBufferMinutes = bufferTimePerServiceType[serviceStyle] || config.minBufferTime || 15;
    
    // Get existing slots for this vendor, day, and service style
    const existingSlots = await query(
      `SELECT * FROM vendor_availability_v2
       WHERE vendor_id = $1
       AND day_of_week = $2
       AND service_style = $3
       AND is_enabled = true
       ORDER BY time_window_end DESC
       LIMIT 1`,
      [vendorId, dayOfWeek, serviceStyle]
    );
    
    if (existingSlots.rows.length > 0) {
      const lastSlot = existingSlots.rows[0];
      const lastSlotEndMinutes = timeToMinutes(lastSlot.time_window_end);
      const newSlotStartMinutes = timeToMinutes(timeWindowStart);
      
      const gapMinutes = newSlotStartMinutes - lastSlotEndMinutes;
      
      if (gapMinutes < minBufferMinutes) {
        return {
          valid: false,
          error: `Minimum buffer time of ${minBufferMinutes} minutes required between slots. Gap is ${gapMinutes} minutes.`
        };
      }
    }
    
    return { valid: true };
  } catch (error: any) {
    console.warn('Error enforcing buffer time policy:', error);
    return { valid: true }; // Fail open
  }
}

/**
 * Enforce capacity policy
 */
export async function enforceCapacityPolicy(
  vendorId: string,
  maxCapacity: number
): Promise<{ valid: boolean; error?: string }> {
  try {
    const capacityPolicy = await getPolicyByType('booking_capacity');
    if (!capacityPolicy) {
      return { valid: true }; // No policy, allow
    }
    
    const config = capacityPolicy.policy_config || {};
    const maxCapacityPerSlot = config.maxConcurrentBookingsPerVendor || 10;
    
    if (maxCapacity > maxCapacityPerSlot) {
      return {
        valid: false,
        error: `Maximum capacity per slot cannot exceed ${maxCapacityPerSlot} (policy limit)`
      };
    }
    
    return { valid: true };
  } catch (error: any) {
    console.warn('Error enforcing capacity policy:', error);
    return { valid: true }; // Fail open
  }
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Validate schedule slot against all policies
 */
export async function validateScheduleSlot(
  vendorId: string,
  dayOfWeek: number,
  timeWindowStart: string,
  timeWindowEnd: string,
  serviceStyle: string,
  maxCapacity: number,
  excludeSlotId?: string
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  // 1. Check if slot is in the past
  const pastValidation = validateScheduleSlotNotPast(dayOfWeek, timeWindowStart);
  if (!pastValidation.valid && pastValidation.error) {
    errors.push(pastValidation.error);
  }
  
  // 2. Check for double booking (overlapping slots)
  const doubleBookingCheck = await checkDoubleBooking(
    vendorId,
    dayOfWeek,
    timeWindowStart,
    timeWindowEnd,
    serviceStyle,
    excludeSlotId
  );
  if (doubleBookingCheck.hasConflict && doubleBookingCheck.error) {
    errors.push(doubleBookingCheck.error);
  }
  
  // 3. Check for conflicts with existing bookings
  const bookingConflictCheck = await checkBookingConflicts(
    vendorId,
    dayOfWeek,
    timeWindowStart,
    timeWindowEnd
  );
  if (bookingConflictCheck.hasConflict && bookingConflictCheck.error) {
    errors.push(bookingConflictCheck.error);
  }
  
  // 4. Enforce buffer time policy
  const bufferValidation = await enforceBufferTimePolicy(
    vendorId,
    dayOfWeek,
    timeWindowStart,
    serviceStyle
  );
  if (!bufferValidation.valid && bufferValidation.error) {
    errors.push(bufferValidation.error);
  }
  
  // 5. Enforce capacity policy
  const capacityValidation = await enforceCapacityPolicy(vendorId, maxCapacity);
  if (!capacityValidation.valid && capacityValidation.error) {
    errors.push(capacityValidation.error);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
