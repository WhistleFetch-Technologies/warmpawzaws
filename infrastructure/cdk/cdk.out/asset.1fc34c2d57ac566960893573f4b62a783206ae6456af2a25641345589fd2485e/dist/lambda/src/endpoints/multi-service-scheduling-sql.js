"use strict";
/**
 * ============================================================================
 * MULTI-SERVICE SCHEDULING SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()` with SQL repository calls
 * - Uses `vendors`, `vendor_services`, `bookings`, `scheduling_policies` tables
 *
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL
 * KV Operations Removed: 5
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiServiceSchedulingEndpoints = multiServiceSchedulingEndpoints;
const response_utils_1 = require("./response-utils");
const vendors_1 = require("../lib/repositories/vendors");
const services_1 = require("../lib/repositories/services");
const bookings_1 = require("../lib/repositories/bookings");
const db_1 = require("../lib/db");
function multiServiceSchedulingEndpoints(app) {
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
                return (0, response_utils_1.sendError)(c, 'Date parameter required', 400);
            }
            console.log(`📅 Checking multi-service availability for provider ${providerId} on ${date}`);
            // ✅ SQL: Get provider details
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const provider = await vendorsRepo.findById(providerId);
            if (!provider) {
                return (0, response_utils_1.sendError)(c, 'Provider not found', 404);
            }
            // ✅ SQL: Get scheduling policy from scheduling_policies table
            const policyResults = await (0, db_1.selectQuery)('scheduling_policies', {
                policy_name: `multi_service_${providerId}`,
                is_active: true
            });
            const policyData = policyResults[0] || null;
            const policy = policyData?.policy_config || {
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
            // ✅ SQL: Get all provider's services
            const servicesRepo = (0, services_1.getServicesRepository)();
            const vendorServices = await servicesRepo.findByVendor(providerId);
            // ✅ SQL: Get all bookings for this provider on the requested date
            const bookingsRepo = (0, bookings_1.getBookingsRepository)();
            const allBookings = await bookingsRepo.findByVendor(providerId);
            const dateBookings = allBookings.filter((b) => {
                const bookingDate = b.scheduled_date || b.scheduledDate;
                return bookingDate === date && b.status !== 'cancelled';
            });
            // Calculate commute time to customer
            let commuteTime = 15; // default
            if (customerLat && customerLng && provider.latitude && provider.longitude) {
                const lat = typeof provider.latitude === 'string' ? parseFloat(provider.latitude) : (provider.latitude || 0);
                const lng = typeof provider.longitude === 'string' ? parseFloat(provider.longitude) : (provider.longitude || 0);
                const distance = calculateDistance(lat, lng, parseFloat(customerLat.toString()), parseFloat(customerLng.toString()));
                const speed = 20; // km/h
                const trafficMultiplier = policy.enableTrafficFactor ? 1.25 : 1.0;
                const baseCommute = (distance / speed) * 60;
                commuteTime = Math.ceil(baseCommute * trafficMultiplier + 5);
            }
            // Build time slots for each service type
            const serviceAvailability = [];
            for (const service of vendorServices) {
                const serviceType = service.category || service.service_type;
                const serviceDuration = service.duration_minutes || service.duration || 60;
                // Check conflicts for this service type
                const conflicts = await checkServiceTypeConflicts(providerId, serviceType, date, dateBookings, policy);
                // Generate available slots
                const availableSlots = generateAvailableSlots(dateBookings, serviceDuration, policy.bufferTimeBetweenServices, commuteTime, conflicts);
                serviceAvailability.push({
                    serviceType,
                    serviceName: service.service_name || service.name,
                    duration: serviceDuration,
                    availableSlots: availableSlots.length,
                    slots: availableSlots,
                    conflicts: conflicts.length,
                });
            }
            // Calculate total daily travel time used
            let totalTravelTime = 0;
            for (const booking of dateBookings) {
                if (booking.commute_time) {
                    totalTravelTime += booking.commute_time;
                }
            }
            const remainingTravelTime = policy.maxDailyTravelTime - totalTravelTime;
            const canAcceptBooking = remainingTravelTime >= commuteTime;
            console.log(`✅ Multi-service availability calculated: ${serviceAvailability.length} service types`);
            return (0, response_utils_1.sendSuccess)(c, {
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
        }
        catch (error) {
            console.error('❌ Error checking multi-service availability:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ Multi-Service Scheduling endpoints registered (SQL-only)');
}
// ========================================
// HELPER: Calculate Distance (Haversine Formula)
// ========================================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRad(degrees) {
    return degrees * (Math.PI / 180);
}
// ========================================
// HELPER: Check Service Type Conflicts
// ========================================
async function checkServiceTypeConflicts(providerId, serviceType, date, dateBookings, policy) {
    const conflicts = [];
    for (const booking of dateBookings) {
        // Get booking service type
        const bookingServiceType = booking.service_type || booking.serviceType;
        // Calculate time windows for existing booking
        const bookingTime = booking.scheduled_time || booking.scheduledTime;
        const bookingStart = parseTime(bookingTime);
        const serviceDuration = booking.duration_minutes || booking.duration || 60;
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
function generateAvailableSlots(dateBookings, serviceDuration, buffer, commuteTime, conflicts) {
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
function parseTime(timeStr) {
    // Parse time string like "09:00" or "09:00 - 10:00" to minutes
    const time = timeStr.split(' - ')[0].trim();
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}
function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
//# sourceMappingURL=multi-service-scheduling-sql.js.map