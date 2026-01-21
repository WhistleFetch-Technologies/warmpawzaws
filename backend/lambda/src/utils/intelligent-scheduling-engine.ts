/**
 * ============================================================================
 * INTELLIGENT SCHEDULING ENGINE
 * ============================================================================
 * 
 * Advanced scheduling engine that:
 * - Calculates available slots considering travel time for home services
 * - Enforces buffer times between appointments
 * - Respects breaks and holidays
 * - Considers service duration
 * - Supports multi-service style slots
 * - Integrates with admin scheduling policies
 * 
 * Date: 2026-01-19
 * ============================================================================
 */

import { query, select } from '../database/rds-connection';
import { getSchedulingPolicies, getPolicyByType } from './scheduling-policy-enforcer';

// Types
interface TimeSlot {
  time: string;
  endTime: string;
  available: boolean;
  serviceStyles: string[];
  capacity: number;
  bookedCount: number;
  reason?: string;
}

interface ScheduleWindow {
  startTime: string;
  endTime: string;
  serviceStyle: string;
  slotDuration: number;
  bufferTime: number;
  maxCapacity: number;
  serviceRadius?: number;
}

interface Break {
  startTime: string;
  endTime: string;
}

interface Booking {
  bookingTime: string;
  duration: number;
  serviceStyle: string;
  status: string;
  staffId?: string;
  customerLocation?: { lat: number; lng: number };
}

interface CalculatedSlot {
  time: string;
  endTime: string;
  available: boolean;
  serviceStyles: string[];
  remainingCapacity: number;
  travelTimeMinutes?: number;
  estimatedArrival?: string;
  reason?: string;
}

interface SchedulingRequest {
  vendorId: string;
  staffId?: string;
  date: string;
  serviceStyle?: string;
  serviceDuration?: number;
  customerLocation?: { lat: number; lng: number };
  includeTravel?: boolean;
}

/**
 * Calculate available slots for a vendor/staff on a given date
 */
export async function calculateAvailableSlots(request: SchedulingRequest): Promise<CalculatedSlot[]> {
  const { vendorId, staffId, date, serviceStyle, serviceDuration, customerLocation, includeTravel } = request;
  
  const requestDate = new Date(date);
  const dayOfWeek = requestDate.getDay();
  
  // Get scheduling policies
  const policies = await getSchedulingPolicies();
  const bufferPolicy = policies.find((p: any) => p.policy_type === 'buffer_time');
  const commutePolicy = policies.find((p: any) => p.policy_type === 'commute_time');
  
  // Get schedule windows for this day
  const scheduleWindows = await getScheduleWindows(vendorId, staffId, dayOfWeek, serviceStyle);
  
  if (scheduleWindows.length === 0) {
    return [];
  }
  
  // Check for holiday
  const isHoliday = await checkHoliday(vendorId, staffId, date);
  if (isHoliday) {
    return [];
  }
  
  // Get breaks for this day
  const breaks = await getBreaks(vendorId, staffId, dayOfWeek, date);
  
  // Get existing bookings for this date
  const existingBookings = await getExistingBookings(vendorId, staffId, date);
  
  // Get vendor's current location for home services
  let vendorLocation: { lat: number; lng: number } | null = null;
  if (serviceStyle === 'at_home' && includeTravel) {
    vendorLocation = await getVendorLocation(vendorId, staffId);
  }
  
  // Generate all possible slots
  const allSlots: CalculatedSlot[] = [];
  
  for (const window of scheduleWindows) {
    const windowSlots = generateSlotsForWindow(
      window,
      breaks,
      existingBookings,
      serviceDuration || window.slotDuration,
      bufferPolicy?.policy_config,
      vendorLocation,
      customerLocation,
      commutePolicy?.policy_config
    );
    
    allSlots.push(...windowSlots);
  }
  
  // Sort by time
  allSlots.sort((a, b) => a.time.localeCompare(b.time));
  
  // Remove duplicates (same time, different windows)
  const uniqueSlots = deduplicateSlots(allSlots);
  
  return uniqueSlots;
}

/**
 * Get schedule windows for a vendor/staff on a specific day
 */
async function getScheduleWindows(
  vendorId: string,
  staffId: string | undefined,
  dayOfWeek: number,
  serviceStyle?: string
): Promise<ScheduleWindow[]> {
  try {
    let queryStr: string;
    let params: any[];
    
    if (staffId) {
      queryStr = `
        SELECT 
          start_time as time_window_start,
          end_time as time_window_end,
          service_style,
          slot_duration_minutes,
          buffer_time_minutes,
          max_capacity,
          radius_km as service_area_km
        FROM staff_schedules
        WHERE staff_id = $1
        AND day_of_week = $2
        AND is_available = true
        ${serviceStyle ? 'AND service_style = $3' : ''}
        ORDER BY start_time
      `;
      params = serviceStyle ? [staffId, dayOfWeek, serviceStyle] : [staffId, dayOfWeek];
    } else {
      queryStr = `
        SELECT 
          time_window_start,
          time_window_end,
          service_style,
          slot_duration_minutes,
          COALESCE(buffer_time_minutes, 15) as buffer_time_minutes,
          max_capacity,
          service_area_km
        FROM vendor_availability_v2
        WHERE vendor_id = $1
        AND day_of_week = $2
        AND is_enabled = true
        ${serviceStyle ? 'AND service_style = $3' : ''}
        ORDER BY time_window_start
      `;
      params = serviceStyle ? [vendorId, dayOfWeek, serviceStyle] : [vendorId, dayOfWeek];
    }
    
    const result = await query(queryStr, params);
    
    return result.rows.map((row: any) => ({
      startTime: row.time_window_start,
      endTime: row.time_window_end,
      serviceStyle: row.service_style || 'at_center',
      slotDuration: row.slot_duration_minutes || 30,
      bufferTime: row.buffer_time_minutes || 15,
      maxCapacity: row.max_capacity || 1,
      serviceRadius: row.service_area_km
    }));
  } catch (error) {
    console.error('Error getting schedule windows:', error);
    return [];
  }
}

/**
 * Check if date is a holiday
 */
async function checkHoliday(vendorId: string, staffId: string | undefined, date: string): Promise<boolean> {
  try {
    if (staffId) {
      const result = await query(
        `SELECT COUNT(*) as count FROM staff_holidays WHERE staff_id = $1 AND holiday_date = $2`,
        [staffId, date]
      );
      return Number(result.rows[0]?.count) > 0;
    } else {
      // Check vendor vacation mode
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length > 0 && vendors[0].metadata?.vacation_mode?.isActive) {
        const vacationStart = new Date(vendors[0].metadata.vacation_mode.startDate);
        const vacationEnd = new Date(vendors[0].metadata.vacation_mode.endDate);
        const checkDate = new Date(date);
        return checkDate >= vacationStart && checkDate <= vacationEnd;
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking holiday:', error);
    return false;
  }
}

/**
 * Get breaks for a specific day
 */
async function getBreaks(
  vendorId: string,
  staffId: string | undefined,
  dayOfWeek: number,
  date: string
): Promise<Break[]> {
  try {
    if (staffId) {
      const result = await query(
        `SELECT start_time, end_time 
         FROM staff_breaks 
         WHERE staff_id = $1 
         AND (day_of_week = $2 OR break_date = $3)`,
        [staffId, dayOfWeek, date]
      );
      return result.rows.map((row: any) => ({
        startTime: row.start_time,
        endTime: row.end_time
      }));
    }
    return [];
  } catch (error) {
    console.error('Error getting breaks:', error);
    return [];
  }
}

/**
 * Get existing bookings for a date
 */
async function getExistingBookings(
  vendorId: string,
  staffId: string | undefined,
  date: string
): Promise<Booking[]> {
  try {
    let queryStr = `
      SELECT 
        booking_time,
        duration_minutes as duration,
        service_type as service_style,
        status,
        staff_id,
        customer_location
      FROM bookings
      WHERE vendor_id = $1
      AND booking_date = $2
      AND status NOT IN ('cancelled', 'no_show', 'completed')
    `;
    const params: any[] = [vendorId, date];
    
    if (staffId) {
      queryStr += ` AND staff_id = $3`;
      params.push(staffId);
    }
    
    const result = await query(queryStr, params);
    
    return result.rows.map((row: any) => ({
      bookingTime: row.booking_time,
      duration: row.duration || 30,
      serviceStyle: row.service_style || 'at_center',
      status: row.status,
      staffId: row.staff_id,
      customerLocation: row.customer_location
    }));
  } catch (error) {
    console.error('Error getting existing bookings:', error);
    return [];
  }
}

/**
 * Get vendor/staff current location
 */
async function getVendorLocation(
  vendorId: string,
  staffId?: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    if (staffId) {
      const result = await query(
        `SELECT latitude, longitude FROM staff_real_time_locations 
         WHERE staff_id = $1 
         ORDER BY recorded_at DESC LIMIT 1`,
        [staffId]
      );
      if (result.rows.length > 0) {
        return { lat: result.rows[0].latitude, lng: result.rows[0].longitude };
      }
    }
    
    // Fall back to vendor's registered location
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length > 0 && vendors[0].latitude && vendors[0].longitude) {
      return { lat: vendors[0].latitude, lng: vendors[0].longitude };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting vendor location:', error);
    return null;
  }
}

/**
 * Generate slots for a time window
 */
function generateSlotsForWindow(
  window: ScheduleWindow,
  breaks: Break[],
  existingBookings: Booking[],
  serviceDuration: number,
  bufferConfig: any,
  vendorLocation: { lat: number; lng: number } | null,
  customerLocation: { lat: number; lng: number } | undefined,
  commuteConfig: any
): CalculatedSlot[] {
  const slots: CalculatedSlot[] = [];
  
  const [startHour, startMin] = window.startTime.split(':').map(Number);
  const [endHour, endMin] = window.endTime.split(':').map(Number);
  
  const windowStartMinutes = startHour * 60 + startMin;
  const windowEndMinutes = endHour * 60 + endMin;
  
  const slotDuration = serviceDuration || window.slotDuration;
  const bufferTime = getBufferTimeForStyle(window.serviceStyle, bufferConfig, window.bufferTime);
  
  // Calculate travel time if needed
  let travelTimeMinutes = 0;
  if (window.serviceStyle === 'at_home' && vendorLocation && customerLocation) {
    travelTimeMinutes = calculateTravelTime(vendorLocation, customerLocation, commuteConfig);
  }
  
  let currentMinutes = windowStartMinutes;
  
  while (currentMinutes + slotDuration <= windowEndMinutes) {
    const slotTime = minutesToTimeString(currentMinutes);
    const slotEndTime = minutesToTimeString(currentMinutes + slotDuration);
    
    // Check if slot is during a break
    const isDuringBreak = breaks.some(brk => {
      const breakStart = timeToMinutes(brk.startTime);
      const breakEnd = timeToMinutes(brk.endTime);
      return currentMinutes < breakEnd && currentMinutes + slotDuration > breakStart;
    });
    
    if (isDuringBreak) {
      // Skip to after the break
      const overlappingBreak = breaks.find(brk => {
        const breakStart = timeToMinutes(brk.startTime);
        const breakEnd = timeToMinutes(brk.endTime);
        return currentMinutes < breakEnd && currentMinutes + slotDuration > breakStart;
      });
      if (overlappingBreak) {
        currentMinutes = timeToMinutes(overlappingBreak.endTime);
        continue;
      }
    }
    
    // Count existing bookings at this time
    const overlappingBookings = existingBookings.filter(booking => {
      const bookingStart = timeToMinutes(booking.bookingTime);
      const bookingEnd = bookingStart + booking.duration + bufferTime;
      return currentMinutes < bookingEnd && currentMinutes + slotDuration + bufferTime > bookingStart;
    });
    
    const bookedCount = overlappingBookings.length;
    const remainingCapacity = window.maxCapacity - bookedCount;
    const available = remainingCapacity > 0;
    
    let reason: string | undefined;
    if (!available) {
      reason = 'Fully booked';
    }
    
    slots.push({
      time: slotTime,
      endTime: slotEndTime,
      available,
      serviceStyles: [window.serviceStyle],
      remainingCapacity: Math.max(0, remainingCapacity),
      travelTimeMinutes: window.serviceStyle === 'at_home' ? travelTimeMinutes : undefined,
      reason
    });
    
    // Move to next slot (with buffer time between)
    currentMinutes += slotDuration + bufferTime;
  }
  
  return slots;
}

/**
 * Get buffer time for a service style
 */
function getBufferTimeForStyle(serviceStyle: string, bufferConfig: any, defaultBuffer: number): number {
  if (bufferConfig?.bufferTimePerServiceType?.[serviceStyle]) {
    return bufferConfig.bufferTimePerServiceType[serviceStyle];
  }
  return defaultBuffer;
}

/**
 * Calculate travel time between two locations
 */
function calculateTravelTime(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  commuteConfig: any
): number {
  // Calculate distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  
  // Calculate travel time (default: 3 min per km, ~20 km/h average)
  const minutesPerKm = commuteConfig?.commuteAllowance || 3;
  let travelTime = Math.ceil(distanceKm * minutesPerKm);
  
  // Apply traffic factor if enabled
  if (commuteConfig?.trafficMultiplier) {
    travelTime = Math.ceil(travelTime * commuteConfig.trafficMultiplier);
  }
  
  // Cap at max commute time
  const maxCommuteTime = commuteConfig?.maxCommuteTime || 120;
  return Math.min(travelTime, maxCommuteTime);
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Deduplicate slots with same time
 */
function deduplicateSlots(slots: CalculatedSlot[]): CalculatedSlot[] {
  const slotMap = new Map<string, CalculatedSlot>();
  
  for (const slot of slots) {
    const existing = slotMap.get(slot.time);
    if (existing) {
      // Merge service styles (deduplicate using filter)
      const combined = [...existing.serviceStyles, ...slot.serviceStyles];
      existing.serviceStyles = combined.filter((style, index) => combined.indexOf(style) === index);
      // Take the most restrictive availability
      existing.available = existing.available && slot.available;
      existing.remainingCapacity = Math.min(existing.remainingCapacity, slot.remainingCapacity);
    } else {
      slotMap.set(slot.time, { ...slot });
    }
  }
  
  return Array.from(slotMap.values());
}

// Utility functions
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Get next available slot for a vendor
 */
export async function getNextAvailableSlot(
  vendorId: string,
  staffId?: string,
  serviceStyle?: string,
  serviceDuration?: number
): Promise<{ date: string; time: string; endTime: string } | null> {
  const today = new Date();
  
  // Check the next 30 days
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    const dateStr = checkDate.toISOString().split('T')[0];
    
    const slots = await calculateAvailableSlots({
      vendorId,
      staffId,
      date: dateStr,
      serviceStyle,
      serviceDuration
    });
    
    const availableSlot = slots.find(s => s.available);
    if (availableSlot) {
      return {
        date: dateStr,
        time: availableSlot.time,
        endTime: availableSlot.endTime
      };
    }
  }
  
  return null;
}

/**
 * Check if a specific slot is available
 */
export async function checkSlotAvailability(
  vendorId: string,
  staffId: string | undefined,
  date: string,
  time: string,
  serviceStyle: string,
  serviceDuration: number
): Promise<{ available: boolean; reason?: string }> {
  const slots = await calculateAvailableSlots({
    vendorId,
    staffId,
    date,
    serviceStyle,
    serviceDuration
  });
  
  const slot = slots.find(s => s.time === time);
  
  if (!slot) {
    return { available: false, reason: 'Slot not found in schedule' };
  }
  
  if (!slot.available) {
    return { available: false, reason: slot.reason || 'Slot not available' };
  }
  
  return { available: true };
}

/**
 * Calculate estimated arrival time for home service
 */
export async function calculateEstimatedArrival(
  vendorId: string,
  staffId: string | undefined,
  customerLocation: { lat: number; lng: number },
  scheduledTime: string
): Promise<{ arrivalTime: string; travelMinutes: number; distanceKm: number }> {
  const vendorLocation = await getVendorLocation(vendorId, staffId);
  
  if (!vendorLocation) {
    // If no location, assume vendor is at customer location (for tele/center services)
    return {
      arrivalTime: scheduledTime,
      travelMinutes: 0,
      distanceKm: 0
    };
  }
  
  const commutePolicy = await getPolicyByType('commute_time');
  const commuteConfig = commutePolicy?.policy_config || {};
  
  const travelMinutes = calculateTravelTime(vendorLocation, customerLocation, commuteConfig);
  
  // Calculate distance
  const R = 6371;
  const dLat = toRadians(customerLocation.lat - vendorLocation.lat);
  const dLng = toRadians(customerLocation.lng - vendorLocation.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(vendorLocation.lat)) * Math.cos(toRadians(customerLocation.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c * 10) / 10;
  
  // Calculate arrival time
  const [hours, mins] = scheduledTime.split(':').map(Number);
  const arrivalMinutes = hours * 60 + mins + travelMinutes;
  const arrivalTime = minutesToTimeString(arrivalMinutes);
  
  return {
    arrivalTime,
    travelMinutes,
    distanceKm
  };
}
