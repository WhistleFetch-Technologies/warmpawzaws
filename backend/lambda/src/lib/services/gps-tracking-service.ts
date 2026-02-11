/**
 * ============================================================================
 * GPS TRACKING SERVICE - REAL-TIME LOCATION TRACKING
 * ============================================================================
 * 
 * Provides real-time GPS tracking for home services:
 * - Vendor location updates during transit
 * - ETA calculation based on current position
 * - Customer tracking interface
 * - Google Maps integration
 * 
 * Fixes GAP: HS-1, HS-2, HS-3, HS-4, PH-5
 * 
 * Date: 2026-01-21
 * ============================================================================
 */

import { query, insert, update, select } from '../../database/rds-connection';
import { sendVendorOnWay, sendEventNotification } from './push-notification-service';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Google Maps API key: env (injected from Secrets Manager at deploy) or Secrets Manager at runtime
let _googleMapsKeyCache: string | null = null;
async function getGoogleMapsApiKey(): Promise<string> {
  if (_googleMapsKeyCache) return _googleMapsKeyCache;
  const isUatEnv =
    process.env.UAT_MODE === 'true' ||
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'dev';
  if (process.env.GOOGLE_MAPS_API_KEY) {
    _googleMapsKeyCache = process.env.GOOGLE_MAPS_API_KEY;
    return _googleMapsKeyCache;
  }
  // In UAT/dev, skip Secrets Manager to avoid long timeouts (fallback ETA will be used)
  if (isUatEnv) {
    return '';
  }
  try {
    const { getSecret, getSecretJson } = await import('../../utils/secrets-manager');
    const json = await getSecretJson('google-maps');
    const jsonKey = json?.apiKey || json?.api_key || json?.key;
    if (jsonKey) {
      _googleMapsKeyCache = jsonKey;
      return _googleMapsKeyCache;
    }
    const key = await getSecret('google-maps/api-key');
    if (key) _googleMapsKeyCache = key;
  } catch (e) {
    console.warn('[GPS] Secrets Manager Google Maps key not available:', (e as Error).message);
  }
  return _googleMapsKeyCache || '';
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const TRACKING_UPDATE_INTERVAL_MS = 30000; // 30 seconds
const ETA_BUFFER_MINUTES = 5; // Add buffer to ETA

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp?: string;
}

export interface TrackingSession {
  id: string;
  bookingId: string;
  vendorId: string;
  staffId?: string;
  customerId: string;
  status: 'pending' | 'started' | 'in_transit' | 'arrived' | 'completed' | 'cancelled';
  startLocation?: Location;
  currentLocation?: Location;
  destinationLocation: Location;
  estimatedEtaMinutes?: number;
  actualEtaMinutes?: number;
  startedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  routePolyline?: string;
  distanceKm?: number;
}

export interface ETAResult {
  etaMinutes: number;
  distanceKm: number;
  durationMinutes: number;
  routePolyline?: string;
  trafficStatus?: 'light' | 'moderate' | 'heavy';
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

class GPSTrackingServiceImpl {

  /**
   * Start a tracking session for a booking
   * Called when vendor clicks "Start" button
   */
  async startTracking(
    bookingId: string,
    vendorId: string,
    staffId: string | null,
    startLocation: Location,
    destinationLocation: Location
  ): Promise<TrackingSession> {
    try {
      // Get booking and customer info
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        throw new Error('Booking not found');
      }
      const booking = bookings[0];
      const customerId = booking.customer_id;

      // Calculate initial ETA (skip polyline on start to avoid Lambda timeout / 503)
      const eta = await this.calculateETA(startLocation, destinationLocation, true);

      // Create tracking session
      const session = await insert('gps_tracking_sessions', {
        booking_id: bookingId,
        vendor_id: vendorId,
        staff_id: staffId,
        customer_id: customerId,
        status: 'in_transit',
        start_latitude: startLocation.latitude,
        start_longitude: startLocation.longitude,
        current_latitude: startLocation.latitude,
        current_longitude: startLocation.longitude,
        destination_latitude: destinationLocation.latitude,
        destination_longitude: destinationLocation.longitude,
        estimated_eta_minutes: eta.etaMinutes,
        distance_km: eta.distanceKm,
        route_polyline: eta.routePolyline,
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      // Update booking status (non-critical; wrap to avoid 503 if columns missing)
      try {
        await update('bookings', { id: bookingId }, {
          status: 'in_transit',
          vendor_started_at: new Date().toISOString(),
          estimated_arrival_time: new Date(Date.now() + eta.etaMinutes * 60 * 1000).toISOString(),
        });
      } catch (updateErr) {
        console.warn('[GPS] Booking status update failed (non-fatal):', (updateErr as Error).message);
      }

      // Get vendor name for notification
      const vendors = await select('vendors', { id: vendorId });
      const vendorName = vendors[0]?.business_name || 'Your service provider';

      // Send notification to customer
      const trackingUrl = `${process.env.CUSTOMER_APP_URL || 'https://app.warmpawz.com'}/track/${session[0].id}`;
      await sendVendorOnWay(
        customerId,
        bookingId,
        vendorName,
        eta.etaMinutes,
        trackingUrl
      );

      console.log(`📍 Tracking started for booking ${bookingId}, ETA: ${eta.etaMinutes} min`);

      return {
        id: session[0].id,
        bookingId,
        vendorId,
        staffId: staffId || undefined,
        customerId,
        status: 'in_transit',
        startLocation,
        currentLocation: startLocation,
        destinationLocation,
        estimatedEtaMinutes: eta.etaMinutes,
        distanceKm: eta.distanceKm,
        routePolyline: eta.routePolyline,
        startedAt: session[0].started_at,
      };

    } catch (error) {
      console.error('Error starting tracking:', error);
      throw error;
    }
  }

  /**
   * Update vendor's current location
   * Called periodically from vendor app
   */
  async updateLocation(
    sessionId: string,
    currentLocation: Location
  ): Promise<{ eta: number; distanceRemaining: number }> {
    try {
      // Get current session
      const sessions = await select('gps_tracking_sessions', { id: sessionId });
      if (sessions.length === 0) {
        throw new Error('Tracking session not found');
      }
      const session = sessions[0];

      if (session.status !== 'in_transit') {
        throw new Error('Tracking session is not active');
      }

      // Calculate new ETA
      const destination: Location = {
        latitude: parseFloat(session.destination_latitude),
        longitude: parseFloat(session.destination_longitude),
      };
      const eta = await this.calculateETA(currentLocation, destination);

      // Check if vendor has arrived (within 100 meters)
      const distanceToDestination = this.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        destination.latitude,
        destination.longitude
      );

      let newStatus = session.status;
      if (distanceToDestination < 0.1) { // 100 meters
        newStatus = 'arrived';
        
        // Send arrival notification
        await sendEventNotification({
          eventType: 'vendor_arrived',
          recipientId: session.customer_id,
          recipientType: 'customer',
          relatedId: session.booking_id,
          data: { 
            bookingId: session.booking_id,
            sessionId,
          },
        });
      }

      // Update session
      await update('gps_tracking_sessions', { id: sessionId }, {
        current_latitude: currentLocation.latitude,
        current_longitude: currentLocation.longitude,
        current_accuracy: currentLocation.accuracy,
        current_heading: currentLocation.heading,
        current_speed: currentLocation.speed,
        estimated_eta_minutes: eta.etaMinutes,
        distance_remaining_km: eta.distanceKm,
        status: newStatus,
        last_update_at: new Date().toISOString(),
        ...(newStatus === 'arrived' ? { arrived_at: new Date().toISOString() } : {}),
      });

      // Update booking ETA
      await update('bookings', { id: session.booking_id }, {
        estimated_arrival_time: new Date(Date.now() + eta.etaMinutes * 60 * 1000).toISOString(),
        ...(newStatus === 'arrived' ? { vendor_arrived_at: new Date().toISOString() } : {}),
      });

      // Store location history
      await insert('gps_location_history', {
        session_id: sessionId,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: currentLocation.accuracy,
        heading: currentLocation.heading,
        speed: currentLocation.speed,
        eta_minutes: eta.etaMinutes,
        recorded_at: new Date().toISOString(),
      });

      return {
        eta: eta.etaMinutes,
        distanceRemaining: eta.distanceKm,
      };

    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }

  /**
   * Get current tracking status for a booking
   * Used by customer to track vendor
   */
  async getTrackingStatus(bookingId: string): Promise<TrackingSession | null> {
    try {
      const result = await query(
        `SELECT * FROM gps_tracking_sessions 
         WHERE booking_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [bookingId]
      );

      const sessions = (result as any).rows || [];
      if (sessions.length === 0) {
        return null;
      }

      const session = sessions[0];
      return {
        id: session.id,
        bookingId: session.booking_id,
        vendorId: session.vendor_id,
        staffId: session.staff_id,
        customerId: session.customer_id,
        status: session.status,
        startLocation: session.start_latitude ? {
          latitude: parseFloat(session.start_latitude),
          longitude: parseFloat(session.start_longitude),
        } : undefined,
        currentLocation: session.current_latitude ? {
          latitude: parseFloat(session.current_latitude),
          longitude: parseFloat(session.current_longitude),
          heading: session.current_heading,
          speed: session.current_speed,
          timestamp: session.last_update_at,
        } : undefined,
        destinationLocation: {
          latitude: parseFloat(session.destination_latitude),
          longitude: parseFloat(session.destination_longitude),
        },
        estimatedEtaMinutes: session.estimated_eta_minutes,
        distanceKm: session.distance_remaining_km || session.distance_km,
        routePolyline: session.route_polyline,
        startedAt: session.started_at,
        arrivedAt: session.arrived_at,
        completedAt: session.completed_at,
      };

    } catch (error) {
      console.error('Error getting tracking status:', error);
      return null;
    }
  }

  /**
   * Get location history for a tracking session
   * Used to draw the route on map
   */
  async getLocationHistory(sessionId: string): Promise<Location[]> {
    try {
      const result = await query(
        `SELECT latitude, longitude, accuracy, heading, speed, recorded_at as timestamp
         FROM gps_location_history
         WHERE session_id = $1
         ORDER BY recorded_at ASC`,
        [sessionId]
      );

      return ((result as any).rows || []).map((row: any) => ({
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        accuracy: row.accuracy,
        heading: row.heading,
        speed: row.speed,
        timestamp: row.timestamp,
      }));

    } catch (error) {
      console.error('Error getting location history:', error);
      return [];
    }
  }

  /**
   * Complete tracking session
   * Called when service is started at customer location
   */
  async completeTracking(sessionId: string): Promise<void> {
    try {
      await update('gps_tracking_sessions', { id: sessionId }, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // Get session to update booking
      const sessions = await select('gps_tracking_sessions', { id: sessionId });
      if (sessions.length > 0) {
        await update('bookings', { id: sessions[0].booking_id }, {
          status: 'in_progress',
        });
      }

    } catch (error) {
      console.error('Error completing tracking:', error);
      throw error;
    }
  }

  /**
   * Cancel tracking session
   */
  async cancelTracking(sessionId: string, reason?: string): Promise<void> {
    try {
      await update('gps_tracking_sessions', { id: sessionId }, {
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error cancelling tracking:', error);
      throw error;
    }
  }

  /**
   * Calculate ETA using Google Maps Distance Matrix API
   * Uses GOOGLE_MAPS_API_KEY from env (set from Secrets Manager at deploy) or fetches from Secrets Manager at runtime
   * @param skipPolyline - When true, skips Directions API call to save time (e.g. on session start)
   */
  async calculateETA(origin: Location, destination: Location, skipPolyline = false): Promise<ETAResult> {
    const FETCH_TIMEOUT_MS = 5000; // 5s to avoid Lambda timeout (503)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const apiKey = GOOGLE_MAPS_API_KEY || (await getGoogleMapsApiKey());
      if (apiKey) {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/distancematrix/json?` +
          `origins=${origin.latitude},${origin.longitude}` +
          `&destinations=${destination.latitude},${destination.longitude}` +
          `&mode=driving&departure_time=now` +
          `&key=${apiKey}`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const element = data.rows?.[0]?.elements?.[0];
          
          if (element?.status === 'OK') {
            const durationInTraffic = element.duration_in_traffic?.value || element.duration?.value || 0;
            const distance = element.distance?.value || 0;

            // Get route polyline only when needed (skip on start to avoid 503 timeout)
            let routePolyline: string | undefined;
            if (!skipPolyline) {
            try {
              const polyController = new AbortController();
              const polyTimeout = setTimeout(() => polyController.abort(), 2000);
              const directionsResponse = await fetch(
                `https://maps.googleapis.com/maps/api/directions/json?` +
                `origin=${origin.latitude},${origin.longitude}` +
                `&destination=${destination.latitude},${destination.longitude}` +
                `&mode=driving&departure_time=now` +
                `&key=${apiKey}`,
                { signal: polyController.signal }
              );
              clearTimeout(polyTimeout);
              if (directionsResponse.ok) {
                const directionsData = await directionsResponse.json();
                routePolyline = directionsData.routes?.[0]?.overview_polyline?.points;
              }
            } catch (e) {
              console.warn('Could not get route polyline:', e);
            }
            }

            return {
              etaMinutes: Math.ceil(durationInTraffic / 60) + ETA_BUFFER_MINUTES,
              distanceKm: distance / 1000,
              durationMinutes: Math.ceil(durationInTraffic / 60),
              routePolyline,
              trafficStatus: this.getTrafficStatus(element.duration?.value, durationInTraffic),
            };
          }
        }
      }

      clearTimeout(timeoutId);
      // Fallback: Calculate straight-line distance and estimate time
      const distanceKm = this.calculateDistance(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );
      
      // Assume average speed of 25 km/h in city
      const etaMinutes = Math.ceil((distanceKm / 25) * 60) + ETA_BUFFER_MINUTES;

      return {
        etaMinutes,
        distanceKm,
        durationMinutes: etaMinutes - ETA_BUFFER_MINUTES,
      };

    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Error calculating ETA:', error);
      
      // Fallback calculation (used on timeout, network error, or missing API key)
      const distanceKm = this.calculateDistance(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );
      const etaMinutes = Math.ceil((distanceKm / 25) * 60) + ETA_BUFFER_MINUTES;
      
      return {
        etaMinutes,
        distanceKm,
        durationMinutes: etaMinutes - ETA_BUFFER_MINUTES,
      };
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private getTrafficStatus(normalDuration: number, trafficDuration: number): 'light' | 'moderate' | 'heavy' {
    const ratio = trafficDuration / normalDuration;
    if (ratio < 1.2) return 'light';
    if (ratio < 1.5) return 'moderate';
    return 'heavy';
  }
}

// Export singleton instance
export const gpsTrackingService = new GPSTrackingServiceImpl();

// Export convenience functions
export const startTracking = (
  bookingId: string,
  vendorId: string,
  staffId: string | null,
  startLocation: Location,
  destinationLocation: Location
) => gpsTrackingService.startTracking(bookingId, vendorId, staffId, startLocation, destinationLocation);

export const updateLocation = (sessionId: string, currentLocation: Location) => 
  gpsTrackingService.updateLocation(sessionId, currentLocation);

export const getTrackingStatus = (bookingId: string) => 
  gpsTrackingService.getTrackingStatus(bookingId);

export const getLocationHistory = (sessionId: string) => 
  gpsTrackingService.getLocationHistory(sessionId);

export const completeTracking = (sessionId: string) => 
  gpsTrackingService.completeTracking(sessionId);

export const calculateETA = (origin: Location, destination: Location) => 
  gpsTrackingService.calculateETA(origin, destination);
