/**
 * UNIVERSAL GPS TRACKING FOR ALL HOME SERVICES
 * Production-Grade Implementation
 * 
 * Extends existing GPS tracking to support ALL home service providers
 * Features:
 * - Real-time location updates
 * - Customer notifications when provider starts journey
 * - Route visualization
 * - ETA calculation
 * - Distance tracking
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';
import { calculateDistance } from './schedule-utils.tsx';

export function universalGPSTrackingEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * POST /gps/tracking/home-service/start
   * Start GPS tracking for any home service booking
   */
  app.post(`${BASE}/gps/tracking/home-service/start`, async (c) => {
    try {
      const { bookingId, staffId, initialLocation } = await c.req.json();

      if (!bookingId || !staffId || !initialLocation) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.serviceStyle !== 'at_home') {
        return c.json({ error: 'Only home service bookings can have GPS tracking' }, 400);
      }

      const trackingId = `tracking_${bookingId}_${Date.now()}`;

      const trackingSession = {
        id: trackingId,
        bookingId,
        staffId,
        customerId: booking.customerId,
        customerLocation: booking.customerLocation || booking.address,
        status: 'traveling',
        startTime: new Date().toISOString(),
        currentLocation: initialLocation,
        route: [initialLocation],
        distanceTraveled: 0,
        estimatedArrivalTime: null,
        eta: null,
        speed: 0,
        heading: 0,
        lastUpdate: new Date().toISOString()
      };

      await kv.set(`gps_tracking:${trackingId}`, trackingSession);
      await kv.set(`booking:${bookingId}:tracking`, trackingId);

      // Update booking status
      booking.status = 'traveling';
      booking.trackingActive = true;
      booking.trackingId = trackingId;
      await kv.set(`booking:${bookingId}`, booking);

      // Calculate initial ETA
      if (booking.customerLocation && initialLocation) {
        const distance = calculateDistance(
          initialLocation.lat,
          initialLocation.lng,
          booking.customerLocation.lat || 0,
          booking.customerLocation.lng || 0
        );
        const eta = Math.ceil(distance * 2); // 2 minutes per km
        trackingSession.eta = eta;
        trackingSession.estimatedArrivalTime = new Date(Date.now() + eta * 60 * 1000).toISOString();
        await kv.set(`gps_tracking:${trackingId}`, trackingSession);
      }

      // Notify customer
      await notifyCustomer(booking.customerId, booking.customerPhone, {
        type: 'provider_started',
        bookingId,
        staffName: booking.staffName || 'Service Provider',
        eta: trackingSession.eta
      });

      console.log(`📍 [GPS] Tracking started for booking: ${bookingId}`);

      return c.json({
        success: true,
        tracking: trackingSession,
        message: 'GPS tracking started'
      });

    } catch (error) {
      console.error('❌ [GPS] Error starting tracking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /gps/tracking/:trackingId/update
   * Update location for home service tracking
   */
  app.post(`${BASE}/gps/tracking/:trackingId/update`, async (c) => {
    try {
      const { trackingId } = c.req.param();
      const { lat, lng, speed, heading } = await c.req.json();

      const session = await kv.get(`gps_tracking:${trackingId}`);
      if (!session) {
        return c.json({ error: 'Tracking session not found' }, 404);
      }

      const newLocation = { lat, lng, timestamp: new Date().toISOString() };

      // Calculate distance increment
      const lastLocation = session.currentLocation;
      const distanceIncrement = calculateDistance(
        lastLocation.lat,
        lastLocation.lng,
        lat,
        lng
      );

      // Update session
      session.currentLocation = newLocation;
      session.route.push(newLocation);
      session.distanceTraveled += distanceIncrement;
      session.speed = speed || session.speed || 0;
      session.heading = heading || session.heading || 0;
      session.lastUpdate = new Date().toISOString();

      // Recalculate ETA
      const booking = await kv.get(`booking:${session.bookingId}`);
      if (booking && booking.customerLocation) {
        const remainingDistance = calculateDistance(
          lat,
          lng,
          booking.customerLocation.lat || 0,
          booking.customerLocation.lng || 0
        );
        const avgSpeed = session.speed > 0 ? session.speed : 30; // km/h default
        const etaMinutes = Math.ceil((remainingDistance / avgSpeed) * 60);
        session.eta = etaMinutes;
        session.estimatedArrivalTime = new Date(Date.now() + etaMinutes * 60 * 1000).toISOString();
      }

      await kv.set(`gps_tracking:${trackingId}`, session);

      // Notify customer if significant update (every 30 seconds or 100m)
      if (distanceIncrement > 0.1 || Date.now() - new Date(session.lastUpdate).getTime() > 30000) {
        const remainingDistance = booking && booking.customerLocation
          ? calculateDistanceHelper(
              lat,
              lng,
              booking.customerLocation.lat || 0,
              booking.customerLocation.lng || 0
            )
          : 0;

        await notifyCustomer(booking.customerId, booking.customerPhone, {
          type: 'location_update',
          bookingId: session.bookingId,
          location: newLocation,
          eta: session.eta,
          distanceRemaining: remainingDistance
        });
      }

      return c.json({
        success: true,
        tracking: session
      });

    } catch (error) {
      console.error('❌ [GPS] Error updating location:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /gps/tracking/:trackingId
   * Get current tracking status
   */
  app.get(`${BASE}/gps/tracking/:trackingId`, async (c) => {
    try {
      const { trackingId } = c.req.param();
      const session = await kv.get(`gps_tracking:${trackingId}`);

      if (!session) {
        return c.json({ error: 'Tracking session not found' }, 404);
      }

      return c.json({
        success: true,
        tracking: session
      });

    } catch (error) {
      console.error('❌ [GPS] Error fetching tracking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /gps/tracking/:trackingId/arrived
   * Mark provider as arrived at customer location
   */
  app.post(`${BASE}/gps/tracking/:trackingId/arrived`, async (c) => {
    try {
      const { trackingId } = c.req.param();
      const { location } = await c.req.json();

      const session = await kv.get(`gps_tracking:${trackingId}`);
      if (!session) {
        return c.json({ error: 'Tracking session not found' }, 404);
      }

      session.status = 'arrived';
      session.arrivedAt = new Date().toISOString();
      if (location) {
        session.currentLocation = location;
        session.route.push({ ...location, timestamp: new Date().toISOString() });
      }
      session.lastUpdate = new Date().toISOString();

      await kv.set(`gps_tracking:${trackingId}`, session);

      // Update booking
      const booking = await kv.get(`booking:${session.bookingId}`);
      if (booking) {
        booking.status = 'arrived';
        booking.arrivedAt = session.arrivedAt;
        await kv.set(`booking:${session.bookingId}`, booking);
      }

      // Notify customer
      await notifyCustomer(booking.customerId, booking.customerPhone, {
        type: 'provider_arrived',
        bookingId: session.bookingId,
        staffName: booking.staffName || 'Service Provider'
      });

      return c.json({
        success: true,
        tracking: session,
        message: 'Provider marked as arrived'
      });

    } catch (error) {
      console.error('❌ [GPS] Error marking arrived:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /gps/tracking/:trackingId/complete
   * Complete tracking session
   */
  app.post(`${BASE}/gps/tracking/:trackingId/complete`, async (c) => {
    try {
      const { trackingId } = c.req.param();

      const session = await kv.get(`gps_tracking:${trackingId}`);
      if (!session) {
        return c.json({ error: 'Tracking session not found' }, 404);
      }

      session.status = 'completed';
      session.completedAt = new Date().toISOString();
      session.lastUpdate = new Date().toISOString();

      await kv.set(`gps_tracking:${trackingId}`, session);

      // Update booking
      const booking = await kv.get(`booking:${session.bookingId}`);
      if (booking) {
        booking.trackingActive = false;
        booking.trackingCompletedAt = session.completedAt;
        await kv.set(`booking:${session.bookingId}`, booking);
      }

      return c.json({
        success: true,
        tracking: session,
        message: 'Tracking completed'
      });

    } catch (error) {
      console.error('❌ [GPS] Error completing tracking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Helper: Notify customer
   */
  async function notifyCustomer(customerId: string, customerPhone: string, notification: any) {
    try {
      // Add to customer notifications
      const notifications = await kv.get(`customer:${customerId}:notifications`) || [];
      notifications.push({
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        createdAt: new Date().toISOString(),
        read: false
      });
      await kv.set(`customer:${customerId}:notifications`, notifications);

      // Send SMS for critical updates
      if (['provider_started', 'provider_arrived'].includes(notification.type)) {
        // TODO: Integrate with SMS service
        console.log(`📱 [SMS] Would send SMS to ${customerPhone}: ${notification.type}`);
      }

    } catch (error) {
      console.error('❌ [GPS] Error notifying customer:', error);
    }
  }

  console.log('✅ Universal GPS Tracking endpoints registered');
}

