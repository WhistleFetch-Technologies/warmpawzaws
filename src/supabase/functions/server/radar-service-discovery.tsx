/**
 * RADAR-BASED SERVICE PROVIDER DISCOVERY
 * Production-Grade Implementation
 * 
 * Features:
 * - Distance-based service provider filtering
 * - Coverage area configuration per staff
 * - Real-time availability checking
 * - Commute time calculation
 * - Customer location-based filtering
 * - Multi-service provider availability validation
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';
import { calculateDistance } from './schedule-utils.tsx';

interface StaffDistanceConfig {
  staffId: string;
  maxDistance: number; // km
  coverageArea?: {
    center: { lat: number; lng: number };
    radius: number; // km
  };
  travelTimeBuffer: number; // minutes
}

interface ServiceProvider {
  staffId: string;
  staffName: string;
  vendorId: string;
  vendorName: string;
  roleId: string;
  distance: number;
  estimatedTravelTime: number;
  available: boolean;
  nextAvailableSlot?: string;
  services: any[];
  rating?: number;
  photo?: string;
}

export function radarServiceDiscoveryEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * GET /customer/discover-staff-by-radar
   * Discover service providers within configured distance coverage
   * 
   * Query params:
   * - roleId: required
   * - serviceStyle: at_home | at_center | tele
   * - customerLat, customerLng: required for home services
   * - serviceId: optional (filter by specific service)
   * - problemId: optional (filter by problem grid)
   * - date: optional (check availability for specific date)
   * - serviceDuration: optional (in minutes)
   */
  app.get(`${BASE}/customer/discover-staff-by-radar`, async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle') as 'at_home' | 'at_center' | 'tele' || 'at_home';
      const customerLat = parseFloat(c.req.query('customerLat') || '0');
      const customerLng = parseFloat(c.req.query('customerLng') || '0');
      const serviceId = c.req.query('serviceId');
      const problemId = c.req.query('problemId');
      const date = c.req.query('date');
      const serviceDuration = parseInt(c.req.query('serviceDuration') || '60');

      if (!roleId) {
        return c.json({ error: 'roleId is required' }, 400);
      }

      if (serviceStyle === 'at_home' && (!customerLat || !customerLng)) {
        return c.json({ error: 'customerLat and customerLng are required for home services' }, 400);
      }

      console.log(`📍 [RADAR] Discovering staff for role: ${roleId}, style: ${serviceStyle}`);

      // Get all vendors with this role
      const allVendors = await kv.getByPrefix('vendor:vendor_');
      const roleVendors = allVendors.filter((v: any) => {
        const vendorRoleId = v.roleId?.replace('role_', '').toLowerCase();
        const targetRoleId = roleId.replace('role_', '').toLowerCase();
        return vendorRoleId === targetRoleId && 
               v.status === 'approved' && 
               v.isActive !== false;
      });

      console.log(`   Found ${roleVendors.length} vendors with role ${roleId}`);

      const providers: ServiceProvider[] = [];

      for (const vendor of roleVendors) {
        const staffIds = await kv.get(`vendor:${vendor.id}:staff`) || [];

        for (const staffId of staffIds) {
          const staff = await kv.get(`staff:${staffId}`);
          if (!staff || !staff.isActive) continue;

          // Check service style availability
          const stylePrefs = await kv.get(`staff:${staffId}:style_preferences`) || {
            at_home: { enabled: false, available: false, maxDistance: 10 },
            at_center: { enabled: true, available: true },
            tele: { enabled: false, available: false }
          };

          const styleConfig = stylePrefs[serviceStyle];
          if (!styleConfig?.enabled || !styleConfig?.available) {
            continue;
          }

          // For home services: check distance
          if (serviceStyle === 'at_home') {
            const staffLocation = staff.lastKnownLocation || vendor.location;
            if (!staffLocation?.latitude || !staffLocation?.longitude) {
              continue;
            }

            const distance = calculateDistance(
              customerLat,
              customerLng,
              staffLocation.latitude,
              staffLocation.longitude
            );

            const maxDistance = styleConfig.maxDistance || 10;
            if (distance > maxDistance) {
              console.log(`   ⚠️ Staff ${staffId} too far: ${distance.toFixed(2)}km > ${maxDistance}km`);
              continue;
            }

            // Calculate travel time (2 minutes per km + buffer)
            const travelTime = Math.ceil(distance * 2) + (styleConfig.travelTimeBuffer || 0);

            // Get staff services
            const staffServices = staff.services || [];
            const activeServices = staffServices.filter((s: any) => s.isActive && s.publishStatus === 'published');

            // Filter by serviceId if provided
            if (serviceId) {
              const hasService = activeServices.some((s: any) => s.serviceId === serviceId);
              if (!hasService) continue;
            }

            // Check availability for date if provided
            let available = true;
            let nextAvailableSlot = null;
            if (date) {
              const availability = await checkStaffAvailability(
                staffId,
                date,
                serviceDuration,
                travelTime,
                serviceStyle
              );
              available = availability.available;
              nextAvailableSlot = availability.nextSlot;
            }

            providers.push({
              staffId: staff.id,
              staffName: staff.fullName || staff.name,
              vendorId: vendor.id,
              vendorName: vendor.businessName || vendor.fullName,
              roleId: vendor.roleId,
              distance: Math.round(distance * 10) / 10,
              estimatedTravelTime: travelTime,
              available,
              nextAvailableSlot,
              services: activeServices,
              rating: staff.rating || vendor.rating,
              photo: staff.photo || vendor.photos?.[0]
            });
          } else {
            // For center/tele: no distance check needed
            const staffServices = staff.services || [];
            const activeServices = staffServices.filter((s: any) => s.isActive && s.publishStatus === 'published');

            if (serviceId) {
              const hasService = activeServices.some((s: any) => s.serviceId === serviceId);
              if (!hasService) continue;
            }

            let available = true;
            let nextAvailableSlot = null;
            if (date) {
              const availability = await checkStaffAvailability(
                staffId,
                date,
                serviceDuration,
                0,
                serviceStyle
              );
              available = availability.available;
              nextAvailableSlot = availability.nextSlot;
            }

            providers.push({
              staffId: staff.id,
              staffName: staff.fullName || staff.name,
              vendorId: vendor.id,
              vendorName: vendor.businessName || vendor.fullName,
              roleId: vendor.roleId,
              distance: 0,
              estimatedTravelTime: 0,
              available,
              nextAvailableSlot,
              services: activeServices,
              rating: staff.rating || vendor.rating,
              photo: staff.photo || vendor.photos?.[0]
            });
          }
        }
      }

      // Sort by distance (for home services) or rating
      if (serviceStyle === 'at_home') {
        providers.sort((a, b) => a.distance - b.distance);
      } else {
        providers.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      }

      console.log(`✅ [RADAR] Found ${providers.length} available providers`);

      return c.json({
        success: true,
        providers,
        total: providers.length,
        filters: {
          roleId,
          serviceStyle,
          serviceId: serviceId || null,
          problemId: problemId || null,
          date: date || null
        }
      });

    } catch (error) {
      console.error('❌ [RADAR] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Check staff availability for a specific date and service
   */
  async function checkStaffAvailability(
    staffId: string,
    date: string,
    serviceDuration: number,
    travelTime: number,
    serviceStyle: string
  ): Promise<{ available: boolean; nextSlot: string | null }> {
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
      new Date(date).getDay()
    ];

    const staff = await kv.get(`staff:${staffId}`);
    if (!staff || !staff.availability) {
      return { available: false, nextSlot: null };
    }

    const dayAvailability = Array.isArray(staff.availability)
      ? staff.availability.find((a: any) => a.dayOfWeek === dayOfWeek)
      : null;

    if (!dayAvailability || !dayAvailability.timeWindows || dayAvailability.timeWindows.length === 0) {
      return { available: false, nextSlot: null };
    }

    // Get existing bookings
    const staffBookings = await kv.get(`staff:${staffId}:bookings`) || [];
    const dateBookings = [];
    for (const bookingId of staffBookings) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking && booking.scheduledDate === date) {
        dateBookings.push(booking);
      }
    }

    // Check for available slots
    const requiredTime = serviceDuration + travelTime + 30; // service + travel + buffer

    for (const window of dayAvailability.timeWindows) {
      if (!window.isEnabled) continue;

      const [startHour, startMin] = window.startTime.split(':').map(Number);
      const [endHour, endMin] = window.endTime.split(':').map(Number);

      let currentHour = startHour;
      let currentMin = startMin;

      while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
        const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
        const slotDateTime = new Date(date);
        slotDateTime.setHours(currentHour, currentMin, 0, 0);
        const slotEndTime = new Date(slotDateTime.getTime() + requiredTime * 60 * 1000);

        // Check if slot is in the past
        const now = new Date();
        if (slotDateTime < now) {
          currentMin += 30;
          if (currentMin >= 60) {
            currentMin -= 60;
            currentHour += 1;
          }
          continue;
        }

        // Check for conflicts
        const hasConflict = dateBookings.some((b: any) => {
          const bookingStart = new Date(`${date}T${b.scheduledTime || b.bookingTime}`);
          const bookingEnd = new Date(bookingStart.getTime() + (b.duration || 60) * 60 * 1000);
          return (slotDateTime < bookingEnd && slotEndTime > bookingStart);
        });

        // Check if sufficient time available
        const windowEnd = new Date(date);
        windowEnd.setHours(endHour, endMin, 0, 0);
        const hasSufficientTime = slotEndTime <= windowEnd;

        if (!hasConflict && hasSufficientTime) {
          return { available: true, nextSlot: timeStr };
        }

        currentMin += 30;
        if (currentMin >= 60) {
          currentMin -= 60;
          currentHour += 1;
        }
      }
    }

    return { available: false, nextSlot: null };
  }

  /**
   * POST /staff/:staffId/distance-config
   * Configure staff distance coverage for home services
   */
  app.post(`${BASE}/staff/:staffId/distance-config`, async (c) => {
    try {
      const { staffId } = c.req.param();
      const { maxDistance, coverageArea, travelTimeBuffer } = await c.req.json();

      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) {
        return c.json({ error: 'Staff not found' }, 404);
      }

      const stylePrefs = await kv.get(`staff:${staffId}:style_preferences`) || {
        at_home: { enabled: false, available: false, maxDistance: 10 },
        at_center: { enabled: true, available: true },
        tele: { enabled: false, available: false }
      };

      stylePrefs.at_home = {
        ...stylePrefs.at_home,
        maxDistance: maxDistance || stylePrefs.at_home.maxDistance || 10,
        travelTimeBuffer: travelTimeBuffer || stylePrefs.at_home.travelTimeBuffer || 0
      };

      if (coverageArea) {
        await kv.set(`staff:${staffId}:coverage_area`, coverageArea);
      }

      await kv.set(`staff:${staffId}:style_preferences`, stylePrefs);

      return c.json({
        success: true,
        message: 'Distance configuration updated',
        config: {
          maxDistance: stylePrefs.at_home.maxDistance,
          travelTimeBuffer: stylePrefs.at_home.travelTimeBuffer,
          coverageArea: coverageArea || null
        }
      });

    } catch (error) {
      console.error('❌ [RADAR] Error updating distance config:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Radar Service Discovery endpoints registered');
}

