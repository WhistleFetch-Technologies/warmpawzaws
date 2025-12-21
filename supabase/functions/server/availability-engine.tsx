/**
 * ========================================
 * AVAILABILITY ENGINE
 * ========================================
 * 
 * Advanced availability calculation and slot management
 * for doctors and service providers.
 * 
 * Features:
 * - Calculate next available slot (7-day horizon)
 * - Generate availability calendar
 * - Handle breaks and buffer time
 * - Handle holidays and leaves
 * - Slot utilization analytics
 * 
 * Created: November 20, 2025
 * Part of: Practo Parity Implementation - Task 1.4
 */

import * as kv from './kv_store.tsx';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface TimeSlot {
  start: string;     // "09:00"
  end: string;       // "09:30"
  status: 'available' | 'booked' | 'blocked' | 'break';
  bookingId?: string;
  petName?: string;
  customerName?: string;
}

export interface DayAvailability {
  date: string;      // "2025-11-20"
  dayName: string;   // "Monday"
  isHoliday: boolean;
  holidayReason?: string;
  slots: TimeSlot[];
  breaks: Break[];
  availableCount: number;
  bookedCount: number;
  totalCount: number;
  utilizationPercent: number;
}

export interface Break {
  id: string;
  start: string;     // "13:00"
  end: string;       // "14:00"
  type: 'lunch' | 'tea' | 'personal' | 'emergency';
  label: string;
  isRecurring: boolean;
  recurringDay?: number; // 0-6 for Sunday-Saturday
}

export interface Holiday {
  date: string;
  type: 'full_day' | 'half_day';
  reason: string;
  isRecurring: boolean;
  recurringDay?: number;
}

export interface NextAvailableSlot {
  date: string;
  dayName: string;
  time: string;
  slot: TimeSlot;
  isToday: boolean;
  isTomorrow: boolean;
  daysFromNow: number;
  formattedDisplay: string; // "Today 3:00 PM", "Tomorrow 10:00 AM", "Friday 2:00 PM"
}

export interface AvailabilityPreferences {
  slotDuration: number;      // minutes (default: 30)
  bufferMinutes: number;     // minutes between appointments (default: 5)
  advanceBookingDays: number; // how far in advance to allow bookings (default: 30)
  sameDayBookingCutoff: string; // "HH:mm" - cutoff time for same-day bookings
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get day name from date
 */
function getDayName(dateString: string): string {
  const date = new Date(dateString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Get day number (0-6) from date
 */
function getDayNumber(dateString: string): number {
  const date = new Date(dateString);
  return date.getDay();
}

/**
 * Convert 24h time to 12h format
 */
function format12Hour(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Calculate days from now
 */
function daysFromNow(dateString: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetDate = new Date(dateString);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Format date for display
 */
function formatDateDisplay(dateString: string): string {
  const days = daysFromNow(dateString);
  const dayName = getDayName(dateString);
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 6) return dayName;
  
  // For dates beyond a week, show date
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/**
 * Compare times (HH:mm format)
 */
function isTimeAfter(time1: string, time2: string): boolean {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  
  if (h1 > h2) return true;
  if (h1 === h2 && m1 > m2) return true;
  return false;
}

/**
 * Check if time is in the past today
 */
function isTimePastToday(timeString: string): boolean {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
  return isTimeAfter(currentTime, timeString);
}

// ============================================
// CORE AVAILABILITY FUNCTIONS
// ============================================

/**
 * Get next available slot for a doctor
 * Checks next 7 days by default
 */
export async function getNextAvailableSlot(
  doctorId: string,
  daysToCheck: number = 7
): Promise<NextAvailableSlot | null> {
  try {
    console.log(`\n🔍 [AVAILABILITY] Finding next available slot for doctor ${doctorId}`);
    console.log(`📅 Checking next ${daysToCheck} days`);
    
    const today = new Date();
    
    for (let dayOffset = 0; dayOffset < daysToCheck; dayOffset++) {
      const checkDate = new Date(today.getTime() + dayOffset * 86400000);
      const dateString = checkDate.toISOString().split('T')[0];
      
      console.log(`📆 Checking ${dateString} (${getDayName(dateString)})...`);
      
      // Check if it's a holiday
      const isHoliday = await isDateHoliday(doctorId, dateString);
      if (isHoliday) {
        console.log(`  ⛔ ${dateString} is a holiday, skipping`);
        continue;
      }
      
      // Get availability for this day
      const dayAvailability = await kv.get(`doctor:${doctorId}:availability:${dateString}`);
      
      if (!dayAvailability || !dayAvailability.slots) {
        console.log(`  ⚠️ No availability data for ${dateString}`);
        continue;
      }
      
      // Find first available slot
      for (const slot of dayAvailability.slots) {
        // Skip if not available
        if (slot.status !== 'available') continue;
        
        // If checking today, skip slots that are in the past
        if (dayOffset === 0 && isTimePastToday(slot.start)) {
          console.log(`  ⏰ Slot ${slot.start} is in the past, skipping`);
          continue;
        }
        
        // Found an available slot!
        const days = daysFromNow(dateString);
        const formattedDisplay = `${formatDateDisplay(dateString)} ${format12Hour(slot.start)}`;
        
        console.log(`  ✅ Found available slot: ${formattedDisplay}`);
        
        return {
          date: dateString,
          dayName: getDayName(dateString),
          time: slot.start,
          slot,
          isToday: days === 0,
          isTomorrow: days === 1,
          daysFromNow: days,
          formattedDisplay
        };
      }
      
      console.log(`  ❌ No available slots on ${dateString}`);
    }
    
    console.log(`❌ [AVAILABILITY] No available slots found in next ${daysToCheck} days`);
    return null;
    
  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error finding next available slot:`, error);
    return null;
  }
}

/**
 * Get availability calendar for next N days
 */
export async function getAvailabilityCalendar(
  doctorId: string,
  days: number = 7
): Promise<DayAvailability[]> {
  try {
    console.log(`\n📅 [AVAILABILITY] Generating ${days}-day calendar for doctor ${doctorId}`);
    
    const calendar: DayAvailability[] = [];
    const today = new Date();
    
    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const checkDate = new Date(today.getTime() + dayOffset * 86400000);
      const dateString = checkDate.toISOString().split('T')[0];
      const dayName = getDayName(dateString);
      
      // Check if holiday
      const holiday = await getHolidayForDate(doctorId, dateString);
      const isHoliday = holiday !== null;
      
      // Get availability
      const dayAvailability = await kv.get(`doctor:${doctorId}:availability:${dateString}`);
      const slots = dayAvailability?.slots || [];
      const breaks = dayAvailability?.breaks || [];
      
      // Calculate metrics
      const availableCount = slots.filter((s: TimeSlot) => s.status === 'available').length;
      const bookedCount = slots.filter((s: TimeSlot) => s.status === 'booked').length;
      const totalCount = slots.length;
      const utilizationPercent = totalCount > 0 
        ? Math.round((bookedCount / totalCount) * 100) 
        : 0;
      
      calendar.push({
        date: dateString,
        dayName,
        isHoliday,
        holidayReason: holiday?.reason,
        slots,
        breaks,
        availableCount,
        bookedCount,
        totalCount,
        utilizationPercent
      });
    }
    
    console.log(`✅ [AVAILABILITY] Calendar generated: ${calendar.length} days`);
    return calendar;
    
  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error generating calendar:`, error);
    return [];
  }
}

/**
 * Check if a date is a holiday for a doctor
 */
async function isDateHoliday(doctorId: string, dateString: string): Promise<boolean> {
  const holiday = await getHolidayForDate(doctorId, dateString);
  return holiday !== null;
}

/**
 * Get holiday for a specific date
 */
async function getHolidayForDate(doctorId: string, dateString: string): Promise<Holiday | null> {
  try {
    const holidays = await kv.get(`doctor:${doctorId}:holidays`) || [];
    const dayNumber = getDayNumber(dateString);
    
    // Check for exact date match
    const exactMatch = holidays.find((h: Holiday) => h.date === dateString);
    if (exactMatch) return exactMatch;
    
    // Check for recurring holiday (e.g., every Sunday)
    const recurringMatch = holidays.find((h: Holiday) => 
      h.isRecurring && h.recurringDay === dayNumber
    );
    if (recurringMatch) return recurringMatch;
    
    return null;
  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error checking holiday:`, error);
    return null;
  }
}

/**
 * Get doctor's availability preferences
 */
export async function getAvailabilityPreferences(
  doctorId: string
): Promise<AvailabilityPreferences> {
  try {
    const prefs = await kv.get(`doctor:${doctorId}:preferences`);
    
    // Return defaults if no preferences set
    return {
      slotDuration: prefs?.slotDuration || 30,
      bufferMinutes: prefs?.bufferMinutes || 5,
      advanceBookingDays: prefs?.advanceBookingDays || 30,
      sameDayBookingCutoff: prefs?.sameDayBookingCutoff || '18:00'
    };
  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error getting preferences:`, error);
    // Return defaults
    return {
      slotDuration: 30,
      bufferMinutes: 5,
      advanceBookingDays: 30,
      sameDayBookingCutoff: '18:00'
    };
  }
}

/**
 * Get all breaks for a doctor
 */
export async function getDoctorBreaks(doctorId: string): Promise<Break[]> {
  try {
    const breaks = await kv.get(`doctor:${doctorId}:breaks`) || [];
    return breaks;
  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error getting breaks:`, error);
    return [];
  }
}

/**
 * Get breaks for a specific date (including recurring breaks)
 */
export async function getBreaksForDate(doctorId: string, dateString: string): Promise<Break[]> {
  try {
    const allBreaks = await getDoctorBreaks(doctorId);
    const dayNumber = getDayNumber(dateString);
    
    // Filter for this date
    const dateBreaks = allBreaks.filter((b: Break) => {
      // Recurring daily breaks
      if (b.isRecurring && b.recurringDay === undefined) return true;
      
      // Recurring weekly breaks (e.g., every Monday)
      if (b.isRecurring && b.recurringDay === dayNumber) return true;
      
      // One-time breaks (would need a date field)
      // For now, assume all breaks are recurring
      return false;
    });
    
    return dateBreaks;
  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error getting breaks for date:`, error);
    return [];
  }
}

/**
 * Calculate slot utilization for a doctor
 */
export async function calculateSlotUtilization(
  doctorId: string,
  startDate: string,
  endDate: string
): Promise<{
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
  utilization: number;
}> {
  try {
    let totalSlots = 0;
    let bookedSlots = 0;
    let availableSlots = 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateString = d.toISOString().split('T')[0];
      const dayAvailability = await kv.get(`doctor:${doctorId}:availability:${dateString}`);
      
      if (dayAvailability?.slots) {
        totalSlots += dayAvailability.slots.length;
        bookedSlots += dayAvailability.slots.filter((s: TimeSlot) => s.status === 'booked').length;
        availableSlots += dayAvailability.slots.filter((s: TimeSlot) => s.status === 'available').length;
      }
    }
    
    const utilization = totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0;
    
    return {
      totalSlots,
      bookedSlots,
      availableSlots,
      utilization
    };
  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error calculating utilization:`, error);
    return {
      totalSlots: 0,
      bookedSlots: 0,
      availableSlots: 0,
      utilization: 0
    };
  }
}

/**
 * Check if same-day booking is allowed
 */
export async function isSameDayBookingAllowed(
  doctorId: string,
  slotTime: string
): Promise<boolean> {
  try {
    const prefs = await getAvailabilityPreferences(doctorId);
    const cutoffTime = prefs.sameDayBookingCutoff;
    
    // Check if slot time is before cutoff
    return !isTimeAfter(slotTime, cutoffTime);
  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error checking same-day booking:`, error);
    return true; // Allow by default
  }
}

/**
 * Get availability summary for display
 */
export async function getAvailabilitySummary(doctorId: string): Promise<{
  nextAvailable: NextAvailableSlot | null;
  availableToday: boolean;
  availableTomorrow: boolean;
  availableThisWeek: boolean;
  totalSlotsThisWeek: number;
  availableSlotsThisWeek: number;
}> {
  try {
    const nextAvailable = await getNextAvailableSlot(doctorId, 7);
    const calendar = await getAvailabilityCalendar(doctorId, 7);
    
    const today = calendar[0];
    const tomorrow = calendar[1];
    
    const totalSlotsThisWeek = calendar.reduce((sum, day) => sum + day.totalCount, 0);
    const availableSlotsThisWeek = calendar.reduce((sum, day) => sum + day.availableCount, 0);
    
    return {
      nextAvailable,
      availableToday: (today?.availableCount || 0) > 0,
      availableTomorrow: (tomorrow?.availableCount || 0) > 0,
      availableThisWeek: availableSlotsThisWeek > 0,
      totalSlotsThisWeek,
      availableSlotsThisWeek
    };
  } catch (error) {
    console.error(`❌ [AVAILABILITY] Error getting summary:`, error);
    return {
      nextAvailable: null,
      availableToday: false,
      availableTomorrow: false,
      availableThisWeek: false,
      totalSlotsThisWeek: 0,
      availableSlotsThisWeek: 0
    };
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  getNextAvailableSlot,
  getAvailabilityCalendar,
  getAvailabilityPreferences,
  getDoctorBreaks,
  getBreaksForDate,
  calculateSlotUtilization,
  isSameDayBookingAllowed,
  getAvailabilitySummary
};
