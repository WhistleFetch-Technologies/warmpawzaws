/**
 * VENDOR SCHEDULE MANAGEMENT V2 - SQL VERSION
 * NO KV STORE - All data from SQL
 */

import { Hono } from "hono";
import { getDbClient } from "../../../supabase/lib/db";
import { getSchedulingRepository } from "../../../supabase/lib/repositories/scheduling";

const app = new Hono();

// GET vendor availability V2 (SQL)
app.get("/vendor/availability-v2/:vendorId", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const client = getDbClient();
    const schedulingRepo = getSchedulingRepository();
    
    console.log(`\n🔍 Fetching V2 availability for vendor: ${vendorId} (SQL)`);
    
    // Get vendor availability from SQL
    const availability: any[] = [];
    const serviceStylesSet = new Set<string>();
    
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const vendorAvailability = await schedulingRepo.getVendorAvailability(vendorId, dayOfWeek);
      
      if (vendorAvailability.length > 0) {
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
        
        const timeWindows = vendorAvailability.map(avail => ({
          id: avail.id,
          startTime: avail.time_window_start,
          endTime: avail.time_window_end,
          isEnabled: avail.is_enabled
        }));
        
        const serviceConfigs = vendorAvailability.map(avail => ({
          serviceStyle: avail.service_style,
          slotDuration: avail.slot_duration_minutes,
          serviceArea: avail.service_area_km
        }));
        
        // Collect service styles
        vendorAvailability.forEach(avail => {
          if (avail.service_style) {
            serviceStylesSet.add(avail.service_style);
          }
        });
        
        availability.push({
          dayOfWeek: dayName,
          timeWindows,
          serviceConfigs: Array.from(new Map(serviceConfigs.map(sc => [sc.serviceStyle, sc])).values())
        });
      }
    }
    
    const serviceStyles = Array.from(serviceStylesSet);
    
    console.log(`✅ Found ${availability.length} day configurations (SQL)`);
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

// PUT vendor availability V2 (SQL)
app.put("/vendor/availability-v2/:vendorId", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { availability } = await c.req.json();
    const client = getDbClient();
    
    console.log(`\n💾 Saving V2 availability for vendor: ${vendorId} (SQL)`);
    console.log(`📋 Days configured: ${availability.length}`);
    
    if (!Array.isArray(availability)) {
      return c.json({ error: 'Invalid availability data' }, 400);
    }
    
    // Extract service styles
    const serviceStylesSet = new Set<string>();
    availability.forEach((day: any) => {
      if (day.serviceConfigs && Array.isArray(day.serviceConfigs)) {
        day.serviceConfigs.forEach((config: any) => {
          if (config.serviceStyle) {
            serviceStylesSet.add(config.serviceStyle);
          }
        });
      }
    });
    
    const extractedServiceStyles = Array.from(serviceStylesSet);
    console.log(`🎨 Extracted service styles: ${extractedServiceStyles.join(', ')}`);
    
    // Map day names to day of week numbers
    const dayNameToNumber: Record<string, number> = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6
    };
    
    // Delete existing availability for this vendor
    await client
      .from('vendor_availability_v2')
      .delete()
      .eq('vendor_id', vendorId);
    
    // Insert new availability
    for (const day of availability) {
      const dayOfWeek = dayNameToNumber[day.dayOfWeek?.toLowerCase()];
      if (dayOfWeek === undefined) continue;
      
      for (const timeWindow of day.timeWindows || []) {
        if (!timeWindow.isEnabled) continue;
        
        for (const serviceConfig of day.serviceConfigs || []) {
          await client
            .from('vendor_availability_v2')
            .insert({
              vendor_id: vendorId,
              day_of_week: dayOfWeek,
              time_window_start: timeWindow.startTime,
              time_window_end: timeWindow.endTime,
              is_enabled: timeWindow.isEnabled,
              service_style: serviceConfig.serviceStyle,
              slot_duration_minutes: serviceConfig.slotDuration || 30,
              service_area_km: serviceConfig.serviceArea || null,
              max_capacity: 1
            });
        }
      }
    }
    
    console.log(`✅ V2 availability saved to SQL`);
    
    return c.json({
      success: true,
      message: 'Availability saved and published to customer app'
    });
  } catch (error) {
    console.error('Error saving V2 availability:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// GET customer-facing available slots (SQL)
app.get("/vendor/:vendorId/available-slots", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const date = c.req.query('date');
    const serviceStyle = c.req.query('serviceStyle');
    const client = getDbClient();
    const schedulingRepo = getSchedulingRepository();
    
    console.log(`\n🎯 Customer requesting slots for vendor: ${vendorId} (SQL)`);
    
    // Check vendor exists and is active
    const { data: vendor } = await client
      .from('vendors')
      .select('id, is_active')
      .eq('id', vendorId)
      .single();
    
    if (!vendor || !vendor.is_active) {
      return c.json({
        success: true,
        available: false,
        reason: 'Vendor is currently unavailable',
        slots: []
      });
    }
    
    if (!date) {
      return c.json({
        success: true,
        available: true,
        slots: []
      });
    }
    
    // Map customer format to vendor format
    const serviceStyleMap: Record<string, string> = {
      'tele': 'tele',
      'clinic': 'at_center',
      'home': 'at_home'
    };
    const vendorServiceStyle = serviceStyle ? (serviceStyleMap[serviceStyle] || serviceStyle) : 'at_center';
    
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    
    // Get vendor availability for this day
    const vendorAvailability = await schedulingRepo.getVendorAvailability(vendorId, dayOfWeek);
    const dayAvailability = vendorAvailability.filter(avail => 
      avail.service_style === vendorServiceStyle && avail.is_enabled
    );
    
    if (dayAvailability.length === 0) {
      return c.json({
        success: true,
        available: false,
        reason: 'No availability for this service type on this day',
        slots: []
      });
    }
    
    // Generate slots from time windows
    const slots: any[] = [];
    
    for (const avail of dayAvailability) {
      const [startHour, startMin] = avail.time_window_start.split(':').map(Number);
      const [endHour, endMin] = avail.time_window_end.split(':').map(Number);
      const slotDuration = avail.slot_duration_minutes || 30;
      
      let currentHour = startHour;
      let currentMin = startMin;
      
      while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
        const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
        
        // Check if slot is in the past
        const now = new Date();
        const slotDateTime = new Date(date);
        slotDateTime.setHours(currentHour, currentMin, 0, 0);
        
        const minBookingTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 min buffer
        
        if (slotDateTime >= minBookingTime) {
          // Check if slot is booked
          const capacity = await schedulingRepo.getSlotCapacity(
            vendorId,
            null,
            date,
            timeStr,
            vendorServiceStyle
          );
          
          const isBooked = capacity && capacity.current_bookings >= capacity.max_capacity;
          
          slots.push({
            time: timeStr,
            available: !isBooked,
            bookedCount: capacity?.current_bookings || 0,
            isPast: false
          });
        }
        
        // Increment time
        currentMin += slotDuration;
        if (currentMin >= 60) {
          currentMin -= 60;
          currentHour += 1;
        }
      }
    }
    
    console.log(`✅ Generated ${slots.length} slots (${slots.filter(s => s.available).length} available)`);
    
    return c.json({
      success: true,
      available: true,
      slots
    });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Check specific slot availability (SQL)
app.post("/vendor/:vendorId/check-slot", async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { date, time, serviceStyle } = await c.req.json();
    const schedulingRepo = getSchedulingRepository();
    
    console.log(`\n🔍 Checking slot availability (SQL):`);
    console.log(`   Vendor: ${vendorId}`);
    console.log(`   Date: ${date}`);
    console.log(`   Time: ${time}`);
    console.log(`   Service Style: ${serviceStyle}`);
    
    // Check if time slot is within vendor availability windows
    const isAvailable = await schedulingRepo.isTimeSlotAvailable(
      vendorId,
      date,
      time,
      serviceStyle || 'at_center'
    );
    
    if (!isAvailable) {
      return c.json({
        available: false,
        reason: 'Time slot is outside configured availability windows'
      });
    }
    
    // Check capacity
    const capacity = await schedulingRepo.getSlotCapacity(
      vendorId,
      null,
      date,
      time,
      serviceStyle || 'at_center'
    );
    
    if (capacity && capacity.current_bookings >= capacity.max_capacity) {
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

export default app;

