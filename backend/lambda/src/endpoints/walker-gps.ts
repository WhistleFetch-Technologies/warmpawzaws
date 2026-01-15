/**
 * ============================================================================
 * WALKER GPS TRACKING ENDPOINTS
 * ============================================================================
 * 
 * Handles real-time GPS tracking for dog walking services:
 * - Walker location updates
 * - Customer live tracking view
 * - Route recording and statistics
 * - Walk session management
 * 
 * Date: 2026-01-15
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, insert, update, select } from '../database/rds-connection';

export function registerWalkerGPSEndpoints(app: Hono) {
  
  /**
   * POST /walker/:walkerId/start-session
   * Start a walking session with GPS tracking
   */
  app.post("/walker/:walkerId/start-session", async (c) => {
    try {
      const { walkerId } = c.req.param();
      const body = await c.req.json();
      const { bookingId, startLat, startLng } = body;

      if (!bookingId || !startLat || !startLng) {
        return c.json({ error: 'bookingId, startLat, and startLng required' }, 400);
      }

      // Verify booking exists and is for this walker
      const bookingResult = await query(`
        SELECT b.*, c.id as customer_id, p.id as pet_id
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN pets p ON b.pet_id = p.id
        WHERE b.id = $1 AND b.vendor_id = $2
        AND b.status IN ('confirmed', 'in_progress')
      `, [bookingId, walkerId]);

      if (bookingResult.rows.length === 0) {
        return c.json({ error: 'Booking not found or not assigned to this walker' }, 404);
      }

      const booking = bookingResult.rows[0];

      // Create live session
      const liveSession = await query(`
        INSERT INTO walker_live_sessions (
          booking_id, walker_id, customer_id,
          current_lat, current_lng, is_active, started_at
        ) VALUES ($1, $2, $3, $4, $5, true, NOW())
        ON CONFLICT (booking_id) DO UPDATE SET
          current_lat = EXCLUDED.current_lat,
          current_lng = EXCLUDED.current_lng,
          is_active = true,
          started_at = NOW(),
          last_updated = NOW()
        RETURNING *
      `, [bookingId, walkerId, booking.customer_id, startLat, startLng]);

      // Create walk route record
      const walkRoute = await query(`
        INSERT INTO walk_routes (
          booking_id, walker_id, customer_id, pet_id,
          start_location, waypoints, started_at
        ) VALUES (
          $1, $2, $3, $4,
          $5, '[]'::jsonb, NOW()
        )
        ON CONFLICT (booking_id) DO UPDATE SET
          start_location = EXCLUDED.start_location,
          waypoints = '[]'::jsonb,
          started_at = NOW()
        RETURNING id
      `, [
        bookingId, walkerId, booking.customer_id, booking.pet_id,
        JSON.stringify({ lat: startLat, lng: startLng, timestamp: new Date().toISOString() })
      ]);

      // Update booking status
      await update('bookings', { id: bookingId }, { status: 'in_progress' });

      return c.json({
        success: true,
        session: liveSession.rows[0],
        walkRouteId: walkRoute.rows[0]?.id,
        message: 'Walking session started. GPS tracking active.'
      });
    } catch (error: any) {
      console.error('Error starting walker session:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /walker/:walkerId/gps-update
   * Update walker's current GPS location during active walk
   */
  app.post("/walker/:walkerId/gps-update", async (c) => {
    try {
      const { walkerId } = c.req.param();
      const body = await c.req.json();
      const { 
        bookingId, 
        lat, 
        lng, 
        heading, 
        speed, 
        accuracy,
        batteryLevel 
      } = body;

      if (!bookingId || lat === undefined || lng === undefined) {
        return c.json({ error: 'bookingId, lat, and lng required' }, 400);
      }

      // Update live session
      const liveUpdate = await query(`
        UPDATE walker_live_sessions SET
          current_lat = $1,
          current_lng = $2,
          heading = $3,
          speed_kmh = $4,
          accuracy_meters = $5,
          battery_level = $6,
          last_updated = NOW()
        WHERE booking_id = $7 AND walker_id = $8 AND is_active = true
        RETURNING *
      `, [lat, lng, heading, speed, accuracy, batteryLevel, bookingId, walkerId]);

      if (liveUpdate.rows.length === 0) {
        return c.json({ error: 'No active session found' }, 404);
      }

      // Append waypoint to route
      const waypoint = {
        lat,
        lng,
        timestamp: new Date().toISOString(),
        speed,
        heading
      };

      await query(`
        UPDATE walk_routes SET
          waypoints = waypoints || $1::jsonb,
          total_duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
        WHERE booking_id = $2
      `, [JSON.stringify([waypoint]), bookingId]);

      return c.json({
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error updating GPS:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /walker/:walkerId/end-session
   * End walking session and finalize route
   */
  app.post("/walker/:walkerId/end-session", async (c) => {
    try {
      const { walkerId } = c.req.param();
      const body = await c.req.json();
      const { 
        bookingId, 
        endLat, 
        endLng,
        notes,
        pottyBreaks = 0,
        weatherConditions
      } = body;

      if (!bookingId) {
        return c.json({ error: 'bookingId required' }, 400);
      }

      // Deactivate live session
      await query(`
        UPDATE walker_live_sessions SET
          is_active = false,
          current_lat = $1,
          current_lng = $2,
          last_updated = NOW()
        WHERE booking_id = $3 AND walker_id = $4
      `, [endLat, endLng, bookingId, walkerId]);

      // Finalize route
      const routeUpdate = await query(`
        UPDATE walk_routes SET
          end_location = $1,
          ended_at = NOW(),
          total_duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER,
          notes = $2,
          potty_breaks = $3,
          weather_conditions = $4
        WHERE booking_id = $5
        RETURNING *
      `, [
        JSON.stringify({ lat: endLat, lng: endLng, timestamp: new Date().toISOString() }),
        notes,
        pottyBreaks,
        weatherConditions,
        bookingId
      ]);

      const route = routeUpdate.rows[0];

      // Calculate total distance from waypoints
      let totalDistance = 0;
      if (route?.waypoints && route.waypoints.length > 1) {
        for (let i = 1; i < route.waypoints.length; i++) {
          const prev = route.waypoints[i - 1];
          const curr = route.waypoints[i];
          totalDistance += calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        }
      }

      // Update distance
      await query(`
        UPDATE walk_routes SET
          total_distance_meters = $1,
          average_speed_kmh = CASE 
            WHEN total_duration_seconds > 0 
            THEN ($1::decimal / 1000) / (total_duration_seconds::decimal / 3600)
            ELSE 0
          END
        WHERE booking_id = $2
      `, [Math.round(totalDistance), bookingId]);

      return c.json({
        success: true,
        route: {
          id: route?.id,
          distanceMeters: Math.round(totalDistance),
          distanceKm: (totalDistance / 1000).toFixed(2),
          durationSeconds: route?.total_duration_seconds,
          durationMinutes: Math.round((route?.total_duration_seconds || 0) / 60),
          pottyBreaks,
          waypointCount: route?.waypoints?.length || 0
        },
        message: 'Walking session ended. Route saved.'
      });
    } catch (error: any) {
      console.error('Error ending walker session:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /walker/:walkerId/active-session
   * Get walker's currently active session
   */
  app.get("/walker/:walkerId/active-session", async (c) => {
    try {
      const { walkerId } = c.req.param();

      const result = await query(`
        SELECT 
          wls.*,
          b.booking_date,
          b.booking_time,
          b.notes as booking_notes,
          c.name as customer_name,
          c.phone as customer_phone,
          p.name as pet_name,
          p.breed as pet_breed,
          wr.waypoints,
          wr.total_distance_meters,
          wr.total_duration_seconds,
          wr.started_at as walk_started_at
        FROM walker_live_sessions wls
        LEFT JOIN bookings b ON wls.booking_id = b.id
        LEFT JOIN customers c ON wls.customer_id = c.id
        LEFT JOIN pets p ON b.pet_id = p.id
        LEFT JOIN walk_routes wr ON wr.booking_id = wls.booking_id
        WHERE wls.walker_id = $1 AND wls.is_active = true
        ORDER BY wls.started_at DESC
        LIMIT 1
      `, [walkerId]);

      if (result.rows.length === 0) {
        return c.json({
          success: true,
          hasActiveSession: false,
          session: null
        });
      }

      const session = result.rows[0];

      return c.json({
        success: true,
        hasActiveSession: true,
        session: {
          ...session,
          currentPosition: {
            lat: parseFloat(session.current_lat),
            lng: parseFloat(session.current_lng)
          },
          stats: {
            distanceMeters: session.total_distance_meters || 0,
            durationSeconds: session.total_duration_seconds || 0,
            waypointCount: session.waypoints?.length || 0
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching active session:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:bookingId/track-walk
   * Customer endpoint to track their dog's current walk
   */
  app.get("/customer/:bookingId/track-walk", async (c) => {
    try {
      const { bookingId } = c.req.param();

      const result = await query(`
        SELECT 
          wls.current_lat,
          wls.current_lng,
          wls.heading,
          wls.speed_kmh,
          wls.last_updated,
          wls.is_active,
          wls.started_at,
          wr.waypoints,
          wr.total_distance_meters,
          wr.total_duration_seconds,
          wr.photos,
          v.business_name as walker_name,
          v.phone as walker_phone,
          v.profile_image_url as walker_image,
          p.name as pet_name,
          b.notes as special_instructions
        FROM walker_live_sessions wls
        LEFT JOIN walk_routes wr ON wr.booking_id = wls.booking_id
        LEFT JOIN vendors v ON wls.walker_id = v.id
        LEFT JOIN bookings b ON wls.booking_id = b.id
        LEFT JOIN pets p ON b.pet_id = p.id
        WHERE wls.booking_id = $1
      `, [bookingId]);

      if (result.rows.length === 0) {
        return c.json({
          success: true,
          isActive: false,
          message: 'Walk has not started yet or has ended'
        });
      }

      const data = result.rows[0];
      
      // Calculate current duration
      const startTime = new Date(data.started_at);
      const currentDuration = Math.floor((Date.now() - startTime.getTime()) / 1000);

      return c.json({
        success: true,
        isActive: data.is_active,
        walker: {
          name: data.walker_name,
          phone: data.walker_phone,
          image: data.walker_image
        },
        petName: data.pet_name,
        currentPosition: {
          lat: parseFloat(data.current_lat),
          lng: parseFloat(data.current_lng),
          heading: data.heading,
          speed: data.speed_kmh,
          lastUpdated: data.last_updated
        },
        route: data.waypoints || [],
        stats: {
          distanceMeters: data.total_distance_meters || 0,
          distanceKm: ((data.total_distance_meters || 0) / 1000).toFixed(2),
          durationSeconds: currentDuration,
          durationMinutes: Math.round(currentDuration / 60)
        },
        photos: data.photos || [],
        startedAt: data.started_at
      });
    } catch (error: any) {
      console.error('Error tracking walk:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /walker/:walkerId/add-photo
   * Add photo during walk
   */
  app.post("/walker/:walkerId/add-photo", async (c) => {
    try {
      const { walkerId } = c.req.param();
      const body = await c.req.json();
      const { bookingId, photoUrl, caption, lat, lng } = body;

      if (!bookingId || !photoUrl) {
        return c.json({ error: 'bookingId and photoUrl required' }, 400);
      }

      const photo = {
        url: photoUrl,
        caption: caption || '',
        lat,
        lng,
        timestamp: new Date().toISOString()
      };

      await query(`
        UPDATE walk_routes SET
          photos = photos || $1::jsonb
        WHERE booking_id = $2 AND walker_id = $3
      `, [JSON.stringify([photo]), bookingId, walkerId]);

      return c.json({
        success: true,
        photo,
        message: 'Photo added to walk'
      });
    } catch (error: any) {
      console.error('Error adding walk photo:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /walk-routes/:bookingId
   * Get completed walk route details
   */
  app.get("/walk-routes/:bookingId", async (c) => {
    try {
      const { bookingId } = c.req.param();

      const result = await query(`
        SELECT 
          wr.*,
          v.business_name as walker_name,
          c.name as customer_name,
          p.name as pet_name,
          p.breed as pet_breed
        FROM walk_routes wr
        LEFT JOIN vendors v ON wr.walker_id = v.id
        LEFT JOIN customers c ON wr.customer_id = c.id
        LEFT JOIN pets p ON wr.pet_id = p.id
        WHERE wr.booking_id = $1
      `, [bookingId]);

      if (result.rows.length === 0) {
        return c.json({ error: 'Walk route not found' }, 404);
      }

      const route = result.rows[0];

      return c.json({
        success: true,
        route: {
          ...route,
          distanceKm: ((route.total_distance_meters || 0) / 1000).toFixed(2),
          durationMinutes: Math.round((route.total_duration_seconds || 0) / 60)
        }
      });
    } catch (error: any) {
      console.error('Error fetching walk route:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Walker GPS endpoints registered');
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
