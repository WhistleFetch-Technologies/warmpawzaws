import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🗓️ MULTI-SERVICE SCHEDULING SYSTEM
 * 
 * Phase 7C: Home Services Enhancement - Rule 2 Implementation
 * 
 * Features:
 * - Multi-service availability checking
 * - Buffer time management
 * - Service window calculation
 * - Scheduling policy configuration
 */

interface SchedulingPolicy {
  vendorId: string;
  bufferTimeBetweenServices: number; // minutes
  commuteTimeAllowance: number; // minutes
  serviceRadius: number; // km
  multiServiceEnabled: boolean;
  maxConcurrentServices: number;
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
      const policy = await kv.get(`scheduling_policy_${providerId}`);
      
      if (!policy || !policy.multiServiceEnabled) {
        return sendSuccess(c, { 
          isAvailable: false,
          reason: 'Provider does not support multi-service bookings',
        });
      }

      // Calculate total time needed
      let totalDuration = 0;
      let totalBufferTime = 0;
      
      for (const service of services) {
        // Get service duration
        const serviceData = await kv.get(`service_${service.serviceId}`);
        const duration = serviceData?.duration || service.duration || 60;
        
        totalDuration += duration;
        
        // Add buffer time between services (except for the last one)
        if (services.indexOf(service) < services.length - 1) {
          totalBufferTime += policy.bufferTimeBetweenServices || 15;
        }
      }

      // Add commute time if location provided
      let commuteTime = 0;
      if (customerLocation && customerLocation.lat && customerLocation.lng) {
        // Get provider location
        const provider = await kv.get(`vendor_${providerId}`);
        if (provider && provider.location) {
          // Calculate commute time (simplified - could use real traffic API)
          const distance = calculateDistance(
            provider.location.lat,
            provider.location.lng,
            customerLocation.lat,
            customerLocation.lng
          );
          commuteTime = Math.ceil(distance / 0.5); // Assume 30 km/h average speed
        }
      }

      const totalTime = totalDuration + totalBufferTime + commuteTime + (policy.commuteTimeAllowance || 0);

      // Check if provider has enough time in their schedule
      const requestedDateTime = new Date(`${requestedDate}T${requestedTime}`);
      const endDateTime = new Date(requestedDateTime.getTime() + totalTime * 60 * 1000);

      // Get provider's existing bookings for that day
      const bookingsData = await kv.getByPrefix(`booking_${providerId}_${requestedDate}`);
      
      // Check for conflicts
      let hasConflict = false;
      for (const item of bookingsData) {
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
  app.get(`${BASE_PATH}/home-services/scheduling-policy/:vendorId`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      const policy = await kv.get(`scheduling_policy_${vendorId}`);

      if (!policy) {
        // Return default policy
        return sendSuccess(c, {
          policy: {
            vendorId,
            bufferTimeBetweenServices: 15,
            commuteTimeAllowance: 15,
            serviceRadius: 10,
            multiServiceEnabled: true,
            maxConcurrentServices: 3,
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
  app.put(`${BASE_PATH}/home-services/scheduling-policy/:vendorId`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const updates = await c.req.json();

      const existing = await kv.get(`scheduling_policy_${vendorId}`);

      const policy: SchedulingPolicy = {
        vendorId,
        bufferTimeBetweenServices: updates.bufferTimeBetweenServices ?? existing?.bufferTimeBetweenServices ?? 15,
        commuteTimeAllowance: updates.commuteTimeAllowance ?? existing?.commuteTimeAllowance ?? 15,
        serviceRadius: updates.serviceRadius ?? existing?.serviceRadius ?? 10,
        multiServiceEnabled: updates.multiServiceEnabled ?? existing?.multiServiceEnabled ?? true,
        maxConcurrentServices: updates.maxConcurrentServices ?? existing?.maxConcurrentServices ?? 3,
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
  // CALCULATE SERVICE WINDOW
  // ========================================
  app.post(`${BASE_PATH}/home-services/calculate-service-window`, async (c) => {
    try {
      const {
        providerId,
        services,
        startTime,
        customerLocation,
      } = await c.req.json();

      if (!providerId || !services || !startTime) {
        return sendError(c, 'Required fields missing', 400);
      }

      // Get scheduling policy
      const policy = await kv.get(`scheduling_policy_${providerId}`);
      const bufferTime = policy?.bufferTimeBetweenServices || 15;
      const commuteTimeAllowance = policy?.commuteTimeAllowance || 15;

      // Calculate total duration
      let totalDuration = 0;
      for (const service of services) {
        totalDuration += service.duration || 60;
      }

      // Calculate total buffer time
      const totalBufferTime = (services.length - 1) * bufferTime;

      // Calculate commute time
      let commuteTime = commuteTimeAllowance;
      if (customerLocation) {
        const provider = await kv.get(`vendor_${providerId}`);
        if (provider?.location) {
          const distance = calculateDistance(
            provider.location.lat,
            provider.location.lng,
            customerLocation.lat,
            customerLocation.lng
          );
          commuteTime = Math.max(commuteTime, Math.ceil(distance / 0.5));
        }
      }

      const totalTime = totalDuration + totalBufferTime + commuteTime;

      const startDateTime = new Date(startTime);
      const endDateTime = new Date(startDateTime.getTime() + totalTime * 60 * 1000);

      const serviceWindow: ServiceWindow = {
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        duration: totalDuration,
        bufferTime: totalBufferTime,
        commuteTime,
        totalTime,
      };

      return sendSuccess(c, { serviceWindow });
    } catch (error) {
      console.error('Error calculating service window:', error);
      return sendError(c, error, 500);
    }
  });

  // Helper function
  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  console.log('✅ Multi-Service Scheduling endpoints registered');
}
