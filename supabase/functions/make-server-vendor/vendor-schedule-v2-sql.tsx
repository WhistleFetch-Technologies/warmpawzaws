/**
 * ============================================================================
 * VENDOR SCHEDULE MANAGEMENT V2 - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - Uses `vendor_availability_v2` table for availability
 * - Uses `bookings` table for booking checks
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL
 * KV Operations Removed: 11
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getSchedulingRepository } from '../../lib/repositories/scheduling.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();

// Data structures
interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isEnabled: boolean;
}

interface ServiceSlotConfig {
  serviceStyle: string;
  slotDuration: number;
  serviceArea?: number;
}

interface DayAvailability {
  dayOfWeek: string;
  timeWindows: TimeSlot[];
  serviceConfigs: ServiceSlotConfig[];
}

// Helper: Convert day name to number (0=Sunday, 1=Monday, etc.)
function dayNameToNumber(dayName: string): number {
  const days: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  return days[dayName.toLowerCase()] ?? 0;
}

// Helper: Convert day number to name
function dayNumberToName(dayNum: number): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayNum] || 'sunday';
}

// GET vendor availability V2
app.get("/vendor/availability-v2/:vendorId", async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    console.log(`\n🔍 Fetching V2 availability for vendor: ${vendorId} (SQL)`);
    
    // ✅ SQL: Get vendor availability from vendor_availability_v2 table
    const schedulingRepo = getSchedulingRepository();
    const availability: DayAvailability[] = [];
    const serviceStylesSet = new Set<string>();
    
    // Get availability for all days
    for (let dayNum = 0; dayNum < 7; dayNum++) {
      const dayAvail = await schedulingRepo.getVendorAvailability(vendorId, dayNum);
      
      if (dayAvail.length > 0) {
        const dayName = dayNumberToName(dayNum);
        const timeWindows: TimeSlot[] = [];
        const serviceConfigsMap = new Map<string, ServiceSlotConfig>();
        
        for (const avail of dayAvail) {
          // Add time window
          timeWindows.push({
            id: avail.id,
            startTime: avail.time_window_start,
            endTime: avail.time_window_end,
            isEnabled: avail.is_enabled
          });
          
          // Add service config
          if (!serviceConfigsMap.has(avail.service_style)) {
            serviceConfigsMap.set(avail.service_style, {
              serviceStyle: avail.service_style,
              slotDuration: avail.slot_duration_minutes,
              serviceArea: avail.service_area_km ? parseFloat(avail.service_area_km.toString()) : undefined
            });
            serviceStylesSet.add(avail.service_style);
          }
        }
        
        if (timeWindows.length > 0) {
          availability.push({
            dayOfWeek: dayName,
            timeWindows,
            serviceConfigs: Array.from(serviceConfigsMap.values())
          });
        }
      }
    }
    
    const serviceStyles = Array.from(serviceStylesSet);
    
    console.log(`✅ Found ${availability.length} day configurations`);
    console.log(`✅ Vendor offers service styles:`, serviceStyles);
    
    return c.json({
      success: true,
      availability,
      serviceStyles
    });
  } catch (error) {
    console.error('Error fetching V2 availability:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// PUT vendor availability V2
app.put("/vendor/availability-v2/:vendorId", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { availability } = await c.req.json();
    
    console.log(`\n💾 Saving V2 availability for vendor: ${vendorId} (SQL)`);
    console.log(`📋 Days configured: ${availability.length}`);
    
    // Validate data structure
    if (!Array.isArray(availability)) {
      return c.json({ error: 'Invalid availability data' }, 400);
    }
    
    // Extract unique service styles
    const serviceStylesSet = new Set<string>();
    availability.forEach((day: DayAvailability) => {
      if (day.serviceConfigs && Array.isArray(day.serviceConfigs)) {
        day.serviceConfigs.forEach(config => {
          if (config.serviceStyle) {
            serviceStylesSet.add(config.serviceStyle);
          }
        });
      }
    });
    const extractedServiceStyles = Array.from(serviceStylesSet);
    
    console.log(`🎨 Extracted service styles from config: ${extractedServiceStyles.join(', ')}`);
    
    // ✅ SQL: Save to vendor_availability_v2 table
    const db = getDbClient();
    const schedulingRepo = getSchedulingRepository();
    
    // Delete existing availability for this vendor
    await db.from('vendor_availability_v2').delete().eq('vendor_id', vendorId);
    
    // Insert new availability
    for (const dayConfig of availability) {
      const dayNum = dayNameToNumber(dayConfig.dayOfWeek);
      
      for (const window of dayConfig.timeWindows) {
        for (const serviceConfig of dayConfig.serviceConfigs) {
          await db.from('vendor_availability_v2').insert({
            vendor_id: vendorId,
            day_of_week: dayNum,
            time_window_start: window.startTime,
            time_window_end: window.endTime,
            is_enabled: window.isEnabled,
            service_style: serviceConfig.serviceStyle,
            slot_duration_minutes: serviceConfig.slotDuration,
            service_area_km: serviceConfig.serviceArea || null,
            max_capacity: 1
          });
        }
      }
    }
    
    // Generate and cache customer-facing slot availability (optional - can be computed on demand)
    console.log(`✅ V2 availability saved and published to customer app`);
    
    return c.json({
      success: true,
      message: 'Availability saved and published to customer app'
    });
  } catch (error) {
    console.error('Error saving V2 availability:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// GET customer-facing available slots for a vendor
app.get("/vendor/:vendorId/available-slots", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const date = c.req.query('date'); // YYYY-MM-DD
    const serviceStyle = c.req.query('serviceStyle'); // 'tele', 'clinic', 'home' (customer format)
    
    // Map customer format to vendor format
    const serviceStyleMap: Record<string, string> = {
      'tele': 'tele',
      'clinic': 'at_center',
      'home': 'at_home'
    };
    const vendorServiceStyle = serviceStyle ? (serviceStyleMap[serviceStyle] || serviceStyle) : undefined;
    
    console.log(`\n🎯 Customer requesting slots for vendor: ${vendorId} (SQL)`);
    console.log(`   Date: ${date || 'not specified'}`);
    console.log(`   Service Style (customer): ${serviceStyle || 'not specified'}`);
    console.log(`   Service Style (vendor): ${vendorServiceStyle || 'not specified'}`);
    
    // ✅ SQL: Check if vendor is online
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    if (!vendor || vendor.is_active === false) {
      console.log(`❌ Vendor is offline or inactive`);
      return c.json({
        success: true,
        available: false,
        reason: 'Vendor is currently unavailable',
        slots: []
      });
    }
    
    // ✅ SQL: Get vendor availability
    const schedulingRepo = getSchedulingRepository();
    let availability: DayAvailability[] = [];
    
    if (date) {
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      const dayAvail = await schedulingRepo.getVendorAvailability(vendorId, dayOfWeek);
      
      if (dayAvail.length > 0) {
        const dayName = dayNumberToName(dayOfWeek);
        const timeWindows: TimeSlot[] = [];
        const serviceConfigsMap = new Map<string, ServiceSlotConfig>();
        
        for (const avail of dayAvail) {
          if (vendorServiceStyle && avail.service_style !== vendorServiceStyle) continue;
          
          timeWindows.push({
            id: avail.id,
            startTime: avail.time_window_start,
            endTime: avail.time_window_end,
            isEnabled: avail.is_enabled
          });
          
          if (!serviceConfigsMap.has(avail.service_style)) {
            serviceConfigsMap.set(avail.service_style, {
              serviceStyle: avail.service_style,
              slotDuration: avail.slot_duration_minutes,
              serviceArea: avail.service_area_km ? parseFloat(avail.service_area_km.toString()) : undefined
            });
          }
        }
        
        if (timeWindows.length > 0) {
          availability.push({
            dayOfWeek: dayName,
            timeWindows,
            serviceConfigs: Array.from(serviceConfigsMap.values())
          });
        }
      }
    }
    
    console.log(`📊 Loaded availability: ${availability.length} days configured`);
    
    if (availability.length === 0) {
      console.log(`ℹ️  No availability configured - allowing all slots by default`);
      return c.json({
        success: true,
        available: true,
        slots: generateDefaultSlots()
      });
    }
    
    // Determine day of week from date
    let dayOfWeek = '';
    if (date) {
      const dateObj = new Date(date);
      dayOfWeek = dayNumberToName(dateObj.getDay());
      console.log(`📅 Date ${date} is a ${dayOfWeek}`);
    }
    
    // Get slots for the specific day and service style
    const slots = generateSlotsForCustomer(availability, dayOfWeek, vendorServiceStyle);
    
    // ✅ SQL: Filter out booked slots
    const availableSlots = await filterBookedSlots(vendorId, date, slots);
    
    console.log(`✅ Generated ${availableSlots.length} available slots`);
    
    return c.json({
      success: true,
      available: true,
      slots: availableSlots
    });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Check specific slot availability (for booking validation)
app.post("/vendor/:vendorId/check-slot", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { date, time, serviceStyle } = await c.req.json();
    
    console.log(`\n🔍 Checking slot availability (SQL):`);
    console.log(`   Vendor: ${vendorId}`);
    console.log(`   Date: ${date}`);
    console.log(`   Time: ${time}`);
    console.log(`   Service: ${serviceStyle}`);
    
    // ✅ SQL: Check vendor is online
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    if (!vendor || vendor.is_active === false) {
      return c.json({
        available: false,
        reason: 'Vendor is in vacation mode'
      });
    }
    
    // ✅ SQL: Get vendor availability
    const schedulingRepo = getSchedulingRepository();
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    const dayAvail = await schedulingRepo.getVendorAvailability(vendorId, dayOfWeek);
    
    if (dayAvail.length === 0) {
      // No restrictions - available by default
      return c.json({ available: true });
    }
    
    // Check if time falls within any enabled time window
    const timeValue = timeToMinutes(time.split(' - ')[0]);
    let slotFound = false;
    
    for (const avail of dayAvail) {
      if (!avail.is_enabled) continue;
      if (serviceStyle && avail.service_style !== serviceStyle) continue;
      
      const windowStart = timeToMinutes(avail.time_window_start);
      const windowEnd = timeToMinutes(avail.time_window_end);
      
      if (timeValue >= windowStart && timeValue < windowEnd) {
        slotFound = true;
        break;
      }
    }
    
    if (!slotFound) {
      return c.json({
        available: false,
        reason: 'Time slot is outside configured availability windows'
      });
    }
    
    // ✅ SQL: Check for existing bookings
    const bookingsRepo = getBookingsRepository();
    const bookings = await bookingsRepo.findByVendor(vendorId, { limit: 1000 });
    const bookedCount = bookings.filter((b: any) => {
      const bookingDate = b.scheduled_date || b.scheduledDate;
      const bookingTime = b.scheduled_time || b.scheduledTime;
      return bookingDate === date && 
             bookingTime === time &&
             b.status !== 'cancelled';
    }).length;
    
    // For now, allow 1 booking per slot (can be made configurable)
    if (bookedCount >= 1) {
      return c.json({
        available: false,
        reason: 'Time slot is fully booked'
      });
    }
    
    console.log(`✅ Slot is available`);
    return c.json({ available: true });
  } catch (error) {
    console.error('Error checking slot:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Helper: Generate slot times within a window
function generateSlotTimes(startTime: string, endTime: string, durationMinutes: number): string[] {
  const slots: string[] = [];
  let currentMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  while (currentMinutes + durationMinutes <= endMinutes) {
    const slotStart = minutesToTime(currentMinutes);
    const slotEnd = minutesToTime(currentMinutes + durationMinutes);
    slots.push(`${slotStart} - ${slotEnd}`);
    currentMinutes += durationMinutes;
  }
  
  return slots;
}

// Helper: Convert time string to minutes
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper: Convert minutes to time string
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Helper: Generate slots for customer based on day and service
function generateSlotsForCustomer(
  availability: DayAvailability[],
  dayOfWeek: string,
  serviceStyle?: string
): string[] {
  const dayConfig = availability.find(a => a.dayOfWeek === dayOfWeek);
  if (!dayConfig) {
    return [];
  }
  
  const allSlots: string[] = [];
  
  // If service style specified, only generate for that style
  if (serviceStyle) {
    const serviceConfig = dayConfig.serviceConfigs.find(c => c.serviceStyle === serviceStyle);
    if (serviceConfig) {
      for (const window of dayConfig.timeWindows) {
        if (window.isEnabled) {
          const slots = generateSlotTimes(window.startTime, window.endTime, serviceConfig.slotDuration);
          allSlots.push(...slots);
        }
      }
    }
  } else {
    // Generate for all services (take union of all slots)
    const slotSet = new Set<string>();
    
    for (const serviceConfig of dayConfig.serviceConfigs) {
      for (const window of dayConfig.timeWindows) {
        if (window.isEnabled) {
          const slots = generateSlotTimes(window.startTime, window.endTime, serviceConfig.slotDuration);
          slots.forEach(slot => slotSet.add(slot));
        }
      }
    }
    
    allSlots.push(...Array.from(slotSet).sort());
  }
  
  return allSlots;
}

// Helper: Filter out booked slots
async function filterBookedSlots(vendorId: string, date: string, slots: string[]): Promise<string[]> {
  if (!date) return slots; // Can't filter without date
  
  // ✅ SQL: Get bookings for this vendor and date
  const bookingsRepo = getBookingsRepository();
  const bookings = await bookingsRepo.findByVendor(vendorId, { limit: 1000 });
  const bookedSlots = new Set<string>();
  
  for (const booking of bookings) {
    const bookingDate = booking.scheduled_date || booking.scheduledDate;
    const bookingTime = booking.scheduled_time || booking.scheduledTime;
    if (bookingDate === date && 
        booking.status !== 'cancelled') {
      bookedSlots.add(bookingTime);
    }
  }
  
  return slots.filter(slot => !bookedSlots.has(slot));
}

// Helper: Generate default slots (fallback when no config)
function generateDefaultSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h < 20; h++) {
    const start = `${h.toString().padStart(2, '0')}:00`;
    const end = `${h.toString().padStart(2, '0')}:30`;
    const start2 = `${h.toString().padStart(2, '0')}:30`;
    const end2 = `${(h + 1).toString().padStart(2, '0')}:00`;
    
    slots.push(`${start} - ${end}`);
    slots.push(`${start2} - ${end2}`);
  }
  return slots;
}

export const vendorScheduleV2Endpoints = app;

