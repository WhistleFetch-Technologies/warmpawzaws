/**
 * ============================================================================
 * ENHANCED GPS TRACKING - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Use bookingId instead of sessionId
 * - Add sessionNumber support
 * - Standardized response format (routePoints, distanceCovered, eta)
 * - Session validation
 * - 10-second update rate tracking
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - Booking data from `bookings` table via BookingsRepository
 * - GPS tracking data from `gps_tracking_sessions` table via GPSTrackingSessionsRepository
 * - Route waypoints stored in `waypoints` JSONB array
 * 
 * Date: 2025-01-27
 * Migration: Batch 8 Phase 1 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getGPSTrackingSessionsRepository } from '../../lib/repositories/gps-tracking.ts';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
app.use('*', cors());

const db = getDbClient();
const bookingsRepo = getBookingsRepository();
const gpsRepo = getGPSTrackingSessionsRepository();

// Helper: Generate tracking ID for session
function generateTrackingId(bookingId: string, sessionNumber: number): string {
  return `booking_${bookingId}_session_${sessionNumber}`;
}

/**
 * POST /bookings/:bookingId/update-location
 * Update staff location during active session
 */
app.post('/bookings/:bookingId/update-location', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { location, sessionNumber = 1 } = await c.req.json();

    // Validation
    if (!location || !location.latitude || !location.longitude) {
      return c.json({
        error: 'Invalid location data',
        message: 'Location must include latitude and longitude',
        required: ['location.latitude', 'location.longitude']
      }, 400);
    }

    // ✅ SQL: Get booking from bookings table
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Validate session status (check booking metadata or status)
    // Note: sessionStatus might be in booking metadata JSONB field
    const bookingMetadata = (booking as any).metadata || {};
    const sessionStatus = bookingMetadata.sessionStatus || booking.status;
    
    if (sessionStatus !== 'active' && booking.status !== 'confirmed') {
      return c.json({
        error: 'Session not active',
        message: 'GPS tracking is only available during active sessions',
        currentStatus: sessionStatus,
        bookingId
      }, 400);
    }

    // Validate session number matches
    const bookingSessionNumber = bookingMetadata.sessionNumber || 1;
    if (bookingSessionNumber !== sessionNumber) {
      return c.json({
        error: 'Session number mismatch',
        message: 'The provided session number does not match the active session',
        expected: bookingSessionNumber,
        provided: sessionNumber
      }, 400);
    }

    // ✅ SQL: Store location update
    const timestamp = new Date().toISOString();
    const locationUpdate = {
      lat: location.latitude,
      lng: location.longitude,
      timestamp: location.timestamp || timestamp,
      accuracy: location.accuracy || null,
      speed: location.speed || null,
      heading: location.heading || null
    };

    // ✅ SQL: Get or create GPS tracking session
    const trackingId = generateTrackingId(bookingId, sessionNumber);
    let trackingSession = await gpsRepo.findByTrackingId(trackingId);
    
    if (!trackingSession) {
      // Create new tracking session
      trackingSession = await gpsRepo.create({
        booking_id: bookingId,
        tracking_id: trackingId,
        start_location: {
          lat: location.latitude,
          lng: location.longitude
        },
        current_location: {
          lat: location.latitude,
          lng: location.longitude,
          timestamp
        },
        waypoints: [locationUpdate],
        total_distance_km: 0,
        is_active: true,
        started_at: bookingMetadata.sessionStartTime || timestamp
      });
    } else {
      // Update existing session
      const waypoints = trackingSession.waypoints || [];
      waypoints.push(locationUpdate);
      
      // Calculate distance covered
      let totalDistance = trackingSession.total_distance_km || 0;
      if (waypoints.length > 1) {
        const prevPoint = waypoints[waypoints.length - 2];
        const distance = calculateDistance(
          prevPoint.lat,
          prevPoint.lng,
          locationUpdate.lat,
          locationUpdate.lng
        );
        totalDistance += distance;
      }

      // Calculate ETA if customer location available
      let estimatedEta = null;
      const customerLocation = bookingMetadata.customerLocation;
      if (customerLocation) {
        const distanceToCustomer = calculateDistance(
          locationUpdate.lat,
          locationUpdate.lng,
          customerLocation.latitude,
          customerLocation.longitude
        );
        const avgSpeed = location.speed || 8.33; // 30 km/h = 8.33 m/s
        const etaSeconds = distanceToCustomer * 1000 / avgSpeed;
        estimatedEta = Math.round(etaSeconds / 60); // Convert to minutes
      }

      // Update tracking session
      trackingSession = await gpsRepo.update(trackingId, {
        current_location: {
          lat: location.latitude,
          lng: location.longitude,
          timestamp
        },
        waypoints,
        total_distance_km: totalDistance,
        estimated_eta_minutes: estimatedEta
      });
    }

    // ✅ SQL: Update booking metadata with latest location
    const updatedMetadata = {
      ...bookingMetadata,
      lastKnownLocation: locationUpdate,
      routePointsCount: trackingSession.waypoints?.length || 0,
      totalDistanceCovered: trackingSession.total_distance_km || 0
    };

    // Update booking metadata (stored in JSONB field if available, or skip if not)
    // Note: This might require a metadata JSONB column in bookings table
    try {
      await db
        .from('bookings')
        .update({
          metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);
    } catch (error) {
      // Metadata update is optional, log but don't fail
      console.warn('Could not update booking metadata:', error);
    }

    // Calculate ETA for response
    let eta = null;
    const customerLocation = bookingMetadata.customerLocation;
    if (customerLocation && trackingSession.current_location) {
      const distance = calculateDistance(
        trackingSession.current_location.lat,
        trackingSession.current_location.lng,
        customerLocation.latitude,
        customerLocation.longitude
      );
      const avgSpeed = location.speed || 8.33;
      const etaSeconds = distance * 1000 / avgSpeed;
      eta = formatETA(etaSeconds);
    }

    console.log(`✅ Location updated for booking ${bookingId}, session ${sessionNumber}: ${trackingSession.waypoints?.length || 0} points, ${(trackingSession.total_distance_km || 0).toFixed(2)} km`);

    return c.json({
      success: true,
      locationUpdated: true,
      routePoints: trackingSession.waypoints?.length || 0,
      distanceCovered: parseFloat((trackingSession.total_distance_km || 0).toFixed(2)),
      eta: eta,
      timestamp
    });

  } catch (error: any) {
    console.error('Error updating location:', error);
    return c.json({ error: error.message || 'Failed to update location' }, 500);
  }
});

/**
 * GET /bookings/:bookingId/route
 * Get full route for a session
 */
app.get('/bookings/:bookingId/route', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const sessionNumber = parseInt(c.req.query('sessionNumber') || '1');

    const trackingId = generateTrackingId(bookingId, sessionNumber);
    const trackingSession = await gpsRepo.findByTrackingId(trackingId);

    if (!trackingSession) {
      return c.json({
        success: true,
        bookingId,
        sessionNumber,
        route: null,
        message: 'No route data available'
      });
    }

    const route = {
      startTime: trackingSession.started_at,
      endTime: trackingSession.stopped_at || null,
      points: trackingSession.waypoints || [],
      totalPoints: trackingSession.waypoints?.length || 0,
      totalDistance: parseFloat((trackingSession.total_distance_km || 0).toFixed(2)),
      duration: trackingSession.started_at ? calculateRouteDuration({
        startTime: trackingSession.started_at,
        endTime: trackingSession.stopped_at
      }) : null,
      lastUpdateTime: trackingSession.updated_at
    };

    return c.json({
      success: true,
      bookingId,
      sessionNumber,
      route
    });

  } catch (error: any) {
    console.error('Error fetching route:', error);
    return c.json({ error: error.message || 'Failed to fetch route' }, 500);
  }
});

/**
 * GET /bookings/:bookingId/live-location
 * Get current live location (for customer tracking)
 */
app.get('/bookings/:bookingId/live-location', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');

    // ✅ SQL: Get booking
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const bookingMetadata = (booking as any).metadata || {};
    const sessionStatus = bookingMetadata.sessionStatus || booking.status;

    if (sessionStatus !== 'active' && booking.status !== 'confirmed') {
      return c.json({
        success: true,
        sessionActive: false,
        message: 'Session is not currently active',
        sessionStatus
      });
    }

    // Get latest tracking session (session 1 by default)
    const sessionNumber = bookingMetadata.sessionNumber || 1;
    const trackingId = generateTrackingId(bookingId, sessionNumber);
    const trackingSession = await gpsRepo.findByTrackingId(trackingId);

    if (!trackingSession || !trackingSession.current_location) {
      return c.json({
        success: true,
        sessionActive: false,
        message: 'No active tracking session found'
      });
    }

    const lastLocation = {
      latitude: trackingSession.current_location.lat,
      longitude: trackingSession.current_location.lng,
      timestamp: trackingSession.current_location.timestamp
    };

    // Calculate ETA
    let eta = null;
    const customerLocation = bookingMetadata.customerLocation;
    if (customerLocation && trackingSession.current_location) {
      const distance = calculateDistance(
        trackingSession.current_location.lat,
        trackingSession.current_location.lng,
        customerLocation.latitude,
        customerLocation.longitude
      );
      const avgSpeed = trackingSession.current_location.speed || 8.33;
      const etaSeconds = distance * 1000 / avgSpeed;
      eta = formatETA(etaSeconds);
    }

    return c.json({
      success: true,
      sessionActive: true,
      bookingId,
      sessionNumber,
      location: lastLocation,
      routePoints: trackingSession.waypoints?.length || 0,
      distanceCovered: trackingSession.total_distance_km || 0,
      eta,
      lastUpdateTime: trackingSession.current_location.timestamp
    });

  } catch (error: any) {
    console.error('Error fetching live location:', error);
    return c.json({ error: error.message || 'Failed to fetch live location' }, 500);
  }
});

/**
 * POST /bookings/:bookingId/start-tracking
 * Start GPS tracking for a session
 */
app.post('/bookings/:bookingId/start-tracking', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { sessionNumber = 1 } = await c.req.json();

    // ✅ SQL: Get booking
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const trackingId = generateTrackingId(bookingId, sessionNumber);
    const now = new Date().toISOString();

    // ✅ SQL: Create or update tracking session
    let trackingSession = await gpsRepo.findByTrackingId(trackingId);
    
    if (!trackingSession) {
      trackingSession = await gpsRepo.create({
        booking_id: bookingId,
        tracking_id: trackingId,
        waypoints: [],
        total_distance_km: 0,
        is_active: true,
        started_at: now
      });
    } else {
      trackingSession = await gpsRepo.update(trackingId, {
        is_active: true,
        started_at: now
      });
    }

    // Update booking metadata
    const bookingMetadata = (booking as any).metadata || {};
    bookingMetadata.gpsTrackingEnabled = true;
    bookingMetadata.gpsTrackingStartedAt = now;
    bookingMetadata.sessionNumber = sessionNumber;
    bookingMetadata.sessionStatus = 'active';

    try {
      await db
        .from('bookings')
        .update({
          metadata: bookingMetadata,
          updated_at: now
        })
        .eq('id', bookingId);
    } catch (error) {
      console.warn('Could not update booking metadata:', error);
    }

    console.log(`✅ GPS tracking started for booking ${bookingId}, session ${sessionNumber}`);

    return c.json({
      success: true,
      message: 'GPS tracking started',
      bookingId,
      sessionNumber,
      trackingStartedAt: now
    });

  } catch (error: any) {
    console.error('Error starting GPS tracking:', error);
    return c.json({ error: error.message || 'Failed to start GPS tracking' }, 500);
  }
});

/**
 * POST /bookings/:bookingId/stop-tracking
 * Stop GPS tracking and finalize route
 */
app.post('/bookings/:bookingId/stop-tracking', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const { sessionNumber = 1 } = await c.req.json();

    const trackingId = generateTrackingId(bookingId, sessionNumber);
    const trackingSession = await gpsRepo.findByTrackingId(trackingId);

    if (!trackingSession) {
      return c.json({ error: 'No active tracking found' }, 404);
    }

    const now = new Date().toISOString();

    // ✅ SQL: Stop tracking session
    const stoppedSession = await gpsRepo.stop(trackingId);

    // Update booking metadata
    const booking = await bookingsRepo.findById(bookingId);
    if (booking) {
      const bookingMetadata = (booking as any).metadata || {};
      bookingMetadata.gpsTrackingEnabled = false;
      bookingMetadata.gpsTrackingStoppedAt = now;
      bookingMetadata.sessionStatus = 'completed';

      try {
        await db
          .from('bookings')
          .update({
            metadata: bookingMetadata,
            updated_at: now
          })
          .eq('id', bookingId);
      } catch (error) {
        console.warn('Could not update booking metadata:', error);
      }
    }

    console.log(`✅ GPS tracking stopped for booking ${bookingId}, session ${sessionNumber}`);

    return c.json({
      success: true,
      message: 'GPS tracking stopped',
      bookingId,
      sessionNumber,
      route: {
        totalPoints: stoppedSession.waypoints?.length || 0,
        totalDistance: parseFloat((stoppedSession.total_distance_km || 0).toFixed(2)),
        duration: stoppedSession.started_at ? calculateRouteDuration({
          startTime: stoppedSession.started_at,
          endTime: stoppedSession.stopped_at || now
        }) : null
      }
    });

  } catch (error: any) {
    console.error('Error stopping GPS tracking:', error);
    return c.json({ error: error.message || 'Failed to stop GPS tracking' }, 500);
  }
});

/**
 * BACKWARD COMPATIBILITY: Support old sessionId-based endpoint
 */
app.post('/gps/tracking/:sessionId/update', async (c) => {
  console.log('⚠️ DEPRECATED: Use /bookings/:bookingId/update-location instead');

  const sessionId = c.req.param('sessionId');
  
  // Try to extract bookingId from sessionId format
  const parts = sessionId.split('_');
  let bookingId = sessionId;

  if (parts.length >= 2) {
    bookingId = parts[1]; // Extract bookingId
  }

  // Forward to new endpoint
  const body = await c.req.json();
  const newUrl = c.req.url.replace(`/gps/tracking/${sessionId}/update`, `/bookings/${bookingId}/update-location`);
  
  const request = new Request(newUrl, {
    method: 'POST',
    headers: c.req.raw.headers,
    body: JSON.stringify(body)
  });

  return app.fetch(request);
});

/**
 * Helper: Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Helper: Format ETA in human-readable format
 */
function formatETA(seconds: number): string {
  if (seconds < 60) {
    return '< 1 min';
  } else if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  }
}

/**
 * Helper: Calculate route duration
 */
function calculateRouteDuration(route: { startTime: string | null; endTime?: string | null }): string | null {
  if (!route.startTime) return null;
  
  const start = new Date(route.startTime).getTime();
  const end = route.endTime ? new Date(route.endTime).getTime() : Date.now();
  const durationMs = end - start;
  
  return formatETA(durationMs / 1000);
}

// Export as named export to match import
export { app as enhancedGpsTrackingSQL };
export default app;
