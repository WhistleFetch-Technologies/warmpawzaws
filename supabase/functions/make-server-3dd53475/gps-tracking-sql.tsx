/**
 * ============================================================================
 * GPS TRACKING ENDPOINTS (SQL-ONLY)
 * ============================================================================
 * 
 * Migrated from KV to SQL
 * Replaces: gps-tracking.tsx
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { streamSSE } from "npm:hono/streaming";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getGPSTrackingRepository } from "../../lib/repositories/gps-tracking.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";

export function registerGPSTrackingEndpointsSQL(app: Hono) {
  
  /**
   * GET /make-server-3dd53475/gps/tracking/:sessionId/stream
   * Real-time SSE stream for location updates
   */
  app.get("/make-server-3dd53475/gps/tracking/:sessionId/stream", async (c) => {
    const { sessionId } = c.req.param();
    
    return streamSSE(c, async (stream) => {
      let lastUpdate: string | null = null;
      
      // Send initial connection event
      await stream.writeSSE({
        data: JSON.stringify({ status: 'connected', sessionId }),
        event: 'connected',
      });

      // Polling loop
      const interval = setInterval(async () => {
        try {
          const repo = getGPSTrackingRepository();
          const session = await repo.findBySessionId(sessionId);
          
          if (!session) {
            // If session ends or doesn't exist, send error and close
            await stream.writeSSE({
              data: JSON.stringify({ status: 'error', message: 'Session not found' }),
              event: 'error',
            });
            clearInterval(interval);
            stream.close();
            return;
          }

          // Check if update is new
          if (session.last_update !== lastUpdate) {
            lastUpdate = session.last_update;
            
            await stream.writeSSE({
              data: JSON.stringify({
                id: session.session_id,
                walkerId: session.walker_id,
                status: session.status,
                startTime: session.started_at,
                currentLocation: session.current_location,
                route: session.route,
                distance: session.distance_km,
                speed: session.speed_kmh,
                heading: session.heading_degrees,
                eta: session.eta_minutes ? {
                  distanceKm: session.distance_km,
                  etaMinutes: session.eta_minutes,
                  estimatedArrival: session.estimated_arrival,
                } : null,
                lastUpdate: session.last_update,
              }),
              event: 'location_update',
            });
            
            if (session.status === 'completed') {
              await stream.writeSSE({
                data: JSON.stringify({ status: 'completed' }),
                event: 'session_ended',
              });
              clearInterval(interval);
              stream.close();
            }
          }
        } catch (e) {
          console.error('SSE Poll Error:', e);
        }
      }, 2000); // Poll every 2 seconds

      // Cleanup when client disconnects
      stream.onAbort(() => {
        clearInterval(interval);
        console.log(`Streaming aborted for ${sessionId}`);
      });

      // Keep connection open
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    });
  });

  /**
   * POST /make-server-3dd53475/gps/tracking/start
   * Start a tracking session (Walker/Driver calls this)
   */
  app.post("/make-server-3dd53475/gps/tracking/start", async (c) => {
    try {
      const { sessionId, walkerId, initialLocation, bookingId } = await c.req.json();
      
      if (!sessionId || !walkerId || !initialLocation) {
        return sendError(c, 'Missing required fields: sessionId, walkerId, initialLocation', 400);
      }

      const repo = getGPSTrackingRepository();
      
      // Create tracking session
      const session = await repo.create({
        session_id: sessionId,
        walker_id: walkerId,
        booking_id: bookingId,
        initial_location: initialLocation,
      });
      
      // Update booking status if linked
      if (bookingId) {
        try {
          const bookingsRepo = getBookingsRepository();
          const booking = await bookingsRepo.findById(bookingId);
          if (booking && booking.status === 'confirmed') {
            await bookingsRepo.update(bookingId, {
              status: 'in_progress',
            });
          }
        } catch (error) {
          console.warn('Could not update booking status:', error);
          // Don't fail the tracking start if booking update fails
        }
      }

      console.log(`📍 Tracking started for session: ${sessionId}`);
      return sendSuccess(c, { session });
    } catch (error) {
      console.error('Error starting GPS tracking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/gps/tracking/:sessionId/update
   * Update location (Walker App polls this every 5-10s)
   */
  app.post("/make-server-3dd53475/gps/tracking/:sessionId/update", async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { lat, lng, speed, heading } = await c.req.json();
      
      if (!lat || !lng) {
        return sendError(c, 'Missing required fields: lat, lng', 400);
      }

      const repo = getGPSTrackingRepository();
      const session = await repo.updateLocation(sessionId, {
        lat,
        lng,
        speed,
        heading,
      });
      
      return sendSuccess(c, { session });
    } catch (error) {
      console.error('Error updating GPS location:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/gps/tracking/:sessionId/stop
   * Stop tracking session
   */
  app.post("/make-server-3dd53475/gps/tracking/:sessionId/stop", async (c) => {
    try {
      const { sessionId } = c.req.param();
      
      const repo = getGPSTrackingRepository();
      const session = await repo.stop(sessionId);
      
      // Update booking status if linked
      if (session.booking_id) {
        try {
          const bookingsRepo = getBookingsRepository();
          await bookingsRepo.update(session.booking_id, {
            status: 'completed',
          });
        } catch (error) {
          console.warn('Could not update booking status:', error);
        }
      }

      return sendSuccess(c, { session });
    } catch (error) {
      console.error('Error stopping GPS tracking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/session/:sessionId/tracking
   * Get live tracking data (Customer App polls this)
   */
  app.get("/make-server-3dd53475/session/:sessionId/tracking", async (c) => {
    try {
      const { sessionId } = c.req.param();
      
      const repo = getGPSTrackingRepository();
      let session = await repo.findBySessionId(sessionId);
      
      // If no active session, look up booking to see static details
      if (!session) {
        try {
          const bookingsRepo = getBookingsRepository();
          // Try to find booking by ID (assuming sessionId might be bookingId)
          const booking = await bookingsRepo.findById(sessionId);
          if (booking) {
            // Return static data if booking exists but tracking hasn't started
            return sendSuccess(c, {
              session: {
                id: sessionId,
                status: booking.status,
                walkerName: booking.staff_name || 'Staff',
                petName: booking.pet_name || 'Pet',
                currentLocation: { lat: 12.9716, lng: 77.5946 }, // Default/Center
                petLocation: { lat: 12.9716, lng: 77.5946 },
                route: [],
                distance: 0,
                duration: 0,
                photos: []
              }
            });
          }
        } catch (error) {
          console.warn('Could not fetch booking:', error);
        }
        return sendError(c, 'Session not found', 404);
      }
      
      // Enrich with booking details if missing
      if (session.booking_id) {
        try {
          const bookingsRepo = getBookingsRepository();
          const booking = await bookingsRepo.findById(session.booking_id);
          if (booking) {
            // Add booking details to session response
            (session as any).petName = booking.pet_name;
            (session as any).walkerName = booking.staff_name;
            (session as any).petLocation = session.current_location;
          }
        } catch (error) {
          console.warn('Could not enrich session with booking details:', error);
        }
      }

      // Calculate current duration if in progress
      if (session.status === 'in_progress') {
        const start = new Date(session.started_at).getTime();
        const now = new Date().getTime();
        (session as any).duration = (now - start) / 1000;
      }

      return sendSuccess(c, { session });
    } catch (error) {
      console.error('Error fetching tracking data:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/gps/tracking/:sessionId/eta
   * Get real-time ETA to destination
   */
  app.get("/make-server-3dd53475/gps/tracking/:sessionId/eta", async (c) => {
    try {
      const { sessionId } = c.req.param();
      const { destinationLat, destinationLng } = c.req.query();
      
      if (!destinationLat || !destinationLng) {
        // Try to get destination from booking
        const repo = getGPSTrackingRepository();
        const session = await repo.findBySessionId(sessionId);
        
        if (!session || !session.booking_id) {
          return sendError(c, 'Destination not found. Provide destinationLat and destinationLng or ensure booking is linked.', 404);
        }
        
        // Get booking location
        try {
          const bookingsRepo = getBookingsRepository();
          const booking = await bookingsRepo.findById(session.booking_id);
          if (booking && (booking as any).location) {
            const location = (booking as any).location;
            const eta = await repo.calculateETA(sessionId, location.lat, location.lng);
            return sendSuccess(c, {
              eta: {
                ...eta,
                currentSpeed: session.speed_kmh || 0
              }
            });
          }
        } catch (error) {
          console.warn('Could not get booking location:', error);
        }
        
        return sendError(c, 'Destination not found', 404);
      }

      const repo = getGPSTrackingRepository();
      const eta = await repo.calculateETA(
        sessionId,
        parseFloat(destinationLat as string),
        parseFloat(destinationLng as string)
      );
      
      const session = await repo.findBySessionId(sessionId);
      
      return sendSuccess(c, {
        eta: {
          ...eta,
          currentSpeed: session?.speed_kmh || 0
        }
      });
    } catch (error) {
      console.error('Error calculating ETA:', error);
      return sendError(c, error, 500);
    }
  });
}

