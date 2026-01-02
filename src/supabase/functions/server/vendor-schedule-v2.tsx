// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import {
  getVendorsRepository,
  getBookingsRepository,
  getVendorCenterSettingsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

/**
 * VENDOR SCHEDULE MANAGEMENT V2 - PRODUCTION GRADE
 * 
 * Features:
 * - Time window based scheduling (start/end time)
 * - Service-specific slot durations (15-120 minutes configurable)
 * - Service area for home visits (1-10 km radius)
 * - Auto-generate slots based on configuration
 * - Real-time sync with customer app
 * - Enable/disable individual slots
 * - Per-day configuration
 */

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

// GET vendor availability V2
app.get("/vendor/availability-v2/:vendorId", async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    console.log(`\n🔍 Fetching V2 availability for vendor: ${vendorId}`);
    
    // ✅ SQL: Get vendor availability
    const centerSettingsRepo = getVendorCenterSettingsRepository();
    const centerSettings = await centerSettingsRepo.findByVendor(vendorId);
    const savedData = centerSettings.length > 0 ? centerSettings[0].availability_v2 : null;
    
    let availability: DayAvailability[] = [];
    let serviceStyles: string[] = [];
    
    // Check if data is in new format (object with availability + serviceStyles)
    // or old format (just array)
    if (savedData && typeof savedData === 'object') {
      if (Array.isArray(savedData)) {
        // Old format - just array
        availability = savedData;
        // Extract service styles from the data
        const stylesSet = new Set<string>();
        savedData.forEach((day: DayAvailability) => {
          if (day.serviceConfigs) {
            day.serviceConfigs.forEach(config => {
              if (config.serviceStyle) stylesSet.add(config.serviceStyle);
            });
          }
        });
        serviceStyles = Array.from(stylesSet);
      } else if ('availability' in savedData) {
        // New format - object with availability and serviceStyles
        availability = savedData.availability || [];
        serviceStyles = savedData.serviceStyles || [];
      }
    }
    
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
    
    console.log(`\n💾 Saving V2 availability for vendor: ${vendorId}`);
    console.log(`📋 Days configured: ${availability.length}`);
    
    // Validate data structure
    if (!Array.isArray(availability)) {
      return c.json({ error: 'Invalid availability data' }, 400);
    }
    
    // Extract unique service styles from the availability configuration
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
    
    // Save the V2 availability with extracted service styles
    const dataToSave = {
      availability,
      serviceStyles: extractedServiceStyles
    };
    
    // ✅ SQL: Save vendor availability
    if (centerSettings.length > 0) {
      await centerSettingsRepo.update(centerSettings[0].id, {
        availability_v2: dataToSave,
        updated_at: new Date().toISOString()
      });
    } else {
      await centerSettingsRepo.create({
        vendor_id: vendorId,
        availability_v2: dataToSave,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    // Generate and cache customer-facing slot availability
    await generateCustomerSlots(vendorId, availability);
    
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
    
    console.log(`\n🎯 Customer requesting slots for vendor: ${vendorId}`);
    console.log(`   Date: ${date || 'not specified'}`);
    console.log(`   Service Style (customer): ${serviceStyle || 'not specified'}`);
    console.log(`   Service Style (vendor): ${vendorServiceStyle || 'not specified'}`);
    
    // ✅ SQL: Check if vendor is online
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    const isOnline = vendor?.is_online !== false && vendor?.isOnline !== false;
    if (!isOnline) {
      console.log(`❌ Vendor is offline (vacation mode)`);
      return c.json({
        success: true,
        available: false,
        reason: 'Vendor is currently unavailable',
        slots: []
      });
    }
    
    // Get vendor availability V2 - handle both old and new format
    // ✅ SQL: Get vendor availability
    const centerSettingsRepo = getVendorCenterSettingsRepository();
    const centerSettings = await centerSettingsRepo.findByVendor(vendorId);
    const savedData = centerSettings.length > 0 ? centerSettings[0].availability_v2 : null;
    let availability: DayAvailability[] = [];
    
    console.log('🔍 Raw saved data:', JSON.stringify(savedData, null, 2));
    
    if (savedData) {
      if (Array.isArray(savedData)) {
        // Old format - just array
        availability = savedData;
        console.log('✅ Using old format (array)');
      } else if (savedData.availability && Array.isArray(savedData.availability)) {
        // New format - object with availability property
        availability = savedData.availability;
        console.log('✅ Using new format (object with availability)');
      }
    }
    
    console.log(`📊 Loaded availability: ${availability.length} days configured`);
    console.log('📊 Availability data:', JSON.stringify(availability, null, 2));
    
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
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      dayOfWeek = days[dateObj.getDay()];
      console.log(`📅 Date ${date} is a ${dayOfWeek}`);
    }
    
    // Get slots for the specific day and service style
    const slots = generateSlotsForCustomer(availability, dayOfWeek, vendorServiceStyle);
    
    // Filter out booked slots
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
    
    console.log(`\n🔍 Checking slot availability:`);
    console.log(`   Vendor: ${vendorId}`);
    console.log(`   Date: ${date}`);
    console.log(`   Time: ${time}`);
    console.log(`   Service: ${serviceStyle}`);
    
    // ✅ SQL: Check vendor is online
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    const isOnline = vendor?.is_online !== false && vendor?.isOnline !== false;
    if (!isOnline) {
      return c.json({
        available: false,
        reason: 'Vendor is in vacation mode'
      });
    }
    
    // ✅ SQL: Get vendor availability
    const centerSettingsRepo = getVendorCenterSettingsRepository();
    const centerSettings = await centerSettingsRepo.findByVendor(vendorId);
    const availabilityData = centerSettings.length > 0 ? centerSettings[0].availability_v2 : null;
    let availability: DayAvailability[] = [];
    
    if (availabilityData) {
      if (Array.isArray(availabilityData)) {
        availability = availabilityData;
      } else if (availabilityData.availability && Array.isArray(availabilityData.availability)) {
        availability = availabilityData.availability;
      }
    }
    
    if (availability.length === 0) {
      // No restrictions - available by default
      return c.json({ available: true });
    }
    
    // Get day of week
    const dateObj = new Date(date);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = days[dateObj.getDay()];
    
    // Find day configuration
    const dayConfig = availability.find(a => a.dayOfWeek === dayOfWeek);
    if (!dayConfig) {
      return c.json({
        available: false,
        reason: 'No availability configured for this day'
      });
    }
    
    // Check if time falls within any enabled time window
    const timeValue = timeToMinutes(time.split(' - ')[0]); // Convert "09:00" to minutes
    let slotFound = false;
    
    for (const window of dayConfig.timeWindows) {
      if (!window.isEnabled) continue;
      
      const windowStart = timeToMinutes(window.startTime);
      const windowEnd = timeToMinutes(window.endTime);
      
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
    
    // Check service style configuration
    if (serviceStyle) {
      const serviceConfig = dayConfig.serviceConfigs.find(c => c.serviceStyle === serviceStyle);
      if (!serviceConfig) {
        return c.json({
          available: false,
          reason: 'Service type not available on this day'
        });
      }
    }
    
    // ✅ SQL: Check for existing bookings
    const bookingsRepo = getBookingsRepository();
    const vendorBookings = await bookingsRepo.findByVendor(vendorId);
    const bookedCount = vendorBookings.filter(b => {
      const scheduledDate = b.scheduled_date || b.scheduledDate;
      const scheduledTime = b.scheduled_time || b.scheduledTime;
      const status = b.status;
      return scheduledDate === date && 
             scheduledTime === time &&
             status !== 'cancelled';
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

// Helper: Generate customer-facing slots
async function generateCustomerSlots(vendorId: string, availability: DayAvailability[]) {
  console.log(`\n🔄 Generating customer-facing slots...`);
  
  const customerSlots: any = {};
  
  for (const dayConfig of availability) {
    const daySlots: any = {};
    
    for (const serviceConfig of dayConfig.serviceConfigs) {
      const slots: string[] = [];
      
      for (const window of dayConfig.timeWindows) {
        if (!window.isEnabled) continue;
        
        const windowSlots = generateSlotTimes(
          window.startTime,
          window.endTime,
          serviceConfig.slotDuration
        );
        
        slots.push(...windowSlots);
      }
      
      daySlots[serviceConfig.serviceStyle] = {
        slots,
        duration: serviceConfig.slotDuration,
        serviceArea: serviceConfig.serviceArea
      };
    }
    
    customerSlots[dayConfig.dayOfWeek] = daySlots;
  }
  
  // ✅ SQL: Store customer slots (in vendor_center_settings or cache table)
  const centerSettingsRepo = getVendorCenterSettingsRepository();
  const centerSettings = await centerSettingsRepo.findByVendor(vendorId);
  if (centerSettings.length > 0) {
    await centerSettingsRepo.update(centerSettings[0].id, {
      customer_slots: customerSlots,
      updated_at: new Date().toISOString()
    });
  }
  console.log(`✅ Customer slots cached for all days`);
}

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
  console.log(`\n🔄 generateSlotsForCustomer called:`);
  console.log(`  - dayOfWeek: ${dayOfWeek}`);
  console.log(`  - serviceStyle: ${serviceStyle}`);
  console.log(`  - availability array length: ${availability.length}`);
  
  const dayConfig = availability.find(a => a.dayOfWeek === dayOfWeek);
  if (!dayConfig) {
    console.log(`❌ No day config found for "${dayOfWeek}"`);
    return [];
  }
  
  console.log(`✅ Found day config:`, dayConfig);
  console.log(`  - timeWindows: ${dayConfig.timeWindows.length}`);
  console.log(`  - serviceConfigs: ${dayConfig.serviceConfigs.length}`);
  
  const allSlots: string[] = [];
  
  // If service style specified, only generate for that style
  if (serviceStyle) {
    const serviceConfig = dayConfig.serviceConfigs.find(c => c.serviceStyle === serviceStyle);
    if (serviceConfig) {
      console.log(`✅ Found service config for "${serviceStyle}":`, serviceConfig);
      for (const window of dayConfig.timeWindows) {
        if (window.isEnabled) {
          console.log(`  - Processing window: ${window.startTime} to ${window.endTime}`);
          const slots = generateSlotTimes(window.startTime, window.endTime, serviceConfig.slotDuration);
          console.log(`    Generated ${slots.length} slots:`, slots);
          allSlots.push(...slots);
        } else {
          console.log(`  - Skipping disabled window: ${window.startTime} to ${window.endTime}`);
        }
      }
    } else {
      console.log(`❌ No service config found for "${serviceStyle}"`);
      console.log(`   Available service styles:`, dayConfig.serviceConfigs.map(c => c.serviceStyle));
    }
  } else {
    // Generate for all services (take union of all slots)
    console.log(`🔄 Generating slots for ALL service types`);
    const slotSet = new Set<string>();
    
    for (const serviceConfig of dayConfig.serviceConfigs) {
      console.log(`  - Processing service: ${serviceConfig.serviceStyle}`);
      for (const window of dayConfig.timeWindows) {
        if (window.isEnabled) {
          const slots = generateSlotTimes(window.startTime, window.endTime, serviceConfig.slotDuration);
          console.log(`    Window ${window.startTime}-${window.endTime}: ${slots.length} slots`);
          slots.forEach(slot => slotSet.add(slot));
        }
      }
    }
    
    allSlots.push(...Array.from(slotSet).sort());
  }
  
  console.log(`✅ Total slots generated: ${allSlots.length}`);
  return allSlots;
}

// Helper: Filter out booked slots
async function filterBookedSlots(vendorId: string, date: string, slots: string[]): Promise<string[]> {
  if (!date) return slots; // Can't filter without date
  
  // ✅ SQL: Get vendor bookings
  const bookingsRepo = getBookingsRepository();
  const vendorBookings = await bookingsRepo.findByVendor(vendorId);
  const bookedSlots = new Set<string>();
  
  for (const booking of vendorBookings) {
    const scheduledDate = booking.scheduled_date || booking.scheduledDate;
    const scheduledTime = booking.scheduled_time || booking.scheduledTime;
    const status = booking.status;
    if (scheduledDate === date && status !== 'cancelled') {
      bookedSlots.add(scheduledTime);
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