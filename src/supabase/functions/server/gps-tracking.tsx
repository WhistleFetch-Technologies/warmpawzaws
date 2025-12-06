import { Hono } from "npm:hono";
import { streamSSE } from "npm:hono/streaming";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

export function registerGPSTrackingEndpoints(app: Hono) {
  
  /**
   * GET /make-server-3dd53475/gps/tracking/:sessionId/stream
   * Real-time SSE stream for location updates
   */
  app.get("/make-server-3dd53475/gps/tracking/:sessionId/stream", async (c) => {
    const { sessionId } = c.req.param();
    
    return streamSSE(c, async (stream) => {
      let lastUpdate = null;
      
      // Send initial connection event
      await stream.writeSSE({
        data: JSON.stringify({ status: 'connected', sessionId }),
        event: 'connected',
      });

      // Polling loop
      const interval = setInterval(async () => {
        try {
          const sessionKey = `session:tracking:${sessionId}`;
          const session = await kv.get(sessionKey);
          
          if (!session) {
            // If session ends or doesn't exist, maybe send error or just keep waiting
            return; 
          }

          // Check if update is new
          if (session.lastUpdate !== lastUpdate) {
            lastUpdate = session.lastUpdate;
            
            await stream.writeSSE({
              data: JSON.stringify(session),
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
      const { sessionId, walkerId, initialLocation } = await c.req.json();
      
      if (!sessionId || !walkerId || !initialLocation) {
        return sendError(c, 'Missing required fields', 400);
      }

      const sessionKey = `session:tracking:${sessionId}`;
      
      // Initialize tracking session
      const trackingSession = {
        id: sessionId,
        walkerId,
        status: 'in_progress',
        startTime: new Date().toISOString(),
        currentLocation: initialLocation,
        route: [initialLocation], // Start route history
        distance: 0,
        lastUpdate: new Date().toISOString()
      };

      await kv.set(sessionKey, trackingSession);
      
      // Also update booking status if linked
      const bookingKey = `booking:${sessionId}`; // Assuming sessionId is bookingId
      const booking = await kv.get(bookingKey);
      if (booking) {
        booking.status = 'in_progress';
        booking.trackingActive = true;
        await kv.set(bookingKey, booking);
      }

      console.log(`📍 Tracking started for session: ${sessionId}`);
      return sendSuccess(c, { session: trackingSession });
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
      
      const sessionKey = `session:tracking:${sessionId}`;
      const session = await kv.get(sessionKey);
      
      if (!session) {
        return sendError(c, 'Session not found', 404);
      }

      const newPoint = { lat, lng };
      
      // Calculate distance increment (Haversine formula simplified)
      const lastPoint = session.currentLocation;
      const dist = calculateDistance(lastPoint.lat, lastPoint.lng, lat, lng);
      
      // Update session
      session.currentLocation = newPoint;
      session.route.push(newPoint);
      session.distance += dist;
      session.lastUpdate = new Date().toISOString();
      if (speed) session.speed = speed;
      if (heading) session.heading = heading;

      await kv.set(sessionKey, session);
      
      return sendSuccess(c, {});
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
      
      const sessionKey = `session:tracking:${sessionId}`;
      const session = await kv.get(sessionKey);
      
      if (!session) {
        return sendError(c, 'Session not found', 404);
      }

      session.status = 'completed';
      session.endTime = new Date().toISOString();
      
      // Calculate total duration
      const start = new Date(session.startTime).getTime();
      const end = new Date(session.endTime).getTime();
      session.duration = (end - start) / 1000; // seconds

      await kv.set(sessionKey, session);
      
      // Update booking
      const bookingKey = `booking:${sessionId}`;
      const booking = await kv.get(bookingKey);
      if (booking) {
        booking.status = 'completed';
        booking.trackingActive = false;
        await kv.set(bookingKey, booking);
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
      
      // 1. Try getting active tracking session
      const sessionKey = `session:tracking:${sessionId}`;
      let session = await kv.get(sessionKey);
      
      // 2. If no active session, look up booking to see static details
      if (!session) {
        const booking = await kv.get(`booking:${sessionId}`);
        if (booking) {
          // Return static data if booking exists but tracking hasn't started
          // or if it's already completed and archived
          return sendSuccess(c, {
            session: {
              id: sessionId,
              status: booking.status,
              walkerName: booking.vendorName,
              petName: booking.petName,
              currentLocation: { lat: 12.9716, lng: 77.5946 }, // Default/Center
              petLocation: { lat: 12.9716, lng: 77.5946 },
              route: [],
              distance: 0,
              duration: 0,
              photos: []
            }
          });
        }
        return sendError(c, 'Session not found', 404);
      }
      
      // 3. Enrich with booking details if missing from tracking session
      if (!session.petName || !session.walkerName) {
        const booking = await kv.get(`booking:${sessionId}`);
        if (booking) {
          session.petName = booking.petName;
          session.walkerName = booking.vendorName;
          session.petLocation = booking.location ? { lat: booking.location.lat, lng: booking.location.lng } : session.route[0];
        }
      }

      // Calculate current duration if in progress
      if (session.status === 'in_progress') {
        const start = new Date(session.startTime).getTime();
        const now = new Date().getTime();
        session.duration = (now - start) / 1000;
      }

      return sendSuccess(c, { session });
    } catch (error) {
      console.error('Error fetching tracking data:', error);
      return sendError(c, error, 500);
    }
  });
}

// Helper: Calculate distance between two points in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}
