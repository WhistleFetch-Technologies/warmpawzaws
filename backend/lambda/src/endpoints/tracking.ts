/**
 * ============================================================================
 * TRACKING ENDPOINTS
 * ============================================================================
 * 
 * Handles GPS tracking and ETA calculation:
 * - Get ETA for a booking based on current location
 * - Uses Google Maps API (credentials from AWS Secrets Manager)
 * 
 * Phase: Phase 2 - Customer Engagement & Notifications
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select } from '../database/rds-connection';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const REGION = process.env.AWS_REGION || 'ap-south-1';

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Get Google Maps API key from Secrets Manager
 */
async function getGoogleMapsApiKey(): Promise<string | null> {
  try {
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretName = process.env.GOOGLE_MAPS_SECRET_NAME || 'warmpawz-google-maps-api-key';
    
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    
    const secret = JSON.parse(secretValue.SecretString as string);
    return secret.apiKey || secret.api_key || secret.key || null;
  } catch (error) {
    console.error('Error getting Google Maps API key:', error);
    return null;
  }
}

/**
 * Calculate ETA using Google Maps Distance Matrix API
 */
async function calculateETAWithGoogleMaps(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ distance: number; duration: number; eta: number } | null> {
  try {
    const apiKey = await getGoogleMapsApiKey();
    if (!apiKey) {
      console.warn('Google Maps API key not found, using Haversine calculation');
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${apiKey}&mode=driving`;
    
    const response = await fetch(url);
    interface DistanceMatrixResponse {
      status: string;
      rows: { elements: { status: string; distance: { value: number }; duration: { value: number } }[] }[];
    }
    const data = (await response.json()) as DistanceMatrixResponse;

    if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
      const element = data.rows[0].elements[0];
      return {
        distance: element.distance.value / 1000, // Convert to km
        duration: element.duration.value / 60, // Convert to minutes
        eta: element.duration.value / 60, // ETA in minutes
      };
    }

    return null;
  } catch (error) {
    console.error('Error calculating ETA with Google Maps:', error);
    return null;
  }
}

export function registerTrackingEndpoints(app: Hono) {
  /**
   * GET /tracking/:bookingId/eta
   * Calculate ETA from current location to booking destination
   */
  app.get('/tracking/:bookingId/eta', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const currentLat = parseFloat(c.req.query('lat') || '0');
      const currentLng = parseFloat(c.req.query('lng') || '0');

      if (!currentLat || !currentLng) {
        return c.json({ error: 'Current location (lat, lng) is required' }, 400);
      }

      // Get booking details
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Get destination from booking (customer address for home services)
      let destinationLat: number | null = null;
      let destinationLng: number | null = null;

      if (booking.service_style === 'at_home' && booking.delivery_address) {
        try {
          const address = typeof booking.delivery_address === 'string' 
            ? JSON.parse(booking.delivery_address)
            : booking.delivery_address;
          destinationLat = parseFloat(address.latitude || address.lat || '0');
          destinationLng = parseFloat(address.longitude || address.lng || '0');
        } catch (e) {
          console.warn('Error parsing delivery address:', e);
        }
      } else if (booking.vendor_id) {
        // For center services, use vendor location
        const vendors = await select('vendors', { id: booking.vendor_id });
        if (vendors.length > 0) {
          destinationLat = parseFloat(vendors[0].latitude || '0');
          destinationLng = parseFloat(vendors[0].longitude || '0');
        }
      }

      if (!destinationLat || !destinationLng) {
        return c.json({ error: 'Destination location not found' }, 400);
      }

      // Try Google Maps API first
      const googleMapsResult = await calculateETAWithGoogleMaps(
        { lat: currentLat, lng: currentLng },
        { lat: destinationLat, lng: destinationLng }
      );

      if (googleMapsResult) {
        return c.json({
          success: true,
          eta: Math.round(googleMapsResult.eta),
          distance: Math.round(googleMapsResult.distance * 10) / 10,
          currentLocation: { lat: currentLat, lng: currentLng },
          destination: { lat: destinationLat, lng: destinationLng },
          method: 'google_maps',
        });
      }

      // Fallback to Haversine calculation with estimated speed
      const distance = calculateDistance(currentLat, currentLng, destinationLat, destinationLng);
      const averageSpeed = 30; // km/h (conservative estimate for city traffic)
      const eta = (distance / averageSpeed) * 60; // Convert to minutes

      return c.json({
        success: true,
        eta: Math.round(eta),
        distance: Math.round(distance * 10) / 10,
        currentLocation: { lat: currentLat, lng: currentLng },
        destination: { lat: destinationLat, lng: destinationLng },
        method: 'haversine',
      });
    } catch (error: any) {
      console.error('Error calculating ETA:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /tracking/:orderId/live
   * Get live location for pharmacy/meal order (polling or WebSocket)
   */
  app.get('/tracking/:orderId/live', async (c) => {
    try {
      const { orderId } = c.req.param();
      const orderType = c.req.query('type') || 'pharmacy'; // 'pharmacy' or 'meal'

      const column = orderType === 'pharmacy' ? 'pharmacy_order_id' : 'meal_order_id';
      
      const trackingResult = await query(
        `SELECT dt.*, 
                dlh.lat, dlh.lng, dlh.recorded_at
         FROM delivery_tracking dt
         LEFT JOIN delivery_location_history dlh ON dt.id = dlh.tracking_id
         WHERE dt.${column} = $1
         ORDER BY dlh.recorded_at DESC
         LIMIT 1`,
        [orderId]
      );

      if (trackingResult.rows.length === 0) {
        return c.json({ error: 'Tracking not found' }, 404);
      }

      const tracking = trackingResult.rows[0];

      return c.json({
        success: true,
        live: {
          currentLocation: tracking.current_lat && tracking.current_lng ? {
            lat: parseFloat(tracking.current_lat),
            lng: parseFloat(tracking.current_lng),
            updatedAt: tracking.last_location_update,
          } : null,
          latestHistory: tracking.lat && tracking.lng ? {
            lat: parseFloat(tracking.lat),
            lng: parseFloat(tracking.lng),
            recordedAt: tracking.recorded_at,
          } : null,
          status: tracking.status,
          eta: tracking.eta_to_delivery_minutes,
          distanceRemaining: tracking.distance_remaining_km,
        },
      });
    } catch (error: any) {
      console.error('Error getting live tracking:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
