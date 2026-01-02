import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

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

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { 
  getVendorsRepository,
  getBookingsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

export function multiServiceSchedulingEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // GET MULTI-SERVICE PROVIDER AVAILABILITY
  // ========================================
  app.get(`${BASE_PATH}/provider/:providerId/multi-service-availability`, async (c) => {
    try {
      const { providerId } = c.req.param();
      const date = c.req.query('date');
      const customerLat = parseFloat(c.req.query('lat') || '0');
      const customerLng = parseFloat(c.req.query('lng') || '0');

      if (!date) {
        return sendError(c, 'Date parameter required', 400);
      }

      console.log(`📅 Checking multi-service availability for provider ${providerId} on ${date}`);

      // ✅ SQL: Get provider details using repository
      const vendorsRepo = getVendorsRepository();
      const provider = await vendorsRepo.findById(providerId);
      if (!provider) {
        return sendError(c, 'Provider not found', 404);
      }

      // ✅ SQL: Get scheduling policy from vendor_settings table
      const db = getDbClient();
      const { data: policyRes } = await db
        .from('vendor_settings')
        .select('scheduling_policy')
        .eq('vendor_id', providerId)
        .single();
      const policyData = policyRes?.scheduling_policy || null;
      const policy: SchedulingPolicy = policyData || {
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

      // ✅ SQL: Get all provider's services from vendor_services table
      const db = getDbClient();
      const { data: vendorServicesData } = await db
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', providerId)
        .eq('is_enabled', true);
      
      const vendorServices = vendorServicesData || [];
      
      // ✅ SQL: Get all bookings for this provider on the requested date
      const bookingsRepo = getBookingsRepository();
      const allBookings = await bookingsRepo.findByVendor(providerId);
      const dateBookings = allBookings
        .filter((b: any) => {
          const bookingDate = b.scheduled_date || b.booking_date;
          const dateOnly = bookingDate ? bookingDate.split('T')[0] : null;
          return dateOnly === date && b.status !== 'cancelled';
        })
        .map((b: any) => ({
          scheduledDate: b.scheduled_date || b.booking_date,
          status: b.status,
          serviceType: b.service_type,
          commuteTime: b.commute_time || 0
        }));

      // Calculate commute time to customer
      let commuteTime = 15; // default
      if (customerLat && customerLng && provider.location) {
        const distance = calculateDistance(
          provider.location.lat,
          provider.location.lng,
          customerLat,
          customerLng
        );
        
        const speed = 20; // km/h
        const trafficMultiplier = policy.enableTrafficFactor ? 1.25 : 1.0;
        const baseCommute = (distance / speed) * 60;
        commuteTime = Math.ceil(baseCommute * trafficMultiplier + 5);
      }

      // Build time slots for each service type
      const serviceAvailability = [];

      for (const service of vendorServices) {
        const serviceType = service.serviceType || service.category;
        const serviceDuration = service.duration || 60;

        // Check conflicts for this service type
        const conflicts = await checkServiceTypeConflicts(
          providerId,
          serviceType,
          date,
          dateBookings,
          policy
        );

        // Generate available slots
        const availableSlots = generateAvailableSlots(
          dateBookings,
          serviceDuration,
          policy.bufferTimeBetweenServices,
          commuteTime,
          conflicts
        );

        serviceAvailability.push({
          serviceType,
          serviceName: service.name || service.serviceName,
          duration: serviceDuration,
          availableSlots: availableSlots.length,
          slots: availableSlots,
          conflicts: conflicts.length,
        });
      }

      // Calculate total daily travel time used
      let totalTravelTime = 0;
      for (const booking of dateBookings) {
        if (booking.commuteTime) {
          totalTravelTime += booking.commuteTime;
        }
      }

      const remainingTravelTime = policy.maxDailyTravelTime - totalTravelTime;
      const canAcceptBooking = remainingTravelTime >= commuteTime;

      console.log(`✅ Multi-service availability calculated: ${serviceAvailability.length} service types`);

      return sendSuccess(c, {
        providerId,
        date,
        serviceAvailability,
        policy: {
          multiServiceEnabled: policy.multiServiceEnabled,
          maxConcurrentServices: policy.maxConcurrentServices,
          bufferTimeBetweenServices: policy.bufferTimeBetweenServices,
          multiServiceSwitchBuffer: policy.multiServiceSwitchBuffer,
        },
        commuteTime,
        totalTravelTime,
        remainingTravelTime,
        canAcceptBooking,
        currentBookings: dateBookings.length,
      });

    } catch (error) {
      console.error('❌ Error checking multi-service availability:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Multi-Service Scheduling endpoints registered');
}

// ========================================
// HELPER: Calculate Distance (Haversine Formula)
// ========================================
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ========================================
// HELPER: Check Service Type Conflicts
// ========================================
async function checkServiceTypeConflicts(
  providerId: string,
  serviceType: string,
  date: string,
  dateBookings: any[],
  policy: SchedulingPolicy
): Promise<any[]> {
  const conflicts = [];

  for (const booking of dateBookings) {
    // Get booking service type
    const bookingServiceType = booking.serviceType;
    
    // Calculate time windows for existing booking
    const bookingStart = parseTime(booking.scheduledTime);
    const serviceDuration = booking.duration || 60;
    const bookingEnd = bookingStart + serviceDuration;

    // Add buffer time
    let buffer = policy.bufferTimeBetweenServices;
    
    // Add extra buffer if switching service types
    if (bookingServiceType !== serviceType) {
      buffer += policy.multiServiceSwitchBuffer || 0;
    }

    conflicts.push({
      bookingId: booking.id,
      startTime: bookingStart - buffer,
      endTime: bookingEnd + buffer,
      serviceType: bookingServiceType,
      requiresServiceSwitch: bookingServiceType !== serviceType,
    });
  }

  return conflicts;
}

// ========================================
// HELPER: Generate Available Slots
// ========================================
function generateAvailableSlots(
  dateBookings: any[],
  serviceDuration: number,
  buffer: number,
  commuteTime: number,
  conflicts: any[]
): string[] {
  const slots = [];
  const workStart = 8 * 60; // 8:00 AM in minutes
  const workEnd = 20 * 60; // 8:00 PM in minutes
  const slotInterval = 30; // Check every 30 minutes

  for (let time = workStart; time <= workEnd - serviceDuration; time += slotInterval) {
    const slotEnd = time + serviceDuration + buffer;
    
    // Check if slot conflicts with any existing booking
    let hasConflict = false;
    
    for (const conflict of conflicts) {
      if (!(slotEnd <= conflict.startTime || time >= conflict.endTime)) {
        hasConflict = true;
        break;
      }
    }

    if (!hasConflict) {
      slots.push(formatTime(time));
    }
  }

  return slots;
}

// ========================================
// HELPER: Time Parsing and Formatting
// ========================================
function parseTime(timeStr: string): number {
  // Parse time string like "09:00" or "09:00 - 10:00" to minutes
  const time = timeStr.split(' - ')[0].trim();
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}