import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🗓️ MULTI-SERVICE SCHEDULING SYSTEM ENHANCED
 * 
 * Phase 7C: Home Services Enhancement - Rule 2 Implementation
 * 
 * Features:
 * - Multi-service availability checking with enhanced buffer and traffic logic
 * - Buffer time management with multi-service switch buffers
 * - Service window calculation
 * - Scheduling policy configuration
 * - Package schedule windows
 * - Commute time with traffic factors
 */

interface SchedulingPolicy {
  vendorId: string;
  bufferTimeBetweenServices: number; // minutes
  multiServiceSwitchBuffer: number; // minutes (extra buffer when switching service types)
  commuteTimeAllowance: number; // minutes per km
  serviceRadius: number; // km
  multiServiceEnabled: boolean;
  maxConcurrentServices: number;
  enableTrafficFactor: boolean;
  maxDailyTravelTime: number; // minutes
  createdAt: string;
  updatedAt: string;
}

interface ServiceWindow {
  startTime: string;
  endTime: string;
  duration: number;
  bufferTime: number;
  commuteTime: number;
  totalTime: number;
}

export function multiServiceSchedulingEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // CHECK MULTI-SERVICE AVAILABILITY
  // ========================================
  app.post(`${BASE_PATH}/home-services/check-multi-service-availability`, async (c) => {
    try {
      const {
        providerId,
        requestedDate,
        requestedTime,
        services,
        customerLocation,
      } = await c.req.json();

      if (!providerId || !requestedDate || !services || services.length === 0) {
        return sendError(c, 'Required fields missing', 400);
      }

      // Get provider's scheduling policy
      const policyRes = await kv.get(`scheduling_policy_${providerId}`);
      
      // Default policy if none exists
      const policy: SchedulingPolicy = policyRes || {
        vendorId: providerId,
        bufferTimeBetweenServices: 15,
        multiServiceSwitchBuffer: 10,
        commuteTimeAllowance: 3,
        serviceRadius: 10,
        multiServiceEnabled: true,
        maxConcurrentServices: 3,
        enableTrafficFactor: true,
        maxDailyTravelTime: 120,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (!policy.multiServiceEnabled && services.length > 1) {
        return sendSuccess(c, { 
          isAvailable: false,
          reason: 'Provider does not support multi-service bookings',
        });
      }

      // 1. Check Radius
      if (customerLocation && customerLocation.lat && customerLocation.lng) {
          const provider = await kv.get(`vendor_${providerId}`);
          if (provider && provider.location) {
              const distance = calculateDistance(
                  provider.location.lat, provider.location.lng,
                  customerLocation.lat, customerLocation.lng
              );
              if (distance > policy.serviceRadius) {
                  return sendSuccess(c, {
                      isAvailable: false,
                      reason: `Location is outside service radius (${policy.serviceRadius} km)`,
                      distance
                  });
              }
          }
      }

      // 2. Calculate total time needed
      let totalDuration = 0;
      let totalBufferTime = 0;
      let previousServiceType = '';

      for (let i = 0; i < services.length; i++) {
        const service = services[i];
        // Get service duration
        const serviceData = await kv.get(`service_${service.serviceId}`);
        const duration = serviceData?.duration || service.duration || 60;
        const serviceType = serviceData?.serviceType || service.serviceType || 'general';

        totalDuration += duration;
        
        // Add buffer time between services
        if (i < services.length - 1) {
          let buffer = policy.bufferTimeBetweenServices;
          // Add extra buffer if switching service types (e.g. Grooming to Walking)
          if (previousServiceType && serviceType !== previousServiceType) {
              buffer += (policy.multiServiceSwitchBuffer || 0);
          }
          totalBufferTime += buffer;
        }
        previousServiceType = serviceType;
      }

      // 3. Add commute time
      let commuteTime = 0;
      if (customerLocation && customerLocation.lat && customerLocation.lng) {
        const provider = await kv.get(`vendor_${providerId}`);
        if (provider && provider.location) {
          const distance = calculateDistance(
            provider.location.lat,
            provider.location.lng,
            customerLocation.lat,
            customerLocation.lng
          );
          
          // Enhanced commute calculation
          const speed = 20; // km/h base speed
          const trafficMultiplier = policy.enableTrafficFactor ? 1.25 : 1.0; // 25% traffic buffer
          const baseCommute = (distance / speed) * 60; // minutes
          commuteTime = Math.ceil(baseCommute * trafficMultiplier + 5); // +5 min parking/entry buffer
        }
      } else {
          // Fallback if no location
          commuteTime = 15; 
      }

      const totalTime = totalDuration + totalBufferTime + commuteTime;

      // 4. Check Provider Schedule
      const requestedDateTime = new Date(`${requestedDate}T${requestedTime}`);
      const endDateTime = new Date(requestedDateTime.getTime() + totalTime * 60 * 1000);

      // Get provider's existing bookings for that day
      const bookingsData = await kv.getByPrefix(`booking_${providerId}_${requestedDate}`);
      
      // Check for conflicts
      let hasConflict = false;
      for (const item of bookingsData || []) {
        const booking = item.value || item;
        const bookingStart = new Date(booking.scheduledAt);
        const bookingEnd = new Date(bookingStart.getTime() + (booking.duration || 60) * 60 * 1000);

        // Check overlap
        if (
          (requestedDateTime >= bookingStart && requestedDateTime < bookingEnd) ||
          (endDateTime > bookingStart && endDateTime <= bookingEnd) ||
          (requestedDateTime <= bookingStart && endDateTime >= bookingEnd)
        ) {
          hasConflict = true;
          break;
        }
      }

      const isAvailable = !hasConflict;

      console.log(`✅ Multi-service availability check: ${isAvailable ? 'Available' : 'Unavailable'}`);

      return sendSuccess(c, {
        isAvailable,
        totalDuration,
        totalBufferTime,
        commuteTime,
        totalTime,
        estimatedEndTime: endDateTime.toISOString(),
        serviceBreakdown: services.map((s: any) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          duration: s.duration,
        })),
      });
    } catch (error) {
      console.error('Error checking multi-service availability:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET SCHEDULING POLICY
  // ========================================
  app.get(`${BASE_PATH}/vendor/:vendorId/scheduling-policy`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const policy = await kv.get(`scheduling_policy_${vendorId}`);

      if (!policy) {
        // Return default policy
        return sendSuccess(c, {
          policy: {
            vendorId,
            bufferTimeBetweenServices: 15,
            multiServiceSwitchBuffer: 10,
            commuteTimeAllowance: 3,
            serviceRadius: 10,
            multiServiceEnabled: true,
            maxConcurrentServices: 3,
            enableTrafficFactor: true,
            maxDailyTravelTime: 120,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }

      return sendSuccess(c, { policy });
    } catch (error) {
      console.error('Error getting scheduling policy:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // UPDATE SCHEDULING POLICY
  // ========================================
  app.put(`${BASE_PATH}/vendor/:vendorId/scheduling-policy`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const updates = await c.req.json();
      const existing = await kv.get(`scheduling_policy_${vendorId}`);

      const policy: SchedulingPolicy = {
        vendorId,
        bufferTimeBetweenServices: updates.bufferTimeBetweenServices ?? existing?.bufferTimeBetweenServices ?? 15,
        multiServiceSwitchBuffer: updates.multiServiceSwitchBuffer ?? existing?.multiServiceSwitchBuffer ?? 10,
        commuteTimeAllowance: updates.commuteTimeAllowance ?? existing?.commuteTimeAllowance ?? 3,
        serviceRadius: updates.serviceRadius ?? existing?.serviceRadius ?? 10,
        multiServiceEnabled: updates.multiServiceEnabled ?? existing?.multiServiceEnabled ?? true,
        maxConcurrentServices: updates.maxConcurrentServices ?? existing?.maxConcurrentServices ?? 3,
        enableTrafficFactor: updates.enableTrafficFactor ?? existing?.enableTrafficFactor ?? true,
        maxDailyTravelTime: updates.maxDailyTravelTime ?? existing?.maxDailyTravelTime ?? 120,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`scheduling_policy_${vendorId}`, policy);
      console.log(`✅ Scheduling policy updated for vendor ${vendorId}`);

      return sendSuccess(c, { policy }, 'Scheduling policy updated successfully');
    } catch (error) {
      console.error('Error updating scheduling policy:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // CALCULATE COMMUTE TIME (Enhanced)
  // ========================================
  app.post(`${BASE_PATH}/home-services/calculate-commute-time`, async (c) => {
      try {
          const { origin, destination, enableTraffic } = await c.req.json();
          if (!origin || !destination) {
              return sendError(c, 'Origin and destination required', 400);
          }

          const distance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
          
          // Enhanced calculation logic
          // City driving assumption: 20km/h average
          let speed = 20; 
          let trafficFactor = enableTraffic ? 1.3 : 1.0; // 30% delay for traffic
          
          // Adjust speed for longer distances (highway assumption)
          if (distance > 10) speed = 30;
          if (distance > 30) speed = 40;

          const baseTime = (distance / speed) * 60;
          const totalTime = Math.ceil(baseTime * trafficFactor + 5); // +5 min fixed buffer

          return sendSuccess(c, {
              distanceKM: parseFloat(distance.toFixed(2)),
              estimatedMinutes: totalTime,
              trafficFactorApplied: enableTraffic
          });

      } catch (error) {
          console.error('Error calculating commute:', error);
          return sendError(c, error, 500);
      }
  });

  // ========================================
  // GET PACKAGE SCHEDULE WINDOWS
  // ========================================
  app.get(`${BASE_PATH}/home-services/packages/:packageId/schedule-windows`, async (c) => {
      try {
          const packageId = c.req.param('packageId');
          // In a real app, we would fetch package-specific config
          // For now, return standard windows
          return sendSuccess(c, {
              windows: [
                  { id: 'morning', label: 'Morning', start: '08:00', end: '12:00', icon: 'morning' },
                  { id: 'afternoon', label: 'Afternoon', start: '12:00', end: '16:00', icon: 'afternoon' },
                  { id: 'evening', label: 'Evening', start: '16:00', end: '20:00', icon: 'evening' }
              ]
          });
      } catch (error) {
          return sendError(c, error, 500);
      }
  });

  // Helper function
  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Radius of earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  console.log('✅ Multi-Service Scheduling Enhanced endpoints registered');
}
