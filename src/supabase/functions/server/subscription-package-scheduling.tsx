/**
 * SUBSCRIPTION PACKAGE SCHEDULING SYSTEM
 * Production-Grade Implementation
 * 
 * Features:
 * - General time slots for subscription packages (Morning 8-12, Afternoon 12-4, Evening 4-8)
 * - Single session booking with specific time slots
 * - Package enrollment scheduling
 * - Recurring schedule management
 * - Availability checking with buffer time
 * - Distance and commute time calculation
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';
import { calculateDistance } from './schedule-utils.tsx';

const TIME_WINDOWS = {
  morning: { label: 'Morning', start: '08:00', end: '12:00', startHour: 8, endHour: 12 },
  afternoon: { label: 'Afternoon', start: '12:00', end: '16:00', startHour: 12, endHour: 16 },
  evening: { label: 'Evening', start: '16:00', end: '20:00', startHour: 16, endHour: 20 }
};

interface PackageSlotRequest {
  vendorId: string;
  staffId?: string;
  packageId?: string;
  isPackage: boolean;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  customerLocation?: { lat: number; lng: number };
  serviceDuration?: number;
  date?: string;
}

interface AvailableSlot {
  timeWindow?: 'morning' | 'afternoon' | 'evening';
  time?: string;
  available: boolean;
  capacity: number;
  booked: number;
  estimatedTravelTime?: number;
  distance?: number;
}

export function subscriptionPackageSchedulingEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * GET /booking/subscription-slots
   * Get available slots for subscription packages or single sessions
   * 
   * Query params:
   * - vendorId: required
   * - staffId: optional (for home services)
   * - packageId: optional (if booking package)
   * - isPackage: boolean (true for package, false for single session)
   * - serviceStyle: at_home | at_center | tele
   * - customerLat, customerLng: for home services distance calculation
   * - serviceDuration: in minutes
   * - date: YYYY-MM-DD (optional, defaults to tomorrow)
   */
  app.get(`${BASE}/booking/subscription-slots`, async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const staffId = c.req.query('staffId');
      const packageId = c.req.query('packageId');
      const isPackage = c.req.query('isPackage') === 'true';
      const serviceStyle = c.req.query('serviceStyle') as 'at_home' | 'at_center' | 'tele' || 'at_home';
      const customerLat = parseFloat(c.req.query('customerLat') || '0');
      const customerLng = parseFloat(c.req.query('customerLng') || '0');
      const serviceDuration = parseInt(c.req.query('serviceDuration') || '60');
      const date = c.req.query('date') || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (!vendorId) {
        return c.json({ error: 'vendorId is required' }, 400);
      }

      console.log(`📅 [PACKAGE-SLOTS] Fetching slots for vendor: ${vendorId}, package: ${isPackage}, style: ${serviceStyle}`);

      // Get vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // For packages: return general time windows
      if (isPackage) {
        return await getPackageTimeWindows(c, vendorId, staffId, serviceStyle, customerLat, customerLng, date);
      }

      // For single sessions: return specific time slots
      return await getSingleSessionSlots(c, vendorId, staffId, serviceStyle, serviceDuration, customerLat, customerLng, date);

    } catch (error) {
      console.error('❌ [PACKAGE-SLOTS] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get general time windows for subscription packages
   */
  async function getPackageTimeWindows(
    c: any,
    vendorId: string,
    staffId: string | undefined,
    serviceStyle: string,
    customerLat: number,
    customerLng: number,
    date: string
  ) {
    const slots: Record<string, AvailableSlot> = {};
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
      new Date(date).getDay()
    ];

    // Get staff or vendor schedule
    let availability: any = null;
    if (staffId) {
      const staff = await kv.get(`staff:${staffId}`);
      if (staff && staff.availability) {
        availability = Array.isArray(staff.availability) 
          ? staff.availability.find((a: any) => a.dayOfWeek === dayOfWeek)
          : null;
      }
    } else {
      // Get vendor center schedule
      const vendorSchedule = await kv.get(`vendor_schedule:${vendorId}`);
      if (vendorSchedule && vendorSchedule.availability) {
        availability = vendorSchedule.availability.find((a: any) => a.dayOfWeek === dayOfWeek);
      }
    }

    // Check existing bookings for this date
    const dateBookings = await getDateBookings(vendorId, staffId, date);

    // Calculate distance and travel time for home services
    let distance = 0;
    let travelTime = 0;
    if (serviceStyle === 'at_home' && customerLat && customerLng && staffId) {
      const staff = await kv.get(`staff:${staffId}`);
      const staffLocation = staff?.lastKnownLocation || vendor?.location;
      if (staffLocation?.latitude && staffLocation?.longitude) {
        distance = calculateDistance(
          customerLat,
          customerLng,
          staffLocation.latitude,
          staffLocation.longitude
        );
        travelTime = Math.ceil(distance * 2); // 2 minutes per km (conservative)
      }
    }

    // Check each time window
    for (const [windowKey, window] of Object.entries(TIME_WINDOWS)) {
      const windowBookings = dateBookings.filter((b: any) => {
        const bookingTime = b.scheduledTime?.split(':')[0] || b.bookingTime?.split(':')[0];
        const hour = parseInt(bookingTime) || 0;
        return hour >= window.startHour && hour < window.endHour;
      });

      // Check if window is available based on schedule
      let isAvailable = true;
      if (availability) {
        const windowConfig = availability.timeWindows?.find((w: any) => {
          const startHour = parseInt(w.startTime?.split(':')[0] || '0');
          const endHour = parseInt(w.endTime?.split(':')[0] || '0');
          return startHour <= window.startHour && endHour >= window.endHour;
        });
        isAvailable = windowConfig?.isEnabled !== false;
      }

      // Capacity check (default: 5 bookings per window)
      const capacity = availability?.timeWindows?.find((w: any) => {
        const startHour = parseInt(w.startTime?.split(':')[0] || '0');
        return startHour <= window.startHour;
      })?.maxBookings || 5;

      slots[windowKey] = {
        timeWindow: windowKey as 'morning' | 'afternoon' | 'evening',
        available: isAvailable && windowBookings.length < capacity,
        capacity,
        booked: windowBookings.length,
        ...(serviceStyle === 'at_home' && distance > 0 && {
          distance: Math.round(distance * 10) / 10,
          estimatedTravelTime: travelTime
        })
      };
    }

    return c.json({
      success: true,
      date,
      serviceStyle,
      isPackage: true,
      slots,
      timeWindows: TIME_WINDOWS
    });
  }

  /**
   * Get specific time slots for single session bookings
   */
  async function getSingleSessionSlots(
    c: any,
    vendorId: string,
    staffId: string | undefined,
    serviceStyle: string,
    serviceDuration: number,
    customerLat: number,
    customerLng: number,
    date: string
  ) {
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
      new Date(date).getDay()
    ];

    // Get staff or vendor schedule
    let availability: any = null;
    if (staffId) {
      const staff = await kv.get(`staff:${staffId}`);
      if (staff && staff.availability) {
        availability = Array.isArray(staff.availability) 
          ? staff.availability.find((a: any) => a.dayOfWeek === dayOfWeek)
          : null;
      }
    } else {
      const vendorSchedule = await kv.get(`vendor_schedule:${vendorId}`);
      if (vendorSchedule && vendorSchedule.availability) {
        availability = vendorSchedule.availability.find((a: any) => a.dayOfWeek === dayOfWeek);
      }
    }

    if (!availability || !availability.timeWindows || availability.timeWindows.length === 0) {
      return c.json({
        success: true,
        date,
        serviceStyle,
        isPackage: false,
        slots: [],
        message: 'No availability configured for this day'
      });
    }

    // Get existing bookings
    const dateBookings = await getDateBookings(vendorId, staffId, date);

    // Calculate distance and travel time for home services
    let distance = 0;
    let travelTime = 0;
    if (serviceStyle === 'at_home' && customerLat && customerLng && staffId) {
      const staff = await kv.get(`staff:${staffId}`);
      const vendor = await kv.get(`vendor:${vendorId}`);
      const staffLocation = staff?.lastKnownLocation || vendor?.location;
      if (staffLocation?.latitude && staffLocation?.longitude) {
        distance = calculateDistance(
          customerLat,
          customerLng,
          staffLocation.latitude,
          staffLocation.longitude
        );
        travelTime = Math.ceil(distance * 2);
      }
    }

    // Generate slots from time windows
    const slots: AvailableSlot[] = [];
    const slotInterval = 30; // 30-minute intervals

    for (const window of availability.timeWindows) {
      if (!window.isEnabled) continue;

      const [startHour, startMin] = window.startTime.split(':').map(Number);
      const [endHour, endMin] = window.endTime.split(':').map(Number);
      
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
          // Check for conflicts
          const slotEndTime = new Date(slotDateTime.getTime() + serviceDuration * 60 * 1000);
          const hasConflict = dateBookings.some((b: any) => {
            const bookingStart = new Date(`${date}T${b.scheduledTime || b.bookingTime}`);
            const bookingEnd = new Date(bookingStart.getTime() + (b.duration || 60) * 60 * 1000);
            return (slotDateTime < bookingEnd && slotEndTime > bookingStart);
          });

          // Check if sufficient time available (service duration + buffer + travel time)
          const requiredTime = serviceDuration + (serviceStyle === 'at_home' ? travelTime + 30 : 30);
          const availableUntil = new Date(slotDateTime);
          availableUntil.setMinutes(availableUntil.getMinutes() + requiredTime);
          const windowEnd = new Date(date);
          windowEnd.setHours(endHour, endMin, 0, 0);
          const hasSufficientTime = availableUntil <= windowEnd;

          slots.push({
            time: timeStr,
            available: !hasConflict && hasSufficientTime,
            capacity: window.maxBookings || 1,
            booked: hasConflict ? 1 : 0,
            ...(serviceStyle === 'at_home' && distance > 0 && {
              distance: Math.round(distance * 10) / 10,
              estimatedTravelTime: travelTime
            })
          });
        }

        // Move to next slot
        currentMin += slotInterval;
        if (currentMin >= 60) {
          currentMin -= 60;
          currentHour += 1;
        }
      }
    }

    return c.json({
      success: true,
      date,
      serviceStyle,
      isPackage: false,
      slots: slots.filter(s => s.available),
      totalSlots: slots.length
    });
  }

  /**
   * Get bookings for a specific date
   */
  async function getDateBookings(vendorId: string, staffId: string | undefined, date: string): Promise<any[]> {
    const bookings: any[] = [];

    // Get vendor bookings
    const vendorBookings = await kv.get(`vendor:${vendorId}:bookings`) || [];
    for (const bookingId of vendorBookings) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking && booking.scheduledDate === date) {
        if (!staffId || booking.staffId === staffId || booking.assignedStaffId === staffId) {
          bookings.push(booking);
        }
      }
    }

    // Get staff bookings if staffId provided
    if (staffId) {
      const staffBookings = await kv.get(`staff:${staffId}:bookings`) || [];
      for (const bookingId of staffBookings) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking && booking.scheduledDate === date && !bookings.find(b => b.id === bookingId)) {
          bookings.push(booking);
        }
      }
    }

    return bookings;
  }

  /**
   * POST /booking/subscription-schedule
   * Create subscription package schedule
   */
  app.post(`${BASE}/booking/subscription-schedule`, async (c) => {
    try {
      const {
        vendorId,
        staffId,
        customerId,
        packageId,
        timeWindow,
        preferredDays,
        startDate,
        endDate,
        totalSessions
      } = await c.req.json();

      if (!vendorId || !customerId || !packageId || !timeWindow || !startDate) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      if (!['morning', 'afternoon', 'evening'].includes(timeWindow)) {
        return c.json({ error: 'Invalid time window' }, 400);
      }

      const scheduleId = `sub_schedule_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const schedule = {
        id: scheduleId,
        vendorId,
        staffId,
        customerId,
        packageId,
        timeWindow,
        preferredDays: preferredDays || [],
        startDate,
        endDate,
        totalSessions,
        sessionsCompleted: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`subscription_schedule:${scheduleId}`, schedule);
      await kv.set(`customer:${customerId}:subscription_schedules`, [
        ...(await kv.get(`customer:${customerId}:subscription_schedules`) || []),
        scheduleId
      ]);

      console.log(`✅ [PACKAGE-SCHEDULE] Created schedule: ${scheduleId}`);

      return c.json({
        success: true,
        schedule,
        message: 'Subscription schedule created successfully'
      });

    } catch (error) {
      console.error('❌ [PACKAGE-SCHEDULE] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Subscription Package Scheduling endpoints registered');
}

