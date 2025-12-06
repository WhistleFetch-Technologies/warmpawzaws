import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// ============================================
// STAFF LOCATIONS MANAGEMENT
// ============================================

// GET /staff/:staffId/locations - Get all locations for a staff member
app.get('/:staffId/locations', async (c) => {
  const { staffId } = c.req.param();

  try {
    const locations = await kv.get(`staff:${staffId}:locations`) || [];

    return c.json({ success: true, locations });
  } catch (error) {
    console.error('Error fetching staff locations:', error);
    return c.json({ error: 'Failed to fetch locations' }, 500);
  }
});

// POST /staff/:staffId/locations - Add a new location
app.post('/:staffId/locations', async (c) => {
  const { staffId } = c.req.param();
  const { name, address, latitude, longitude, contactNumber } = await c.req.json();

  if (!name || !address) {
    return c.json({ error: 'Location name and address are required' }, 400);
  }

  try {
    const locations = await kv.get(`staff:${staffId}:locations`) || [];
    
    const newLocation = {
      id: `loc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name,
      address,
      latitude: latitude || null,
      longitude: longitude || null,
      contactNumber: contactNumber || null,
      createdAt: new Date().toISOString()
    };

    locations.push(newLocation);
    await kv.set(`staff:${staffId}:locations`, locations);

    console.log(`✅ Location added for staff ${staffId}:`, newLocation);

    return c.json({ success: true, location: newLocation });
  } catch (error) {
    console.error('Error adding staff location:', error);
    return c.json({ error: 'Failed to add location' }, 500);
  }
});

// DELETE /staff/:staffId/locations/:locationId - Remove a location
app.delete('/:staffId/locations/:locationId', async (c) => {
  const { staffId, locationId } = c.req.param();

  try {
    const locations = await kv.get(`staff:${staffId}:locations`) || [];
    const updatedLocations = locations.filter((loc: any) => loc.id !== locationId);

    await kv.set(`staff:${staffId}:locations`, updatedLocations);

    console.log(`✅ Location ${locationId} removed for staff ${staffId}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error removing staff location:', error);
    return c.json({ error: 'Failed to remove location' }, 500);
  }
});

// ============================================
// STAFF SCHEDULE/AVAILABILITY MANAGEMENT
// ============================================

// GET /staff/:staffId/schedule - Get weekly schedule
app.get('/:staffId/schedule', async (c) => {
  const { staffId } = c.req.param();

  try {
    const schedule = await kv.get(`staff:${staffId}:schedule`) || [];

    return c.json({ success: true, schedule });
  } catch (error) {
    console.error('Error fetching staff schedule:', error);
    return c.json({ error: 'Failed to fetch schedule' }, 500);
  }
});

// PUT /staff/:staffId/schedule - Update weekly schedule
app.put('/:staffId/schedule', async (c) => {
  const { staffId } = c.req.param();
  const { schedule } = await c.req.json();

  if (!schedule || !Array.isArray(schedule)) {
    return c.json({ error: 'Invalid schedule data' }, 400);
  }

  try {
    await kv.set(`staff:${staffId}:schedule`, schedule);

    console.log(`✅ Schedule updated for staff ${staffId}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating staff schedule:', error);
    return c.json({ error: 'Failed to update schedule' }, 500);
  }
});

// GET /staff/:staffId/holidays - Get holidays/time off
app.get('/:staffId/holidays', async (c) => {
  const { staffId } = c.req.param();

  try {
    const holidays = await kv.get(`staff:${staffId}:holidays`) || [];

    return c.json({ success: true, holidays });
  } catch (error) {
    console.error('Error fetching staff holidays:', error);
    return c.json({ error: 'Failed to fetch holidays' }, 500);
  }
});

// POST /staff/:staffId/holidays - Add a holiday/time off
app.post('/:staffId/holidays', async (c) => {
  const { staffId } = c.req.param();
  const { date, reason } = await c.req.json();

  if (!date) {
    return c.json({ error: 'Date is required' }, 400);
  }

  try {
    const holidays = await kv.get(`staff:${staffId}:holidays`) || [];
    
    const newHoliday = {
      id: `holiday_${Date.now()}`,
      date,
      reason: reason || 'Day off',
      createdAt: new Date().toISOString()
    };

    holidays.push(newHoliday);
    await kv.set(`staff:${staffId}:holidays`, holidays);

    console.log(`✅ Holiday added for staff ${staffId}:`, newHoliday);

    return c.json({ success: true, holiday: newHoliday });
  } catch (error) {
    console.error('Error adding staff holiday:', error);
    return c.json({ error: 'Failed to add holiday' }, 500);
  }
});

// DELETE /staff/:staffId/holidays/:holidayId - Remove a holiday
app.delete('/:staffId/holidays/:holidayId', async (c) => {
  const { staffId, holidayId } = c.req.param();

  try {
    const holidays = await kv.get(`staff:${staffId}:holidays`) || [];
    const updatedHolidays = holidays.filter((h: any) => h.id !== holidayId);

    await kv.set(`staff:${staffId}:holidays`, updatedHolidays);

    console.log(`✅ Holiday ${holidayId} removed for staff ${staffId}`);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error removing staff holiday:', error);
    return c.json({ error: 'Failed to remove holiday' }, 500);
  }
});

// ============================================
// SMART AVAILABILITY CALCULATION
// ============================================

// GET /staff/:staffId/available-slots - Get available time slots for a specific date
app.get('/:staffId/available-slots', async (c) => {
  const { staffId } = c.req.param();
  const date = c.req.query('date'); // Format: YYYY-MM-DD
  const serviceDuration = parseInt(c.req.query('duration') || '30'); // Default 30 minutes
  const serviceStyle = c.req.query('serviceStyle') || 'at_center'; // ✅ NEW: Get service style
  const vendorRoleId = c.req.query('vendorRoleId') || ''; // ✅ NEW: Get vendor role

  if (!date) {
    return c.json({ error: 'Date parameter is required' }, 400);
  }

  try {
    // ✅ NEW: Load schedule settings
    const scheduleSettings = await kv.get('platform:schedule_settings') || {
      bufferTime: { at_center: 30, at_home: 120, tele: 15, instant_video: 5 },
      vendorBufferTime: {},
      slotInterval: 30
    };

    // ✅ NEW: Determine buffer time based on service style and vendor type
    let bufferTimeMinutes = scheduleSettings.bufferTime[serviceStyle] || scheduleSettings.bufferTime.at_center;
    
    // Check for vendor-specific override
    if (vendorRoleId && scheduleSettings.vendorBufferTime[vendorRoleId]?.[serviceStyle]) {
      bufferTimeMinutes = scheduleSettings.vendorBufferTime[vendorRoleId][serviceStyle];
    }

    console.log(`🕒 [SLOTS] Buffer time for ${serviceStyle} (${vendorRoleId || 'default'}): ${bufferTimeMinutes} minutes`);

    // ✅ NEW: Calculate minimum bookable time (current time + buffer)
    const now = new Date();
    const minBookableTime = new Date(now.getTime() + bufferTimeMinutes * 60 * 1000);
    const requestedDate = new Date(date + 'T00:00:00');
    const isToday = requestedDate.toDateString() === now.toDateString();

    console.log(`📅 [SLOTS] Requesting slots for: ${date}, Is today: ${isToday}`);
    if (isToday) {
      console.log(`⏰ [SLOTS] Current time: ${now.toISOString()}`);
      console.log(`⏰ [SLOTS] Min bookable time: ${minBookableTime.toISOString()}`);
    }

    // Get day of week from date
    const dateObj = new Date(date);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[dateObj.getDay()];

    // Check if it's a holiday
    const holidays = await kv.get(`staff:${staffId}:holidays`) || [];
    const isHoliday = holidays.some((h: any) => h.date === date);

    if (isHoliday) {
      return c.json({ success: true, availableSlots: [], reason: 'Holiday/Day off' });
    }

    // Get staff schedule
    const schedule = await kv.get(`staff:${staffId}:schedule`) || [];
    const daySchedule = schedule.find((d: any) => d.day === dayOfWeek);

    // ✅ FIXED: If no schedule found, use default business hours (9 AM - 6 PM)
    let effectiveDaySchedule = daySchedule;
    
    if (!effectiveDaySchedule || !effectiveDaySchedule.isWorking) {
      console.log(`⚠️ [SLOTS] No schedule found for staff ${staffId} on ${dayOfWeek}, using default hours`);
      
      // Default business hours for weekdays (Monday-Saturday)
      const dayIndex = dateObj.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      const isWeekday = dayIndex >= 1 && dayIndex <= 6; // Monday to Saturday
      
      if (!isWeekday) {
        // Sunday - no slots by default
        return c.json({ success: true, availableSlots: [], reason: 'Not working on Sunday (default)' });
      }
      
      // Use default schedule: 9 AM - 6 PM with 1 hour lunch break (1-2 PM)
      effectiveDaySchedule = {
        day: dayOfWeek,
        isWorking: true,
        timeSlots: [
          { startTime: '09:00', endTime: '13:00' }, // Morning session
          { startTime: '14:00', endTime: '18:00' }  // Evening session
        ],
        breaks: [
          { startTime: '13:00', endTime: '14:00', reason: 'Lunch Break' }
        ],
        locationId: null,
        locationName: null
      };
      
      console.log(`✅ [SLOTS] Using default schedule for ${dayOfWeek}:`, effectiveDaySchedule);
    }

    // Get existing appointments for this date
    const appointments = await kv.getByPrefix(`appointment:`) || [];
    const staffAppointments = appointments.filter((apt: any) => 
      apt.staffId === staffId && apt.date === date && apt.status !== 'cancelled'
    );

    // Generate time slots based on working hours and breaks
    const slots = [];
    
    for (const timeSlot of effectiveDaySchedule.timeSlots) {
      const slotStartTime = timeSlot.startTime; // e.g., "09:00"
      const slotEndTime = timeSlot.endTime; // e.g., "18:00"

      // Convert to minutes from midnight
      const [startHour, startMin] = slotStartTime.split(':').map(Number);
      const [endHour, endMin] = slotEndTime.split(':').map(Number);
      
      let currentMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      while (currentMinutes + serviceDuration <= endMinutes) {
        const slotTime = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
        const slotEndMinutes = currentMinutes + serviceDuration;
        const slotEndTime = `${String(Math.floor(slotEndMinutes / 60)).padStart(2, '0')}:${String(slotEndMinutes % 60).padStart(2, '0')}`;

        // Check if slot overlaps with breaks
        const overlapsBreak = (effectiveDaySchedule.breaks || []).some((breakSlot: any) => {
          const [breakStartHour, breakStartMin] = breakSlot.startTime.split(':').map(Number);
          const [breakEndHour, breakEndMin] = breakSlot.endTime.split(':').map(Number);
          const breakStartMinutes = breakStartHour * 60 + breakStartMin;
          const breakEndMinutes = breakEndHour * 60 + breakEndMin;

          // Check if appointment overlaps with break
          return !(slotEndMinutes <= breakStartMinutes || currentMinutes >= breakEndMinutes);
        });

        // Check if slot overlaps with existing appointments
        const overlapsAppointment = staffAppointments.some((apt: any) => {
          if (!apt.startTime || !apt.duration) return false;
          
          const [aptStartHour, aptStartMin] = apt.startTime.split(':').map(Number);
          const aptStartMinutes = aptStartHour * 60 + aptStartMin;
          const aptEndMinutes = aptStartMinutes + apt.duration;

          // Check if appointment overlaps with slot
          return !(slotEndMinutes <= aptStartMinutes || currentMinutes >= aptEndMinutes);
        });

        // ✅ FIXED: Check if slot is in the future and bookable
        let isBookable = true;
        if (isToday) {
          // Create a date object for this slot time
          const slotDateTime = new Date(date + 'T' + slotTime + ':00');
          // Slot must be AFTER the minimum bookable time
          isBookable = slotDateTime >= minBookableTime;
          
          if (!isBookable) {
            console.log(`⏰ [SLOTS] Filtering out past slot: ${slotTime} (current min bookable: ${minBookableTime.toTimeString()})`);
          }
        }

        if (!overlapsBreak && !overlapsAppointment && isBookable) {
          slots.push({
            startTime: slotTime,
            endTime: slotEndTime,
            duration: serviceDuration,
            locationId: effectiveDaySchedule.locationId || null,
            locationName: effectiveDaySchedule.locationName || null
          });
        }

        currentMinutes += serviceDuration; // Move to next slot
      }
    }

    return c.json({
      success: true,
      availableSlots: slots,
      dayOfWeek,
      locationId: effectiveDaySchedule.locationId,
      locationName: effectiveDaySchedule.locationName
    });

  } catch (error) {
    console.error('Error calculating available slots:', error);
    return c.json({ error: 'Failed to calculate available slots' }, 500);
  }
});

export default app;