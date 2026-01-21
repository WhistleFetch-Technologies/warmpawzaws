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
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, query } from '../database/rds-connection';
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

export function registerGpsTrackingEndpoints(app: Hono) {
  
  // ============================================
  // VENDOR/STAFF ENDPOINTS
  // ============================================

  /**
   * POST /tracking/start
   * Start GPS tracking for a booking (vendor/staff initiates journey)
   * Fixes GAP: HS-3 - Start with GPS/ETA button
   */
  app.post("/tracking/start", async (c) => {
    try {
      const { 
        bookingId, 
        vendorId, 
        staffId,
        startLatitude,
        startLongitude,
      } = await c.req.json();

    if (!bookingId || !vendorId) {
        return c.json({ error: 'bookingId and vendorId are required' }, 400);
      }

      if (!startLatitude || !startLongitude) {
        return c.json({ error: 'Current location (startLatitude, startLongitude) is required' }, 400);
      }

      // Get booking to find destination
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
    }

    const booking = bookings[0];

      // Get customer address for destination
      let destinationLocation: Location;
      
      if (booking.address_id) {
        const addresses = await select('customer_addresses', { id: booking.address_id });
        if (addresses.length > 0) {
          destinationLocation = {
            latitude: parseFloat(addresses[0].latitude),
            longitude: parseFloat(addresses[0].longitude),
          };
        } else {
          return c.json({ error: 'Customer address not found' }, 400);
        }
      } else if (booking.delivery_latitude && booking.delivery_longitude) {
        destinationLocation = {
          latitude: parseFloat(booking.delivery_latitude),
          longitude: parseFloat(booking.delivery_longitude),
        };
      } else {
        return c.json({ error: 'No destination address configured for this booking' }, 400);
      }

      // Start tracking session
      const session = await startTracking(
        bookingId,
        vendorId,
        staffId || null,
        { latitude: parseFloat(startLatitude), longitude: parseFloat(startLongitude) },
        destinationLocation
      );

      return c.json({
        success: true,
        session,
        message: 'Tracking started. Customer has been notified.',
      });

    } catch (error: any) {
      console.error('Error starting tracking:', error);
      return c.json({ error: error.message }, 500);
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
}
