import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';
import { generateId } from './database-schema.tsx';

/**
 * UNIVERSAL STAFF SCHEDULE MANAGEMENT
 * Production-ready endpoints for all staff roles
 * 
 * Features:
 * - Multi-schedule support per staff
 * - Service selection per schedule
 * - Home service radius & lead time
 * - Breaks & buffer time
 * - Vacation days & holidays
 * - Role-based service validation
 */

export function registerUniversalStaffSchedule(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // =============================================
  // GET STAFF SCHEDULES
  // =============================================
  app.get(`${BASE}/staff/:staffId/schedules`, async (c) => {
    try {
      const { staffId } = c.req.param();
      
      console.log(`[SCHEDULE] Fetching schedules for staff: ${staffId}`);

      // Get staff info for role validation
      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      // Get all schedules
      const schedules = await kv.get(`staff:${staffId}:schedules`) || [];

      // Get services catalog to show available services
      const vendorServices = await kv.get(`vendor:${staff.vendorId}:services`) || [];

      // Get holidays
      const holidays = await kv.get(`staff:${staffId}:holidays`) || [];

      // Get vacation days
      const vacations = await kv.get(`staff:${staffId}:vacations`) || [];

      return c.json({
        success: true,
        staff: {
          id: staff.id,
          name: staff.fullName || staff.name,
          role: staff.role,
          roleId: staff.roleId,
          vendorId: staff.vendorId
        },
        schedules,
        availableServices: vendorServices,
        holidays,
        vacations,
        totalSchedules: schedules.length
      });

    } catch (error) {
      console.error('[SCHEDULE] Error:', error);
      return c.json({ error: 'Failed to fetch schedules' }, 500);
    }
  });

  // =============================================
  // CREATE NEW SCHEDULE
  // =============================================
  app.post(`${BASE}/staff/:staffId/schedules`, async (c) => {
    try {
      const { staffId } = c.req.param();
      const body = await c.req.json();

      console.log(`[SCHEDULE] Creating schedule for staff: ${staffId}`);

      // Validate staff
      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      // Validate required fields
      if (!body.startTime || !body.endTime) {
        return c.json({ error: 'Start time and end time are required' }, 400);
      }

      // Validate services
      if (!body.services || body.services.length === 0) {
        return c.json({ error: 'At least one service must be selected' }, 400);
      }

      // Validate home service requirements
      const hasHomeService = body.services.some((s: any) => 
        s.serviceStyle === 'at_home' || s.serviceStyle === 'home'
      );

      if (hasHomeService) {
        if (!body.homeServiceConfig?.radius) {
          return c.json({ error: 'Service radius is required for home services' }, 400);
        }
        if (!body.homeServiceConfig?.leadTime) {
          return c.json({ error: 'Lead time is required for home services' }, 400);
        }
      }

      // Get existing schedules
      const schedules = await kv.get(`staff:${staffId}:schedules`) || [];

      // Create new schedule
      const scheduleId = generateId('schedule');
      const newSchedule = {
        id: scheduleId,
        staffId,
        name: body.name || `Schedule ${schedules.length + 1}`,
        
        // Time configuration
        startTime: body.startTime,
        endTime: body.endTime,
        daysOfWeek: body.daysOfWeek || [1, 2, 3, 4, 5], // Monday-Friday default
        
        // Breaks
        breaks: body.breaks || [],
        
        // Buffer time between appointments (minutes)
        bufferTime: body.bufferTime || 15,
        
        // Services enabled for this schedule
        services: body.services.map((s: any) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          serviceStyle: s.serviceStyle,
          duration: s.duration || 30,
          enabled: true
        })),
        
        // Home service configuration
        homeServiceConfig: hasHomeService ? {
          radius: body.homeServiceConfig.radius,
          leadTime: body.homeServiceConfig.leadTime,
          leadTimeUnit: body.homeServiceConfig.leadTimeUnit || 'minutes'
        } : null,
        
        // Metadata
        isActive: body.isActive !== undefined ? body.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      schedules.push(newSchedule);
      await kv.set(`staff:${staffId}:schedules`, schedules);

      console.log(`✅ [SCHEDULE] Created schedule: ${scheduleId}`);

      return c.json({
        success: true,
        schedule: newSchedule,
        message: 'Schedule created successfully'
      });

    } catch (error) {
      console.error('[SCHEDULE] Error:', error);
      return c.json({ error: 'Failed to create schedule' }, 500);
    }
  });

  // =============================================
  // UPDATE SCHEDULE
  // =============================================
  app.put(`${BASE}/staff/:staffId/schedules/:scheduleId`, async (c) => {
    try {
      const { staffId, scheduleId } = c.req.param();
      const body = await c.req.json();

      console.log(`[SCHEDULE] Updating schedule: ${scheduleId}`);

      const schedules = await kv.get(`staff:${staffId}:schedules`) || [];
      const index = schedules.findIndex((s: any) => s.id === scheduleId);

      if (index === -1) {
        return c.json({ error: 'Schedule not found' }, 404);
      }

      // Validate home service requirements if applicable
      const services = body.services || schedules[index].services;
      const hasHomeService = services.some((s: any) => 
        s.serviceStyle === 'at_home' || s.serviceStyle === 'home'
      );

      if (hasHomeService && body.homeServiceConfig) {
        if (!body.homeServiceConfig.radius || !body.homeServiceConfig.leadTime) {
          return c.json({ 
            error: 'Service radius and lead time are required for home services' 
          }, 400);
        }
      }

      // Update schedule
      schedules[index] = {
        ...schedules[index],
        ...body,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`staff:${staffId}:schedules`, schedules);

      console.log(`✅ [SCHEDULE] Updated schedule: ${scheduleId}`);

      return c.json({
        success: true,
        schedule: schedules[index],
        message: 'Schedule updated successfully'
      });

    } catch (error) {
      console.error('[SCHEDULE] Error:', error);
      return c.json({ error: 'Failed to update schedule' }, 500);
    }
  });

  // =============================================
  // DELETE SCHEDULE
  // =============================================
  app.delete(`${BASE}/staff/:staffId/schedules/:scheduleId`, async (c) => {
    try {
      const { staffId, scheduleId } = c.req.param();

      const schedules = await kv.get(`staff:${staffId}:schedules`) || [];
      const filtered = schedules.filter((s: any) => s.id !== scheduleId);

      await kv.set(`staff:${staffId}:schedules`, filtered);

      return c.json({
        success: true,
        message: 'Schedule deleted successfully'
      });

    } catch (error) {
      console.error('[SCHEDULE] Error:', error);
      return c.json({ error: 'Failed to delete schedule' }, 500);
    }
  });

  // =============================================
  // ADD VACATION DAY
  // =============================================
  app.post(`${BASE}/staff/:staffId/vacations`, async (c) => {
    try {
      const { staffId } = c.req.param();
      const body = await c.req.json();

      if (!body.startDate || !body.endDate) {
        return c.json({ error: 'Start and end dates are required' }, 400);
      }

      const vacations = await kv.get(`staff:${staffId}:vacations`) || [];
      
      const vacationId = generateId('vacation');
      const newVacation = {
        id: vacationId,
        startDate: body.startDate,
        endDate: body.endDate,
        reason: body.reason || 'Vacation',
        createdAt: new Date().toISOString()
      };

      vacations.push(newVacation);
      await kv.set(`staff:${staffId}:vacations`, vacations);

      return c.json({
        success: true,
        vacation: newVacation,
        message: 'Vacation added successfully'
      });

    } catch (error) {
      console.error('[VACATION] Error:', error);
      return c.json({ error: 'Failed to add vacation' }, 500);
    }
  });

  // =============================================
  // DELETE VACATION DAY
  // =============================================
  app.delete(`${BASE}/staff/:staffId/vacations/:vacationId`, async (c) => {
    try {
      const { staffId, vacationId } = c.req.param();

      const vacations = await kv.get(`staff:${staffId}:vacations`) || [];
      const filtered = vacations.filter((v: any) => v.id !== vacationId);

      await kv.set(`staff:${staffId}:vacations`, filtered);

      return c.json({
        success: true,
        message: 'Vacation deleted successfully'
      });

    } catch (error) {
      console.error('[VACATION] Error:', error);
      return c.json({ error: 'Failed to delete vacation' }, 500);
    }
  });

  // =============================================
  // ADD HOLIDAY
  // =============================================
  app.post(`${BASE}/staff/:staffId/holidays`, async (c) => {
    try {
      const { staffId } = c.req.param();
      const body = await c.req.json();

      if (!body.date || !body.name) {
        return c.json({ error: 'Date and name are required' }, 400);
      }

      const holidays = await kv.get(`staff:${staffId}:holidays`) || [];
      
      const holidayId = generateId('holiday');
      const newHoliday = {
        id: holidayId,
        date: body.date,
        name: body.name,
        createdAt: new Date().toISOString()
      };

      holidays.push(newHoliday);
      await kv.set(`staff:${staffId}:holidays`, holidays);

      return c.json({
        success: true,
        holiday: newHoliday,
        message: 'Holiday added successfully'
      });

    } catch (error) {
      console.error('[HOLIDAY] Error:', error);
      return c.json({ error: 'Failed to add holiday' }, 500);
    }
  });

  // =============================================
  // DELETE HOLIDAY
  // =============================================
  app.delete(`${BASE}/staff/:staffId/holidays/:holidayId`, async (c) => {
    try {
      const { staffId, holidayId } = c.req.param();

      const holidays = await kv.get(`staff:${staffId}:holidays`) || [];
      const filtered = holidays.filter((h: any) => h.id !== holidayId);

      await kv.set(`staff:${staffId}:holidays`, filtered);

      return c.json({
        success: true,
        message: 'Holiday deleted successfully'
      });

    } catch (error) {
      console.error('[HOLIDAY] Error:', error);
      return c.json({ error: 'Failed to delete holiday' }, 500);
    }
  });

  // =============================================
  // GET AVAILABLE SLOTS (For Customer Booking)
  // =============================================
  app.get(`${BASE}/staff/:staffId/available-slots`, async (c) => {
    try {
      const { staffId } = c.req.param();
      const date = c.req.query('date');
      const serviceId = c.req.query('serviceId');

      if (!date || !serviceId) {
        return c.json({ error: 'Date and serviceId are required' }, 400);
      }

      console.log(`[SLOTS] Getting slots for staff: ${staffId}, date: ${date}, service: ${serviceId}`);

      // Get staff schedules
      const schedules = await kv.get(`staff:${staffId}:schedules`) || [];

      // Filter active schedules that include this service
      const relevantSchedules = schedules.filter((s: any) => 
        s.isActive && 
        s.services.some((srv: any) => srv.serviceId === serviceId && srv.enabled)
      );

      if (relevantSchedules.length === 0) {
        return c.json({
          success: true,
          slots: [],
          message: 'No schedules found for this service'
        });
      }

      // Check if date is a vacation or holiday
      const vacations = await kv.get(`staff:${staffId}:vacations`) || [];
      const holidays = await kv.get(`staff:${staffId}:holidays`) || [];

      const isVacation = vacations.some((v: any) => 
        date >= v.startDate && date <= v.endDate
      );

      const isHoliday = holidays.some((h: any) => h.date === date);

      if (isVacation || isHoliday) {
        return c.json({
          success: true,
          slots: [],
          message: isVacation ? 'Staff on vacation' : 'Holiday'
        });
      }

      // Get existing bookings for this date
      const allBookings = await kv.getByPrefix('booking:');
      const dayBookings = allBookings.filter((b: any) => 
        b.staffId === staffId && 
        b.date === date && 
        b.status !== 'cancelled'
      );

      // Generate available slots
      const slots = [];
      const requestDate = new Date(date);
      const dayOfWeek = requestDate.getDay(); // 0=Sunday, 1=Monday, etc.

      for (const schedule of relevantSchedules) {
        // Check if schedule applies to this day
        if (!schedule.daysOfWeek.includes(dayOfWeek)) {
          continue;
        }

        // Get service duration and buffer
        const service = schedule.services.find((s: any) => s.serviceId === serviceId);
        if (!service) continue;

        const duration = service.duration || 30;
        const buffer = schedule.bufferTime || 15;

        // Parse start and end time
        const [startHour, startMin] = schedule.startTime.split(':').map(Number);
        const [endHour, endMin] = schedule.endTime.split(':').map(Number);

        let currentTime = startHour * 60 + startMin; // minutes from midnight
        const endTime = endHour * 60 + endMin;

        while (currentTime + duration <= endTime) {
          const slotStart = currentTime;
          const slotEnd = currentTime + duration;

          // Check if slot overlaps with breaks
          const overlapsBreak = schedule.breaks.some((br: any) => {
            const [breakStartH, breakStartM] = br.startTime.split(':').map(Number);
            const [breakEndH, breakEndM] = br.endTime.split(':').map(Number);
            const breakStart = breakStartH * 60 + breakStartM;
            const breakEnd = breakEndH * 60 + breakEndM;

            return !(slotEnd <= breakStart || slotStart >= breakEnd);
          });

          if (!overlapsBreak) {
            // Check if slot overlaps with existing bookings
            const overlapsBooking = dayBookings.some((b: any) => {
              const [bookingStartH, bookingStartM] = b.time.split(':').map(Number);
              const bookingStart = bookingStartH * 60 + bookingStartM;
              const bookingEnd = bookingStart + (b.duration || 30);

              return !(slotEnd <= bookingStart || slotStart >= bookingEnd);
            });

            if (!overlapsBooking) {
              const hours = Math.floor(slotStart / 60);
              const mins = slotStart % 60;
              const timeString = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

              slots.push({
                time: timeString,
                duration,
                available: true,
                scheduleId: schedule.id
              });
            }
          }

          currentTime += duration + buffer;
        }
      }

      return c.json({
        success: true,
        date,
        staffId,
        serviceId,
        slots,
        totalSlots: slots.length
      });

    } catch (error) {
      console.error('[SLOTS] Error:', error);
      return c.json({ error: 'Failed to get available slots' }, 500);
    }
  });
}
