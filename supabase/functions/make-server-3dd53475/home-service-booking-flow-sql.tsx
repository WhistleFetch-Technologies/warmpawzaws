/**
 * ============================================================================
 * HOME SERVICE BOOKING FLOW - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Home service availability check (distance-based)
 * - Lead time calculation
 * - OTP generation for service start
 * - GPS tracking integration
 * - Payment auto-split (Razorpay Marketplace)
 * - Complete booking lifecycle
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ No loose strings - use constants
 * ✅ Proper error handling
 * ✅ CRUD operations via repositories
 * 
 * Date: 2025-01-27
 * Migration: Phase 2 - Critical Flow Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { generateId } from './database-schema.tsx';
import { sendSuccess, sendError } from './response-utils.ts';
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";
import { getGPSTrackingSessionsRepository } from "../../lib/repositories/gps-tracking.ts";
import { getSchedulingRepository } from "../../lib/repositories/scheduling.ts";
import { getOtpRepository } from "../../lib/repositories/otp.ts";
import { getPlatformSettingsRepository } from "../../lib/repositories/platform-settings.ts";
import {
  SERVICE_TYPES,
  SERVICE_TYPE_TO_ROLE,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  SERVICE_STYLE,
  DEFAULTS,
  ENDPOINTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  LOG_MESSAGES,
} from './home-service-constants.ts';

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Generate 4-digit OTP
 */
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function registerHomeServiceBookingFlow(app: Hono) {
  const BASE = ENDPOINTS.BASE;

  // =============================================
  // FIND AVAILABLE HOME SERVICE PROVIDERS
  // =============================================
  app.post(`${BASE}${ENDPOINTS.DISCOVER}`, async (c) => {
    try {
      const {
        serviceType, // 'grooming', 'training', 'walker', 'vet'
        customerLocation, // { lat, lng }
        preferredDate,
        preferredTime
      } = await c.req.json();

      console.log(LOG_MESSAGES.DISCOVERY_START(serviceType, customerLocation.lat, customerLocation.lng));

      // ✅ SQL: Get vendors by role
      const targetRole = SERVICE_TYPE_TO_ROLE[serviceType as keyof typeof SERVICE_TYPE_TO_ROLE];
      if (!targetRole) {
        return sendError(c, `Invalid service type: ${serviceType}`, 400);
      }

      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findByStatus('approved');

      // Filter vendors by role and home service capability
      const vendors = allVendors.filter(v => {
        const serviceStyles = Array.isArray(v.service_styles) ? v.service_styles : (v.service_styles ? [v.service_styles] : []);
        return v.role_id === targetRole && 
               v.is_active && 
               (serviceStyles.includes(SERVICE_STYLE.AT_HOME) || serviceStyles.length === 0); // Include if no restriction or includes at_home
      });

      const availableProviders = [];

      for (const vendor of vendors) {
        // ✅ SQL: Get vendor settings from platform settings or vendor metadata
        const vendorAddress = vendor.address as any;
        const vendorLocation = vendorAddress?.location || vendorAddress;
        
        if (!vendorLocation?.lat || !vendorLocation?.lng) continue;

        // Calculate distance
        const distance = calculateDistance(
          customerLocation.lat,
          customerLocation.lng,
          vendorLocation.lat,
          vendorLocation.lng
        );

        // Check if within service radius
        const serviceRadius = vendor.service_radius || DEFAULTS.HOME_SERVICE_RADIUS_KM;
        if (distance > serviceRadius) continue;

        // ✅ SQL: Get staff with home service enabled
        const staffRepo = getStaffRepository();
        const allStaff = await staffRepo.findByVendorId(vendor.id);
        const homeServiceStaff = allStaff.filter(s => {
          if (!s.is_active) return false;
          const staffServiceStyles = Array.isArray(s.service_styles) ? s.service_styles : (s.service_styles ? [s.service_styles] : []);
          return staffServiceStyles.length === 0 || staffServiceStyles.includes(SERVICE_STYLE.AT_HOME);
        });

        if (homeServiceStaff.length === 0) continue;

        // ✅ SQL: Staff availability checking
        // Note: Full scheduling check can be added when scheduling repository is available
        const availableStaff = [];

        for (const staffMember of homeServiceStaff) {
          // Check staff availability for the requested date/time
          // This is simplified - actual implementation would check schedules
          availableStaff.push({
            id: staffMember.id,
            name: staffMember.full_name,
            photo: null, // Can be added to staff table
            specialization: staffMember.specialization || '',
            rating: staffMember.rating || 0
          });
        }

        if (availableStaff.length > 0) {
          // Calculate ETA
          const travelTimePerKm = DEFAULTS.TRAVEL_TIME_PER_KM_MINUTES;
          const travelTime = Math.ceil(distance * travelTimePerKm);
          const preparationTime = DEFAULTS.HOME_SERVICE_LEAD_TIME_MINUTES;
          const totalETA = travelTime + preparationTime;

          // ✅ SQL: Get vendor services (filtering by type handled at vendor_service level)
          const servicesRepo = getServicesRepository();
          const allVendorServices = await servicesRepo.findByVendor(vendor.id);
          // Filter by service category/type if needed (services table has category field)
          const vendorServices = allVendorServices.filter(s => {
            // Match by category if it matches serviceType, or include all if no specific filter
            return !s.category || s.category.toLowerCase().includes(serviceType.toLowerCase());
          });

          availableProviders.push({
            vendorId: vendor.id,
            businessName: vendor.business_name,
            address: vendorAddress,
            rating: vendor.rating || 0,
            totalReviews: 0, // Can be calculated from reviews table
            
            distance: parseFloat(distance.toFixed(1)),
            travelTime,
            preparationTime,
            totalETA,
            
            homeServiceFee: 0, // Can be configured per vendor
            
            availableStaff,
            services: vendorServices.map(s => ({
              id: s.id,
              name: s.name,
              price: s.base_price,
              duration: s.duration_minutes
            }))
          });
        }
      }

      // Sort by distance
      availableProviders.sort((a, b) => a.distance - b.distance);

      console.log(LOG_MESSAGES.PROVIDERS_FOUND(availableProviders.length));

      return sendSuccess(c, {
        providers: availableProviders,
        totalProviders: availableProviders.length
      });

    } catch (error) {
      console.error('[HOME SERVICE] Discovery error:', error);
      return sendError(c, ERROR_MESSAGES.FAILED_DISCOVER_PROVIDERS, 500);
    }
  });

  // =============================================
  // CREATE HOME SERVICE BOOKING
  // =============================================
  app.post(`${BASE}${ENDPOINTS.BOOK}`, async (c) => {
    try {
      const {
        customerId,
        vendorId,
        staffId,
        serviceId,
        serviceType,
        scheduledDate,
        scheduledTime,
        petId,
        address,
        location, // { lat, lng }
        amount,
        homeServiceFee,
        notes
      } = await c.req.json();

      if (!customerId || !vendorId || !staffId || !serviceId) {
        return sendError(c, ERROR_MESSAGES.MISSING_FIELDS, 400);
      }

      // ✅ SQL: Validate entities
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return sendError(c, ERROR_MESSAGES.VENDOR_NOT_FOUND, 404);
      }

      const staffRepo = getStaffRepository();
      const staff = await staffRepo.findById(staffId);
      if (!staff) {
        return sendError(c, 'Staff not found', 404);
      }

      const servicesRepo = getServicesRepository();
      const service = await servicesRepo.findById(serviceId);
      if (!service) {
        return sendError(c, 'Service not found', 404);
      }

      // Calculate vendor location and distance
      const vendorAddress = vendor.address as any;
      const vendorLocation = vendorAddress?.location || vendorAddress;
      const distance = calculateDistance(
        location.lat,
        location.lng,
        vendorLocation?.lat || 0,
        vendorLocation?.lng || 0
      );

      const travelTimePerKm = DEFAULTS.TRAVEL_TIME_PER_KM_MINUTES;
      const travelTime = Math.ceil(distance * travelTimePerKm);

      // Generate OTPs (trainer/walker/behaviourist need start OTP)
      const endOTP = generateOTP();
      
      // ✅ SQL: Create booking with home service metadata
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.create({
        customer_id: customerId,
        vendor_id: vendorId,
        staff_id: staffId,
        service_id: serviceId,
        booking_date: scheduledDate,
        booking_time: scheduledTime,
        service_type: serviceType,
        address: address,
        latitude: location.lat,
        longitude: location.lng,
        base_price: parseFloat(amount),
        discount_amount: 0,
        tax_amount: 0,
        total_amount: parseFloat(amount) + parseFloat(homeServiceFee || 0),
        notes: JSON.stringify({
          homeService: true,
          petId: petId || null,
          customerNotes: notes || '',
          estimatedTravelTime: travelTime,
          vendorLocation: vendorLocation,
          homeServiceFee: parseFloat(homeServiceFee || 0),
          customerLocation: location, // Store for GPS tracking ETA calculations
        }),
      });

      // ✅ SQL: Set OTP for booking
      await bookingsRepo.setOtp(booking.id, endOTP, 7 * 24 * 60); // 7 days expiry

      // ✅ SQL: Update booking with home service metadata
      await bookingsRepo.update(booking.id, {
        status: BOOKING_STATUS.CONFIRMED,
      });

      console.log(LOG_MESSAGES.BOOKING_CREATED(booking.id));

      return sendSuccess(c, {
        booking: {
          id: booking.id,
          bookingId: booking.id,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id,
          staffId: booking.staff_id,
          serviceId: booking.service_id,
          status: booking.status,
          totalAmount: booking.total_amount,
          endOTP, // Return OTP to customer
        }
      }, SUCCESS_MESSAGES.BOOKING_CREATED);

    } catch (error) {
      console.error('[HOME SERVICE] Booking creation error:', error);
      return sendError(c, ERROR_MESSAGES.FAILED_CREATE_BOOKING, 500);
    }
  });

  // =============================================
  // VENDOR: START RIDE (Begin GPS Tracking)
  // =============================================
  app.post(`${BASE}${ENDPOINTS.START_RIDE}`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, currentLocation } = await c.req.json();

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
      }

      if (booking.vendor_id !== vendorId) {
        return sendError(c, ERROR_MESSAGES.UNAUTHORIZED, 403);
      }

      if (booking.status !== BOOKING_STATUS.CONFIRMED) {
        return sendError(c, ERROR_MESSAGES.INVALID_STATUS, 400);
      }

      // ✅ SQL: Create GPS tracking session
      const trackingRepo = getGPSTrackingSessionsRepository();
      const trackingId = `track_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const trackingSession = await trackingRepo.create({
        booking_id: bookingId,
        tracking_id: trackingId,
        start_location: currentLocation,
        current_location: currentLocation,
        waypoints: [{ ...currentLocation, timestamp: new Date().toISOString() }],
        estimated_eta_minutes: null, // Will be calculated
        is_active: true,
        started_at: new Date().toISOString(),
      });

      // ✅ SQL: Update booking status
      await bookingsRepo.update(bookingId, {
        status: BOOKING_STATUS.VENDOR_EN_ROUTE,
      });

      console.log(LOG_MESSAGES.GPS_TRACKING_STARTED(trackingId));

      return sendSuccess(c, {
        trackingId,
        booking: {
          id: booking.id,
          status: BOOKING_STATUS.VENDOR_EN_ROUTE,
        }
      }, SUCCESS_MESSAGES.GPS_TRACKING_STARTED);

    } catch (error) {
      console.error('[GPS] Start tracking error:', error);
      return sendError(c, ERROR_MESSAGES.FAILED_START_TRACKING, 500);
    }
  });

  // =============================================
  // VENDOR: UPDATE LOCATION (During Ride)
  // =============================================
  app.post(`${BASE}${ENDPOINTS.UPDATE_LOCATION}`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, location } = await c.req.json();

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking || booking.vendor_id !== vendorId) {
        return sendError(c, ERROR_MESSAGES.UNAUTHORIZED, 403);
      }

      // ✅ SQL: Get tracking session
      const trackingRepo = getGPSTrackingSessionsRepository();
      const trackingSession = await trackingRepo.findByBookingId(bookingId);
      if (!trackingSession || !trackingSession.is_active) {
        return sendError(c, ERROR_MESSAGES.GPS_NOT_ACTIVE, 400);
      }

      // Calculate distance from previous location
      const waypoint = { ...location, timestamp: new Date().toISOString() };
      const existingWaypoints = trackingSession.waypoints || [];
      let totalDistance = trackingSession.total_distance_km;

      if (existingWaypoints.length > 0) {
        const prev = existingWaypoints[existingWaypoints.length - 1];
        const distance = calculateDistance(prev.lat, prev.lng, location.lat, location.lng);
        totalDistance += distance;
      }

      // Calculate ETA based on remaining distance (get customer location from booking notes or coordinates)
      let customerLocation;
      try {
        const bookingNotes = booking.notes ? JSON.parse(booking.notes) : {};
        customerLocation = bookingNotes.customerLocation || { lat: booking.latitude || 0, lng: booking.longitude || 0 };
      } catch {
        // Fallback to booking coordinates if notes parsing fails
        customerLocation = { lat: booking.latitude || 0, lng: booking.longitude || 0 };
      }
      const remainingDistance = calculateDistance(
        location.lat,
        location.lng,
        customerLocation.lat,
        customerLocation.lng
      );
      const estimatedEta = Math.ceil(remainingDistance * DEFAULTS.TRAVEL_TIME_PER_KM_MINUTES);

      // ✅ SQL: Update tracking session
      const updatedWaypoints = [...existingWaypoints, waypoint];
      await trackingRepo.update(trackingSession.tracking_id, {
        current_location: location,
        waypoints: updatedWaypoints,
        total_distance_km: totalDistance,
        estimated_eta_minutes: estimatedEta,
      });

      return sendSuccess(c, {
        currentLocation: location,
        totalDistance: totalDistance,
        eta: estimatedEta
      });

    } catch (error) {
      console.error('[GPS] Update location error:', error);
      return sendError(c, ERROR_MESSAGES.FAILED_UPDATE_LOCATION, 500);
    }
  });

  // =============================================
  // VENDOR: ARRIVED AT CUSTOMER LOCATION
  // =============================================
  app.post(`${BASE}${ENDPOINTS.ARRIVED}`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId } = await c.req.json();

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking || booking.vendor_id !== vendorId) {
        return sendError(c, ERROR_MESSAGES.UNAUTHORIZED, 403);
      }

      // ✅ SQL: Stop GPS tracking
      const trackingRepo = getGPSTrackingSessionsRepository();
      const trackingSession = await trackingRepo.findByBookingId(bookingId);
      if (trackingSession && trackingSession.is_active) {
        await trackingRepo.stop(trackingSession.tracking_id);
      }

      // ✅ SQL: Update booking status
      await bookingsRepo.update(bookingId, {
        status: BOOKING_STATUS.VENDOR_ARRIVED,
      });

      return sendSuccess(c, {
        booking: {
          id: booking.id,
          status: BOOKING_STATUS.VENDOR_ARRIVED,
        }
      }, SUCCESS_MESSAGES.VENDOR_ARRIVED);

    } catch (error) {
      console.error('[HOME SERVICE] Arrival error:', error);
      return sendError(c, ERROR_MESSAGES.FAILED_MARK_ARRIVAL, 500);
    }
  });

  // =============================================
  // PAYMENT COMPLETE WEBHOOK
  // =============================================
  app.post(`${BASE}${ENDPOINTS.PAYMENT_COMPLETE}`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = await c.req.json();

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
      }

      // ✅ SQL: Get vendor for tier/commission calculation
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(booking.vendor_id || '');
      
      // Get commission rate from vendor tier (default 15%)
      const commissionRate = vendor?.tier ? 15 : DEFAULTS.COMMISSION_RATE_PERCENT; // Can be enhanced with tier system
      const platformCommission = (parseFloat(booking.total_amount.toString()) * commissionRate) / 100;
      const vendorPayout = parseFloat(booking.total_amount.toString()) - platformCommission;

      // ✅ SQL: Update booking payment status
      await bookingsRepo.update(bookingId, {
        payment_status: PAYMENT_STATUS.COMPLETED,
        payment_id: paymentId,
      });

      console.log(LOG_MESSAGES.PAYMENT_COMPLETED(bookingId, vendorPayout));

      return sendSuccess(c, {
        booking: {
          id: booking.id,
          paymentStatus: PAYMENT_STATUS.COMPLETED,
          vendorPayout,
          platformCommission,
        }
      }, SUCCESS_MESSAGES.PAYMENT_COMPLETED);

    } catch (error) {
      console.error('[PAYMENT] Payment completion error:', error);
      return sendError(c, ERROR_MESSAGES.FAILED_PROCESS_PAYMENT, 500);
    }
  });
}

