/**
 * ============================================================================
 * GPS TRACKING API ENDPOINTS
 * ============================================================================
 * 
 * Real-time GPS tracking for home service visits
 * 
 * Fixes GAPs:
 * - HS-1: Live GPS Tracking Missing
 * - HS-2: ETA Calculation Not Dynamic
 * - HS-3: Start with GPS/ETA Button Missing
 * - HS-4: "Vendor on the way" Popup
 * - PH-5: Live Tracking with Google Maps
 * 
 * Date: 2026-01-21
 * Updated: 2026-01-29 - Added UAT mode fallback for missing coordinates
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query, insert, update } from '../database/rds-connection';
import { 
  gpsTrackingService, 
  startTracking, 
  updateLocation, 
  getTrackingStatus,
  getLocationHistory,
  completeTracking,
  calculateETA,
  Location,
} from '../lib/services/gps-tracking-service';
import { isUATMode } from '../lib/utils/uat-mode';
import { geocodeAddress } from '../lib/utils/geocode';

// Default/Mock coordinates for UAT mode (Mumbai central)
const UAT_DEFAULT_DESTINATION: Location = {
  latitude: 19.0760,
  longitude: 72.8777,
};

export function registerGpsTrackingEndpoints(app: Hono) {
  
  // ============================================
  // VENDOR/STAFF ENDPOINTS
  // ============================================

  /**
   * POST /tracking/start
   * Start GPS tracking for a booking (vendor/staff initiates journey)
   * Fixes GAP: HS-3 - Start with GPS/ETA button
   * 
   * UAT Mode: Uses mock destination if no address configured
   */
  app.post("/tracking/start", async (c) => {
    try {
      // Safe body parse to avoid unhandled rejection (prevents 503 from API Gateway)
      let body: Record<string, unknown>;
      try {
        const raw = await c.req.text();
        body = raw ? JSON.parse(raw) : {};
      } catch (parseErr) {
        return c.json({ error: 'Invalid JSON body. Send bookingId and vendorId.' }, 400);
      }
      const { 
        bookingId, 
        vendorId, 
        staffId,
        startLatitude,
        startLongitude,
      } = body as { bookingId?: string; vendorId?: string; staffId?: string; startLatitude?: number; startLongitude?: number };

      // Check UAT mode from headers or environment
      const uatMode = isUATMode({ 
        isUAT: false, 
        headers: Object.fromEntries(c.req.raw.headers.entries()) 
      });

      if (!bookingId || !vendorId) {
        return c.json({ error: 'bookingId and vendorId are required' }, 400);
      }

      // ✅ UAT MODE: Allow starting without current location (use mock)
      let startLocation: Location;
      if (startLatitude && startLongitude) {
        startLocation = {
          latitude: parseFloat(startLatitude),
          longitude: parseFloat(startLongitude),
        };
      } else if (uatMode) {
        // Use default Mumbai location in UAT mode
        startLocation = {
          latitude: 19.0596,  // Slightly different from destination for realistic ETA
          longitude: 72.8295,
        };
        console.log('[GPS Tracking] UAT Mode: Using mock start location');
      } else {
        return c.json({ error: 'Current location (startLatitude, startLongitude) is required' }, 400);
      }

      // Get booking to find destination
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Get destination: address_id → customer_addresses, then booking coords, then booking address fallback
      let destinationLocation: Location | null = null;

      if (booking.address_id) {
        const addresses = await select('customer_addresses', { id: booking.address_id });
        if (addresses.length > 0) {
          const addr = addresses[0] as any;
          const lat = addr.latitude ?? addr.coordinates?.lat ?? (typeof addr.coordinates === 'string' ? (() => { try { const c = JSON.parse(addr.coordinates); return c?.lat; } catch { return null; } })() : null);
          const lng = addr.longitude ?? addr.coordinates?.lng ?? (typeof addr.coordinates === 'string' ? (() => { try { const c = JSON.parse(addr.coordinates); return c?.lng; } catch { return null; } })() : null);
          if (lat != null && lng != null) {
            destinationLocation = { latitude: parseFloat(String(lat)), longitude: parseFloat(String(lng)) };
          } else if (addr.address || addr.full_address) {
            // Geocode customer address when it has text but no coords
            const geocoded = await geocodeAddress(addr.address || addr.full_address);
            if (geocoded) {
              destinationLocation = { latitude: geocoded.latitude, longitude: geocoded.longitude };
              console.log('[GPS Tracking] Geocoded customer_addresses to destination:', geocoded.latitude, geocoded.longitude);
            }
          }
        }
      }

      if (!destinationLocation && (booking.delivery_latitude != null && booking.delivery_longitude != null)) {
        destinationLocation = {
          latitude: parseFloat(String(booking.delivery_latitude)),
          longitude: parseFloat(String(booking.delivery_longitude)),
        };
      }

      // Booking main location (at_home: address is stored with latitude/longitude on booking)
      if (!destinationLocation && (booking.latitude != null && booking.longitude != null)) {
        destinationLocation = {
          latitude: parseFloat(String(booking.latitude)),
          longitude: parseFloat(String(booking.longitude)),
        };
      }

      // If booking has address text but no coords, geocode using Google Maps API for real destination
      if (!destinationLocation) {
        const addressText = booking.address || (booking as any).destination_address || 
          (booking as any).location || (booking as any).delivery_address || 
          (booking as any).customer_address;
        if (addressText) {
          const geocoded = await geocodeAddress(addressText);
          if (geocoded) {
            destinationLocation = { latitude: geocoded.latitude, longitude: geocoded.longitude };
            console.log('[GPS Tracking] Geocoded address to destination:', geocoded.latitude, geocoded.longitude);
          } else {
            console.log('[GPS Tracking] Geocoding failed; using default destination (address text present)');
            destinationLocation = { ...UAT_DEFAULT_DESTINATION };
          }
        }
      }

      // ✅ UAT MODE: Use mock destination if no address configured
      if (!destinationLocation) {
        if (uatMode) {
          console.log('[GPS Tracking] UAT Mode: Using mock destination (no address configured)');
          destinationLocation = { ...UAT_DEFAULT_DESTINATION };
        } else {
          return c.json({ error: 'No destination address configured for this booking' }, 400);
        }
      }

      // Start tracking session
      const session = await startTracking(
        bookingId,
        vendorId,
        staffId || null,
        startLocation,
        destinationLocation
      );

      // ✅ Update booking status to indicate vendor is on the way
      try {
        await update('bookings', { id: bookingId }, {
          status: 'vendor_on_way',
          vendor_departed_at: new Date().toISOString(),
        });
      } catch (e) {
        // Non-critical, status column might not exist
        console.warn('[GPS Tracking] Could not update booking status:', e);
      }

      // ✅ Send push notification to customer
      try {
        const { publishNotification } = await import('../utils/sns-client');
        await publishNotification({
          userId: booking.customer_id,
          userType: 'customer',
          type: 'vendor_on_the_way',
          title: 'Your service provider is on the way! 🚗',
          message: `Track their live location to know exactly when they'll arrive.`,
          data: {
            bookingId,
            sessionId: session.id,
            vendorId,
            action: 'track_live',
          },
        });
      } catch (notifError) {
        console.warn('[GPS Tracking] Failed to send notification:', notifError);
      }

      return c.json({
        success: true,
        session,
        uatMode: uatMode ? true : undefined,
        message: 'Tracking started. Customer has been notified.',
      });

    } catch (error: any) {
      console.error('Error starting tracking:', error);
      const msg = error?.message || '';
      // Return 503 with JSON so API Gateway does not replace with generic 503 (table missing / DB unavailable)
      if (msg.includes('relation') && msg.includes('does not exist')) {
        return c.json({
          error: 'Tracking service is being set up. Please try again in a few minutes.',
          code: 'TRACKING_UNAVAILABLE',
        }, 503);
      }
      if (msg.includes('connection') || msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
        return c.json({
          error: 'Service temporarily unavailable. Please try again.',
          code: 'SERVICE_UNAVAILABLE',
        }, 503);
      }
      return c.json({ error: msg || 'Failed to start tracking' }, 500);
    }
  });

  /**
   * POST /tracking/:sessionId/update
   * Update current location during transit
   * Called periodically by vendor/staff app
   */
  app.post("/tracking/:sessionId/update", async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { latitude, longitude, accuracy, heading, speed } = await c.req.json();

      if (!latitude || !longitude) {
        return c.json({ error: 'latitude and longitude are required' }, 400);
      }

      const result = await updateLocation(sessionId, {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? parseFloat(accuracy) : undefined,
        heading: heading ? parseFloat(heading) : undefined,
        speed: speed ? parseFloat(speed) : undefined,
        timestamp: new Date().toISOString(),
      });

      return c.json({
        success: true,
        eta: result.eta,
        distanceRemaining: result.distanceRemaining,
      });

    } catch (error: any) {
      console.error('Error updating location:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /tracking/:sessionId/arrived
   * Mark vendor as arrived at customer location
   */
  app.post("/tracking/:sessionId/arrived", async (c) => {
    try {
      const { sessionId } = c.req.param();

      const sessions = await select('gps_tracking_sessions', { id: sessionId });
    if (sessions.length === 0) {
        return c.json({ error: 'Tracking session not found' }, 404);
      }

      // Update session status to arrived
      await query(
        `UPDATE gps_tracking_sessions 
         SET status = 'arrived', arrived_at = NOW() 
         WHERE id = $1`,
        [sessionId]
      );

      // Update booking status
      await query(
        `UPDATE bookings 
         SET vendor_arrived_at = NOW() 
         WHERE id = $1`,
        [sessions[0].booking_id]
      );

      // Send notification to customer
      try {
        const { sendEventNotification } = await import('../lib/services/push-notification-service');
        await sendEventNotification({
          eventType: 'vendor_arrived',
          recipientId: sessions[0].customer_id,
          recipientType: 'customer',
          relatedId: sessions[0].booking_id,
          data: { bookingId: sessions[0].booking_id },
        });
      } catch (e) {
        console.warn('Failed to send arrival notification:', e);
      }

      return c.json({
        success: true,
        message: 'Arrival marked. Customer has been notified.',
      });

    } catch (error: any) {
      console.error('Error marking arrival:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /tracking/:sessionId/complete
   * Complete tracking session (service started at location)
   */
  app.post("/tracking/:sessionId/complete", async (c) => {
    try {
      const { sessionId } = c.req.param();

      await completeTracking(sessionId);

      return c.json({
        success: true,
        message: 'Tracking session completed.',
      });

    } catch (error: any) {
      console.error('Error completing tracking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /tracking/:sessionId/cancel
   * Cancel tracking session
   */
  app.post("/tracking/:sessionId/cancel", async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { reason } = await c.req.json();

      await query(
        `UPDATE gps_tracking_sessions 
         SET status = 'cancelled', cancellation_reason = $2, cancelled_at = NOW() 
         WHERE id = $1`,
        [sessionId, reason || null]
      );

      return c.json({
        success: true,
        message: 'Tracking session cancelled.',
      });

    } catch (error: any) {
      console.error('Error cancelling tracking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // CUSTOMER ENDPOINTS
  // ============================================

  /**
   * GET /tracking/booking/:bookingId
   * Get current tracking status for a booking
   * Fixes GAP: HS-4, PH-5 - Live tracking for customers
   */
  app.get("/tracking/booking/:bookingId", async (c) => {
    try {
      const { bookingId } = c.req.param();

      const status = await getTrackingStatus(bookingId);

      if (!status) {
        return c.json({
          success: true,
          tracking: null,
          message: 'No active tracking session for this booking',
        });
      }

      // Get vendor/staff name
      let providerName = 'Service Provider';
      if (status.staffId) {
        const staff = await select('staff', { id: status.staffId });
        if (staff.length > 0) {
          providerName = staff[0].name;
        }
      } else {
        const vendors = await select('vendors', { id: status.vendorId });
        if (vendors.length > 0) {
          providerName = vendors[0].business_name;
        }
      }

      return c.json({
        success: true,
      tracking: {
          ...status,
          providerName,
        },
      });

    } catch (error: any) {
      console.error('Error getting tracking status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /tracking/:sessionId/history
   * Get location history for route display
   */
  app.get("/tracking/:sessionId/history", async (c) => {
    try {
      const { sessionId } = c.req.param();

      const history = await getLocationHistory(sessionId);

      return c.json({
        success: true,
        history,
        count: history.length,
      });

    } catch (error: any) {
      console.error('Error getting location history:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /tracking/:sessionId/route
   * Get encoded polyline route for map display
   */
  app.get("/tracking/:sessionId/route", async (c) => {
    try {
      const { sessionId } = c.req.param();

      const sessions = await select('gps_tracking_sessions', { id: sessionId });
      if (sessions.length === 0) {
        return c.json({ error: 'Session not found' }, 404);
      }

      const session = sessions[0];

      return c.json({
        success: true,
        route: {
          polyline: session.route_polyline,
          startLocation: {
            latitude: parseFloat(session.start_latitude),
            longitude: parseFloat(session.start_longitude),
          },
          currentLocation: session.current_latitude ? {
            latitude: parseFloat(session.current_latitude),
            longitude: parseFloat(session.current_longitude),
          } : null,
          destinationLocation: {
            latitude: parseFloat(session.destination_latitude),
            longitude: parseFloat(session.destination_longitude),
          },
        },
      });

    } catch (error: any) {
      console.error('Error getting route:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // UTILITY ENDPOINTS
  // ============================================

  /**
   * POST /tracking/calculate-eta
   * Calculate ETA between two points
   */
  app.post("/tracking/calculate-eta", async (c) => {
    try {
      const { 
        originLatitude, 
        originLongitude, 
        destinationLatitude, 
        destinationLongitude 
      } = await c.req.json();

      if (!originLatitude || !originLongitude || !destinationLatitude || !destinationLongitude) {
        return c.json({ error: 'Origin and destination coordinates are required' }, 400);
      }

      const eta = await calculateETA(
        { latitude: parseFloat(originLatitude), longitude: parseFloat(originLongitude) },
        { latitude: parseFloat(destinationLatitude), longitude: parseFloat(destinationLongitude) }
      );

      return c.json({
        success: true,
        ...eta,
      });

    } catch (error: any) {
      console.error('Error calculating ETA:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /tracking/active
   * Get all active tracking sessions for a vendor
   */
  app.get("/tracking/active", async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const staffId = c.req.query('staffId');

      if (!vendorId && !staffId) {
        return c.json({ error: 'vendorId or staffId is required' }, 400);
      }

      let queryText = `
        SELECT gts.*, 
               b.booking_date, b.booking_time, b.service_type,
               c.name as customer_name, c.phone as customer_phone
        FROM gps_tracking_sessions gts
        JOIN bookings b ON gts.booking_id = b.id
        LEFT JOIN customers c ON gts.customer_id = c.id
        WHERE gts.status IN ('started', 'in_transit', 'arrived')
      `;
      const params: any[] = [];

      if (vendorId) {
        queryText += ` AND gts.vendor_id = $${params.length + 1}`;
        params.push(vendorId);
      }

      if (staffId) {
        queryText += ` AND gts.staff_id = $${params.length + 1}`;
        params.push(staffId);
      }

      queryText += ` ORDER BY gts.started_at DESC`;

      const result = await query(queryText, params);

      return c.json({
        success: true,
        sessions: (result as any).rows || [],
      });

    } catch (error: any) {
      console.error('Error getting active sessions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // CUSTOMER ACTIVE SESSIONS ENDPOINT
  // ============================================

  /**
   * GET /tracking/customer/:customerId/active
   * Get all active GPS tracking sessions for a customer
   * Returns sessions where vendor is en-route or has arrived
   * Fixes GAP: HS-4 - "Vendor on the way" popup
   */
  app.get("/tracking/customer/:customerId/active", async (c) => {
    try {
      const { customerId } = c.req.param();

      if (!customerId) {
        return c.json({ error: 'customerId is required' }, 400);
      }

      const queryText = `
        SELECT 
          gts.id as session_id,
          gts.booking_id,
          gts.vendor_id,
          gts.staff_id,
          gts.status,
          gts.current_latitude,
          gts.current_longitude,
          gts.destination_latitude,
          gts.destination_longitude,
          gts.estimated_eta_minutes,
          gts.distance_remaining_km,
          gts.started_at,
          gts.arrived_at,
          gts.last_update_at,
          b.service_type,
          b.booking_date,
          b.booking_time,
          COALESCE(s.name, v.business_name) as provider_name,
          COALESCE(s.phone, v.phone) as provider_phone,
          s.photo_url as provider_photo,
          svc.name as service_name,
          p.name as pet_name
        FROM gps_tracking_sessions gts
        JOIN bookings b ON gts.booking_id = b.id
        LEFT JOIN vendors v ON gts.vendor_id = v.id
        LEFT JOIN staff s ON gts.staff_id = s.id
        LEFT JOIN services svc ON b.service_id = svc.id
        LEFT JOIN pets p ON b.pet_id = p.id
        WHERE gts.customer_id = $1
          AND gts.status IN ('in_transit', 'arrived')
        ORDER BY gts.started_at DESC
      `;

      const result = await query(queryText, [customerId]);
      const sessions = (result as any).rows || [];

      // Format the response for the popup
      const activeSessions = sessions.map((session: any) => ({
        sessionId: session.session_id,
        bookingId: session.booking_id,
        vendorId: session.vendor_id,
        staffId: session.staff_id,
        status: session.status, // 'in_transit' or 'arrived'
        vendorName: session.provider_name || 'Service Provider',
        vendorPhone: session.provider_phone,
        vendorPhoto: session.provider_photo,
        serviceName: session.service_name || session.service_type || 'Service',
        petName: session.pet_name,
        eta: session.estimated_eta_minutes || null,
        distance: session.distance_remaining_km || null,
        currentLocation: session.current_latitude ? {
          latitude: parseFloat(session.current_latitude),
          longitude: parseFloat(session.current_longitude),
        } : null,
        destinationLocation: {
          latitude: parseFloat(session.destination_latitude),
          longitude: parseFloat(session.destination_longitude),
        },
        startedAt: session.started_at,
        arrivedAt: session.arrived_at,
        lastUpdateAt: session.last_update_at,
      }));

      return c.json({
        success: true,
        hasActiveTracking: activeSessions.length > 0,
        sessions: activeSessions,
        count: activeSessions.length,
      });

    } catch (error: any) {
      console.error('Error getting customer active sessions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /tracking/customer/phone/:phone/active
   * Get all active GPS tracking sessions for a customer by phone
   * Alternative endpoint using phone instead of customerId
   */
  app.get("/tracking/customer/phone/:phone/active", async (c) => {
    try {
      const { phone } = c.req.param();

      if (!phone) {
        return c.json({ error: 'phone is required' }, 400);
      }

      // First get customer ID from phone
      const customers = await select('customers', { phone: decodeURIComponent(phone) });
      if (customers.length === 0) {
        return c.json({
          success: true,
          hasActiveTracking: false,
          sessions: [],
          count: 0,
        });
      }

      const customerId = customers[0].id;

      const queryText = `
        SELECT 
          gts.id as session_id,
          gts.booking_id,
          gts.vendor_id,
          gts.staff_id,
          gts.status,
          gts.current_latitude,
          gts.current_longitude,
          gts.destination_latitude,
          gts.destination_longitude,
          gts.estimated_eta_minutes,
          gts.distance_remaining_km,
          gts.started_at,
          gts.arrived_at,
          gts.last_update_at,
          b.service_type,
          b.booking_date,
          b.booking_time,
          COALESCE(s.name, v.business_name) as provider_name,
          COALESCE(s.phone, v.phone) as provider_phone,
          s.photo_url as provider_photo,
          svc.name as service_name,
          p.name as pet_name
        FROM gps_tracking_sessions gts
        JOIN bookings b ON gts.booking_id = b.id
        LEFT JOIN vendors v ON gts.vendor_id = v.id
        LEFT JOIN staff s ON gts.staff_id = s.id
        LEFT JOIN services svc ON b.service_id = svc.id
        LEFT JOIN pets p ON b.pet_id = p.id
        WHERE gts.customer_id = $1
          AND gts.status IN ('in_transit', 'arrived')
        ORDER BY gts.started_at DESC
      `;

      const result = await query(queryText, [customerId]);
      const sessions = (result as any).rows || [];

      // Format the response for the popup
      const activeSessions = sessions.map((session: any) => ({
        sessionId: session.session_id,
        bookingId: session.booking_id,
        vendorId: session.vendor_id,
        staffId: session.staff_id,
        status: session.status, // 'in_transit' or 'arrived'
        vendorName: session.provider_name || 'Service Provider',
        vendorPhone: session.provider_phone,
        vendorPhoto: session.provider_photo,
        serviceName: session.service_name || session.service_type || 'Service',
        petName: session.pet_name,
        eta: session.estimated_eta_minutes || null,
        distance: session.distance_remaining_km || null,
        currentLocation: session.current_latitude ? {
          latitude: parseFloat(session.current_latitude),
          longitude: parseFloat(session.current_longitude),
        } : null,
        destinationLocation: {
          latitude: parseFloat(session.destination_latitude),
          longitude: parseFloat(session.destination_longitude),
        },
        startedAt: session.started_at,
        arrivedAt: session.arrived_at,
        lastUpdateAt: session.last_update_at,
      }));

      return c.json({
        success: true,
        hasActiveTracking: activeSessions.length > 0,
        sessions: activeSessions,
        count: activeSessions.length,
      });

    } catch (error: any) {
      console.error('Error getting customer active sessions by phone:', error);
      console.error('Error stack:', error?.stack);
      
      const errorMessage = error?.message || 'Unknown error';
      
      // ✅ FIX: Handle missing table gracefully - return empty sessions
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        console.log('[GPS Tracking] Table does not exist, returning empty sessions');
        return c.json({
          success: true,
          hasActiveTracking: false,
          sessions: [],
          count: 0,
        });
      }
      
      // ✅ FIX: Handle connection pool exhaustion
      if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
        return c.json({ 
          success: false, 
          error: 'Service temporarily busy. Please try again.',
          code: 'POOL_EXHAUSTED',
          hasActiveTracking: false,
          sessions: [],
          count: 0,
        }, 503);
      }
      
      // ✅ FIX: Return graceful fallback for any other errors
      return c.json({
        success: false,
        error: 'Unable to fetch tracking sessions',
        code: 'INTERNAL_ERROR',
        hasActiveTracking: false,
        sessions: [],
        count: 0,
      }, 500);
    }
  });
}
