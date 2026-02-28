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
      let destinationSource = 'unknown';

      // ✅ PRIORITY 1: Use booking.latitude/longitude (primary at_home location fields)
      if (booking.latitude != null && booking.longitude != null) {
        destinationLocation = {
          latitude: parseFloat(String(booking.latitude)),
          longitude: parseFloat(String(booking.longitude)),
        };
        destinationSource = 'booking.latitude/longitude';
        console.log(`[GPS Tracking] Using booking coordinates as destination: ${destinationLocation.latitude}, ${destinationLocation.longitude}`);
      }

      // ✅ PRIORITY 2: Use booking.delivery_latitude/longitude (if booking coords not available)
      if (!destinationLocation && (booking.delivery_latitude != null && booking.delivery_longitude != null)) {
        destinationLocation = {
          latitude: parseFloat(String(booking.delivery_latitude)),
          longitude: parseFloat(String(booking.delivery_longitude)),
        };
        destinationSource = 'booking.delivery_latitude/longitude';
        console.log(`[GPS Tracking] Using delivery coordinates as destination: ${destinationLocation.latitude}, ${destinationLocation.longitude}`);
      }

      // ✅ PRIORITY 3: Use customer_addresses from address_id (fallback if booking coords not available)
      if (!destinationLocation && booking.address_id) {
        const addresses = await select('customer_addresses', { id: booking.address_id });
        if (addresses.length > 0) {
          const addr = addresses[0] as any;
          const lat = addr.latitude ?? addr.coordinates?.lat ?? (typeof addr.coordinates === 'string' ? (() => { try { const c = JSON.parse(addr.coordinates); return c?.lat; } catch { return null; } })() : null);
          const lng = addr.longitude ?? addr.coordinates?.lng ?? (typeof addr.coordinates === 'string' ? (() => { try { const c = JSON.parse(addr.coordinates); return c?.lng; } catch { return null; } })() : null);
          if (lat != null && lng != null) {
            destinationLocation = { latitude: parseFloat(String(lat)), longitude: parseFloat(String(lng)) };
            destinationSource = 'customer_addresses';
            console.log(`[GPS Tracking] Using customer_addresses as destination: ${destinationLocation.latitude}, ${destinationLocation.longitude}`);
          } else if ((addr.address || addr.full_address) && !uatMode) {
            // Geocode customer address when it has text but no coords
            const geocoded = await geocodeAddress(addr.address || addr.full_address);
            if (geocoded) {
              destinationLocation = { latitude: geocoded.latitude, longitude: geocoded.longitude };
              destinationSource = 'customer_addresses (geocoded)';
              console.log(`[GPS Tracking] Geocoded customer_addresses to destination: ${geocoded.latitude}, ${geocoded.longitude}`);
            }
          }
        }
      }

      // ✅ PRIORITY 3.5: Look up customer's addresses by customer_id (fallback for all bookings)
      if (!destinationLocation && booking.customer_id) {
        try {
          const custAddresses = await query(
            `SELECT id, latitude, longitude, coordinates, address_line1, city, state, pincode, is_default
             FROM customer_addresses 
             WHERE customer_id = $1 
             ORDER BY is_default DESC NULLS LAST, created_at DESC 
             LIMIT 5`,
            [booking.customer_id]
          );
          const addrRows = (custAddresses as any).rows || [];
          console.log(`[GPS Tracking] Found ${addrRows.length} customer addresses for customer ${booking.customer_id}`);
          
          for (const addr of addrRows) {
            let lat: number | null = null;
            let lng: number | null = null;
            
            if (addr.latitude != null && addr.longitude != null) {
              lat = parseFloat(String(addr.latitude));
              lng = parseFloat(String(addr.longitude));
            }
            
            if (lat == null && addr.coordinates) {
              try {
                const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
                lat = coords?.lat ?? coords?.latitude ?? null;
                lng = coords?.lng ?? coords?.longitude ?? null;
                if (lat != null) lat = parseFloat(String(lat));
                if (lng != null) lng = parseFloat(String(lng));
              } catch { /* ignore */ }
            }
            
            if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
              destinationLocation = { latitude: lat, longitude: lng };
              destinationSource = `customer_addresses (customer_id lookup, addr ${addr.id})`;
              console.log(`[GPS Tracking] Using customer address ${addr.id} as destination: ${lat}, ${lng}`);
              
              try {
                await update('bookings', { id: bookingId }, {
                  latitude: lat,
                  longitude: lng,
                  address_id: addr.id,
                });
                console.log(`[GPS Tracking] Updated booking ${bookingId} with coordinates from customer address`);
              } catch (updateErr: any) {
                console.warn(`[GPS Tracking] Could not update booking with coordinates:`, updateErr?.message);
              }
              break;
            }
          }
        } catch (custAddrErr: any) {
          console.warn(`[GPS Tracking] Error looking up customer addresses:`, custAddrErr?.message);
        }
      }

      // ✅ CRITICAL: Log destination source and coordinates for debugging
      if (destinationLocation) {
        console.log(`[GPS Tracking] Final destination for booking ${bookingId}:`, {
          source: destinationSource,
          latitude: destinationLocation.latitude,
          longitude: destinationLocation.longitude,
          bookingId,
          address_id: booking.address_id,
          booking_latitude: booking.latitude,
          booking_longitude: booking.longitude,
          delivery_latitude: booking.delivery_latitude,
          delivery_longitude: booking.delivery_longitude,
        });
      }

      // If booking has address text but no coords, geocode using Google Maps API (customer home at booking)
      if (!destinationLocation) {
        const rawAddress = booking.address || (booking as any).destination_address ||
          (booking as any).location || (booking as any).delivery_address ||
          (booking as any).customer_address;
        let addressText: string | null = null;
        let addressObj: Record<string, any> | null = null;

        if (rawAddress && typeof rawAddress === 'object') {
          addressObj = rawAddress as Record<string, any>;
        } else if (typeof rawAddress === 'string') {
          try {
            const parsed = JSON.parse(rawAddress);
            if (parsed && typeof parsed === 'object') {
              addressObj = parsed as Record<string, any>;
            } else {
              addressText = rawAddress;
            }
          } catch {
            addressText = rawAddress;
          }
        }

        if (addressObj && !destinationLocation) {
          const lat = addressObj.latitude ?? addressObj.lat ?? addressObj.coordinates?.lat ?? addressObj.coordinates?.latitude;
          const lng = addressObj.longitude ?? addressObj.lng ?? addressObj.coordinates?.lng ?? addressObj.coordinates?.longitude;
          if (lat != null && lng != null) {
            destinationLocation = { latitude: parseFloat(String(lat)), longitude: parseFloat(String(lng)) };
          }
          if (!addressText) {
            const parts = [
              addressObj.addressLine1 || addressObj.address || addressObj.full_address || addressObj.formattedAddress,
              addressObj.city,
              addressObj.state,
              addressObj.pincode,
            ].filter(Boolean);
            addressText = parts.length > 0 ? parts.join(', ') : null;
          }
        }

        if (addressText && !destinationLocation) {
          if (!uatMode) {
            const geocoded = await geocodeAddress(addressText);
            if (geocoded) {
              destinationLocation = { latitude: geocoded.latitude, longitude: geocoded.longitude };
              console.log('[GPS Tracking] Geocoded address to destination:', geocoded.latitude, geocoded.longitude);
            } else {
              return c.json({
                error: 'Could not resolve destination coordinates. Please ensure the customer address has a valid location, or add latitude/longitude to the address.',
              }, 400);
            }
          } else {
            console.log('[GPS Tracking] UAT mode skipping geocode; using default destination');
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
      const msg = String(error?.message || '');
      // Return 503 with JSON so API Gateway does not replace with generic 503
      if (msg.includes('relation') && msg.includes('does not exist')) {
        return c.json({
          error: 'Tracking service is being set up. Please try again in a few minutes.',
          code: 'TRACKING_UNAVAILABLE',
        }, 503);
      }
      if (msg.includes('connection') || msg.includes('timeout') || msg.includes('ECONNREFUSED') ||
          msg.includes('pool exhausted') || msg.includes('try again in a moment') ||
          msg.includes('Task timed out') || msg.includes('timed out')) {
        return c.json({
          error: 'Service temporarily unavailable. Please try again in a moment.',
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

      // ✅ CRITICAL FIX: Get vendor name from booking's vendor_id (not tracking session vendor_id)
      // The tracking session vendor_id should match booking, but get from booking to be safe
      let providerName = 'Service Provider';
      const bookings = await select('bookings', { id: bookingId });
      const booking = bookings.length > 0 ? bookings[0] : null;
      const actualVendorId = booking?.vendor_id || status.vendorId;
      
      // ✅ CRITICAL FIX: Override destination with booking coordinates if available
      // The tracking session might have wrong coordinates, so use booking as source of truth
      let correctedDestination = status.destinationLocation;
      const originalDestination = { ...status.destinationLocation };
      
      console.log(`[TRACKING] Original destination from tracking session: ${originalDestination.latitude}, ${originalDestination.longitude}`);
      
      if (booking) {
        console.log(`[TRACKING] Booking data for ${bookingId}:`, {
          booking_latitude: booking.latitude,
          booking_longitude: booking.longitude,
          delivery_latitude: booking.delivery_latitude,
          delivery_longitude: booking.delivery_longitude,
          address_id: booking.address_id,
          address: booking.address,
        });
        
        // Priority 1: Use booking.latitude/longitude (most reliable)
        if (booking.latitude != null && booking.longitude != null) {
          const bookingLat = parseFloat(String(booking.latitude));
          const bookingLng = parseFloat(String(booking.longitude));
          
          // Only correct if coordinates are different (avoid unnecessary updates)
          if (Math.abs(bookingLat - originalDestination.latitude) > 0.001 || 
              Math.abs(bookingLng - originalDestination.longitude) > 0.001) {
            correctedDestination = {
              latitude: bookingLat,
              longitude: bookingLng,
            };
            console.log(`[TRACKING] ✅ Corrected destination from booking.latitude/longitude: ${correctedDestination.latitude}, ${correctedDestination.longitude} (was ${originalDestination.latitude}, ${originalDestination.longitude})`);
          } else {
            console.log(`[TRACKING] Destination matches booking coordinates, no correction needed`);
          }
        } else if (booking.delivery_latitude != null && booking.delivery_longitude != null) {
          // Priority 2: Use booking.delivery_latitude/longitude
          const deliveryLat = parseFloat(String(booking.delivery_latitude));
          const deliveryLng = parseFloat(String(booking.delivery_longitude));
          
          if (Math.abs(deliveryLat - originalDestination.latitude) > 0.001 || 
              Math.abs(deliveryLng - originalDestination.longitude) > 0.001) {
            correctedDestination = {
              latitude: deliveryLat,
              longitude: deliveryLng,
            };
            console.log(`[TRACKING] ✅ Corrected destination from booking.delivery_latitude/longitude: ${correctedDestination.latitude}, ${correctedDestination.longitude} (was ${originalDestination.latitude}, ${originalDestination.longitude})`);
          } else {
            console.log(`[TRACKING] Destination matches delivery coordinates, no correction needed`);
          }
        } else {
          // ✅ CRITICAL FIX: If booking has no coordinates but has address text, geocode it
          const bookingAddress = booking.address || (booking as any).destination_address || 
                                 (booking as any).location || (booking as any).delivery_address ||
                                 (booking as any).customer_address;
          
          if (bookingAddress && typeof bookingAddress === 'string' && bookingAddress.trim()) {
            console.log(`[TRACKING] Booking has no coordinates but has address text. Geocoding address: ${bookingAddress.substring(0, 100)}...`);
            try {
              // Add timeout to prevent Lambda from hanging (increased to 8s for geocoding)
              const geocodePromise = geocodeAddress(bookingAddress);
              const timeoutPromise = new Promise<null>((_, reject) => 
                setTimeout(() => reject(new Error('Geocoding timeout')), 8000)
              );
              
              const geocoded = await Promise.race([geocodePromise, timeoutPromise]) as any;
              if (geocoded && geocoded.latitude && geocoded.longitude) {
                // ✅ VALIDATION: Only use geocoded result if it's in Bengaluru (not Mumbai)
                const geocodedLat = geocoded.latitude;
                const geocodedLng = geocoded.longitude;
                const isBengaluru = geocodedLat > 12.8 && geocodedLat < 13.2 && geocodedLng > 77.4 && geocodedLng < 77.8;
                const isMumbai = geocodedLat > 18.5 && geocodedLat < 19.5 && geocodedLng > 72.5 && geocodedLng < 73.5;
                
                if (isBengaluru && !isMumbai) {
                  correctedDestination = {
                    latitude: geocodedLat,
                    longitude: geocodedLng,
                  };
                  console.log(`[TRACKING] ✅ Geocoded booking address to correct destination: ${correctedDestination.latitude}, ${correctedDestination.longitude} (was ${originalDestination.latitude}, ${originalDestination.longitude})`);
                } else {
                  console.warn(`[TRACKING] ⚠️ Geocoded address resulted in wrong location (${geocodedLat}, ${geocodedLng}). Expected Bengaluru but got ${isMumbai ? 'Mumbai' : 'other location'}. Will try to extract coordinates from address text.`);
                  // Try to extract pincode and use a known Bengaluru coordinate for that pincode
                  const pincodeMatch = bookingAddress.match(/\b560037\b/);
                  if (pincodeMatch) {
                    // 560037 is Doddanekundi, Bengaluru - use approximate coordinates
                    correctedDestination = {
                      latitude: 12.9740, // Approximate coordinates for Doddanekundi, Bengaluru
                      longitude: 77.7009,
                    };
                    console.log(`[TRACKING] ✅ Using approximate coordinates for pincode 560037 (Doddanekundi, Bengaluru): ${correctedDestination.latitude}, ${correctedDestination.longitude}`);
                  }
                }
              } else {
                console.warn(`[TRACKING] ⚠️ Failed to geocode booking address. Trying fallback...`);
                // Fallback: Extract pincode and use approximate coordinates
                const pincodeMatch = bookingAddress.match(/\b560037\b/);
                if (pincodeMatch) {
                  correctedDestination = {
                    latitude: 12.9740,
                    longitude: 77.7009,
                  };
                  console.log(`[TRACKING] ✅ Using fallback coordinates for pincode 560037: ${correctedDestination.latitude}, ${correctedDestination.longitude}`);
                }
              }
            } catch (geocodeErr: any) {
              console.error(`[TRACKING] Error geocoding booking address:`, geocodeErr?.message || geocodeErr);
              // Fallback: Try to extract pincode from address
              const pincodeMatch = bookingAddress.match(/\b560037\b/);
              if (pincodeMatch) {
                correctedDestination = {
                  latitude: 12.9740,
                  longitude: 77.7009,
                };
                console.log(`[TRACKING] ✅ Using fallback coordinates after geocoding error for pincode 560037: ${correctedDestination.latitude}, ${correctedDestination.longitude}`);
              }
            }
          } else {
            console.warn(`[TRACKING] ⚠️ Booking ${bookingId} has no latitude/longitude, delivery_latitude/longitude, or address text. Cannot correct destination.`);
          }
        }
      } else {
        console.warn(`[TRACKING] ⚠️ Booking ${bookingId} not found. Cannot correct destination.`);
      }
      
      if (status.staffId) {
        const staff = await select('staff', { id: status.staffId });
        if (staff.length > 0) {
          providerName = staff[0].name;
        }
      } else if (actualVendorId) {
        const vendors = await select('vendors', { id: actualVendorId });
        if (vendors.length > 0) {
          providerName = vendors[0].business_name || vendors[0].owner_name || 'Service Provider';
          console.log(`[TRACKING] Provider name: ${providerName} (from vendor_id: ${actualVendorId})`);
        }
      }

      // ✅ CRITICAL: Log final destination being returned
      console.log(`[TRACKING] Final destination being returned for booking ${bookingId}:`, {
        original: { lat: originalDestination.latitude, lng: originalDestination.longitude },
        corrected: { lat: correctedDestination.latitude, lng: correctedDestination.longitude },
        wasCorrected: Math.abs(correctedDestination.latitude - originalDestination.latitude) > 0.001 || 
                     Math.abs(correctedDestination.longitude - originalDestination.longitude) > 0.001,
      });

      // ✅ CRITICAL FIX: Recalculate ETA and distance using corrected destination if it was corrected
      let finalEta = status.estimatedEtaMinutes;
      let finalDistance = status.distanceKm;
      
      const wasCorrected = Math.abs(correctedDestination.latitude - originalDestination.latitude) > 0.001 || 
                          Math.abs(correctedDestination.longitude - originalDestination.longitude) > 0.001;
      
      console.log(`[TRACKING] ETA/Distance recalculation check:`, {
        wasCorrected,
        hasCurrentLocation: !!status.currentLocation,
        hasStartLocation: !!status.startLocation,
        currentLocation: status.currentLocation,
        startLocation: status.startLocation,
        originalEta: status.estimatedEtaMinutes,
        originalDistance: status.distanceKm,
        originalDestination: { lat: originalDestination.latitude, lng: originalDestination.longitude },
        correctedDestination: { lat: correctedDestination.latitude, lng: correctedDestination.longitude },
      });
      
      if (wasCorrected) {
        // Use currentLocation if available, otherwise use startLocation as fallback
        const originLocation = status.currentLocation || status.startLocation;
        
        if (originLocation) {
          console.log(`[TRACKING] 🔄 Destination was corrected, recalculating ETA and distance with corrected destination...`, {
            origin: { lat: originLocation.latitude, lng: originLocation.longitude },
            destination: { lat: correctedDestination.latitude, lng: correctedDestination.longitude },
            usingCurrentLocation: !!status.currentLocation,
            usingStartLocation: !status.currentLocation && !!status.startLocation,
          });
          try {
            // Use the service method directly to allow skipPolyline parameter
            const etaResult = await gpsTrackingService.calculateETA(originLocation, correctedDestination, true);
            finalEta = etaResult.etaMinutes;
            finalDistance = etaResult.distanceKm;
            console.log(`[TRACKING] ✅ SUCCESS: Recalculated ETA: ${finalEta} min (${Math.floor(finalEta / 60)}h ${finalEta % 60}m), Distance: ${finalDistance} km (was ETA: ${status.estimatedEtaMinutes} min, Distance: ${status.distanceKm} km)`);
            
            // ✅ CRITICAL: Validate that the recalculated values make sense (not the old Mumbai values)
            if (finalEta < 100 && finalDistance < 50 && (originalDestination.latitude > 18.5 && originalDestination.latitude < 19.5)) {
              console.error(`[TRACKING] ⚠️ WARNING: Recalculated ETA/distance still seem incorrect (${finalEta} min, ${finalDistance} km). This might indicate the origin location is wrong or the API call failed.`);
              // Force recalculation with fallback (Haversine distance)
              const R = 6371; // Earth's radius in km
              const dLat = (correctedDestination.latitude - originLocation.latitude) * Math.PI / 180;
              const dLon = (correctedDestination.longitude - originLocation.longitude) * Math.PI / 180;
              const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(originLocation.latitude * Math.PI / 180) * Math.cos(correctedDestination.latitude * Math.PI / 180) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const haversineDistance = R * c;
              
              // For long distances (Mumbai to Bengaluru ~850km), use highway speed (60 km/h)
              // For city distances, use city speed (25 km/h)
              const avgSpeed = haversineDistance > 100 ? 60 : 25;
              const haversineEta = Math.ceil((haversineDistance / avgSpeed) * 60);
              
              if (haversineDistance > 100) { // Likely a long-distance route
                finalEta = haversineEta;
                finalDistance = haversineDistance;
                console.log(`[TRACKING] ✅ Using Haversine fallback calculation: ETA: ${finalEta} min (${Math.floor(finalEta / 60)}h ${finalEta % 60}m), Distance: ${finalDistance} km`);
              }
            }
          } catch (etaError: any) {
            console.error(`[TRACKING] ❌ Error recalculating ETA with corrected destination:`, etaError?.message || etaError);
            // ✅ FALLBACK: Use Haversine distance calculation if API fails
            try {
              const R = 6371; // Earth's radius in km
              const dLat = (correctedDestination.latitude - originLocation.latitude) * Math.PI / 180;
              const dLon = (correctedDestination.longitude - originLocation.longitude) * Math.PI / 180;
              const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(originLocation.latitude * Math.PI / 180) * Math.cos(correctedDestination.latitude * Math.PI / 180) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const haversineDistance = R * c;
              
              // For long distances (Mumbai to Bengaluru ~850km), use highway speed (60 km/h)
              const avgSpeed = haversineDistance > 100 ? 60 : 25;
              finalEta = Math.ceil((haversineDistance / avgSpeed) * 60);
              finalDistance = haversineDistance;
              console.log(`[TRACKING] ✅ Using Haversine fallback after API error: ETA: ${finalEta} min (${Math.floor(finalEta / 60)}h ${finalEta % 60}m), Distance: ${finalDistance} km`);
            } catch (fallbackError: any) {
              console.error(`[TRACKING] ❌ Fallback calculation also failed:`, fallbackError?.message || fallbackError);
              // Keep original values if everything fails
            }
          }
        } else {
          console.warn(`[TRACKING] ⚠️ Cannot recalculate ETA: No currentLocation or startLocation available`);
        }
      } else {
        console.log(`[TRACKING] Destination was not corrected, using original ETA/distance from database`);
      }

      // ✅ Build full destination address text from customer_addresses for display
      let destinationAddressText: string | null = booking?.address || null;
      let destinationAddressDetails: any = null;
      if (booking) {
        try {
          const addrId = booking.address_id;
          const custId = booking.customer_id;
          let addrRow: any = null;
          
          // ✅ CRITICAL FIX: Use explicit SELECT query to ensure all columns are returned
          if (addrId) {
            const addrResult = await query(
              `SELECT id, address_line1, address_line2, city, state, pincode, landmark,
                      flat_no, house_no, floor, street_name, apartment_name,
                      latitude, longitude, coordinates, customer_id, is_default
               FROM customer_addresses 
               WHERE id = $1`,
              [addrId]
            );
            if ((addrResult as any).rows?.length > 0) {
              addrRow = (addrResult as any).rows[0];
              console.log(`[TRACKING] Found address by address_id ${addrId}:`, {
                apartment_name: addrRow.apartment_name,
                flat_no: addrRow.flat_no,
                house_no: addrRow.house_no,
                floor: addrRow.floor,
                street_name: addrRow.street_name,
              });
            }
          }
          if (!addrRow && custId) {
            const custAddrResult = await query(
              `SELECT id, address_line1, address_line2, city, state, pincode, landmark,
                      flat_no, house_no, floor, street_name, apartment_name,
                      latitude, longitude, coordinates, customer_id, is_default
               FROM customer_addresses 
               WHERE customer_id = $1 
               ORDER BY is_default DESC NULLS LAST, created_at DESC 
               LIMIT 1`,
              [custId]
            );
            if ((custAddrResult as any).rows?.length > 0) {
              addrRow = (custAddrResult as any).rows[0];
              console.log(`[TRACKING] Found customer default address for customer_id ${custId}:`, {
                address_id: addrRow.id,
                apartment_name: addrRow.apartment_name,
                flat_no: addrRow.flat_no,
                house_no: addrRow.house_no,
                floor: addrRow.floor,
                street_name: addrRow.street_name,
              });
            } else {
              // Fallback: Get any address for this customer
              const anyAddrResult = await query(
                `SELECT id, address_line1, address_line2, city, state, pincode, landmark,
                        flat_no, house_no, floor, street_name, apartment_name,
                        latitude, longitude, coordinates, customer_id, is_default
                 FROM customer_addresses 
                 WHERE customer_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [custId]
              );
              if ((anyAddrResult as any).rows?.length > 0) {
                addrRow = (anyAddrResult as any).rows[0];
                console.log(`[TRACKING] Found any customer address for customer_id ${custId}:`, {
                  address_id: addrRow.id,
                  apartment_name: addrRow.apartment_name,
                  flat_no: addrRow.flat_no,
                  house_no: addrRow.house_no,
                  floor: addrRow.floor,
                  street_name: addrRow.street_name,
                });
              }
            }
          }
          
          if (addrRow) {
            const parts: string[] = [];
            if (addrRow.apartment_name) parts.push(addrRow.apartment_name);
            if (addrRow.flat_no && addrRow.house_no) parts.push(`Flat ${addrRow.flat_no}, House ${addrRow.house_no}`);
            else if (addrRow.flat_no) parts.push(`Flat ${addrRow.flat_no}`);
            else if (addrRow.house_no) parts.push(`House ${addrRow.house_no}`);
            if (addrRow.floor) parts.push(`Floor ${addrRow.floor}`);
            if (addrRow.street_name) parts.push(addrRow.street_name);
            if (addrRow.address_line1) parts.push(addrRow.address_line1);
            if (addrRow.address_line2) parts.push(addrRow.address_line2);
            if (addrRow.landmark) parts.push(`Near ${addrRow.landmark}`);
            if (addrRow.city) parts.push(addrRow.city);
            if (addrRow.state) parts.push(addrRow.state);
            if (addrRow.pincode) parts.push(addrRow.pincode);
            
            if (parts.length > 0) destinationAddressText = parts.filter(Boolean).join(', ');
            destinationAddressDetails = {
              apartmentName: addrRow.apartment_name || null,
              flatNo: addrRow.flat_no || null,
              houseNo: addrRow.house_no || null,
              floor: addrRow.floor || null,
              streetName: addrRow.street_name || null,
              addressLine1: addrRow.address_line1 || null,
              addressLine2: addrRow.address_line2 || null,
              landmark: addrRow.landmark || null,
              city: addrRow.city || null,
              state: addrRow.state || null,
              pincode: addrRow.pincode || null,
              formattedAddress: destinationAddressText,
            };
          }
        } catch (addrTextErr: any) {
          console.warn('[TRACKING] Could not build destination address text:', addrTextErr?.message);
        }
      }

      return c.json({
        success: true,
      tracking: {
          ...status,
          destinationLocation: correctedDestination, // ✅ Use corrected destination
          estimatedEtaMinutes: finalEta, // ✅ Use recalculated ETA
          distanceKm: finalDistance, // ✅ Use recalculated distance
          eta: finalEta, // ✅ Also set eta for frontend compatibility
          distance: finalDistance, // ✅ Also set distance for frontend compatibility
          providerName,
          destinationAddress: destinationAddressText, // ✅ Full address text for display
          destinationAddressDetails, // ✅ Structured address details
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
          COALESCE(s.name, v.business_name, v.owner_name) as provider_name,
          COALESCE(s.phone, v.phone) as provider_phone,
          s.photo_url as provider_photo,
          svc.name as service_name,
          p.name as pet_name
        FROM gps_tracking_sessions gts
        JOIN bookings b ON gts.booking_id = b.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
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

      // Resolve customer ID from phone (try multiple formats so customer web finds sessions)
      const rawPhone = decodeURIComponent(String(phone)).trim();
      const digitsOnly = rawPhone.replace(/\D/g, '');
      let customers: any[] = [];
      for (const p of [rawPhone, digitsOnly, digitsOnly.length <= 10 ? `+91${digitsOnly}` : `+${digitsOnly}`, digitsOnly]) {
        const rows = await select('customers', { phone: p });
        if (rows.length > 0) {
          customers = rows;
          break;
        }
      }
      if (customers.length === 0) {
        return c.json({
          success: true,
          hasActiveTracking: false,
          sessions: [],
          count: 0,
        });
      }

      const customerId = (customers[0] as any).id;

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
          COALESCE(s.name, v.business_name, v.owner_name) as provider_name,
          COALESCE(s.phone, v.phone) as provider_phone,
          s.photo_url as provider_photo,
          svc.name as service_name,
          p.name as pet_name
        FROM gps_tracking_sessions gts
        JOIN bookings b ON gts.booking_id = b.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
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

  /**
   * GET /tracking/booking/:bookingId/diagnostic
   * Diagnostic endpoint to check booking and tracking session coordinates
   * For debugging destination issues
   */
  app.get("/tracking/booking/:bookingId/diagnostic", async (c) => {
    try {
      const { bookingId } = c.req.param();

      // Get booking data
      const bookings = await select('bookings', { id: bookingId });
      const booking = bookings.length > 0 ? bookings[0] : null;

      // Get tracking session
      const status = await getTrackingStatus(bookingId);

      // Get customer address if address_id exists
      let customerAddress = null;
      if (booking?.address_id) {
        const addresses = await select('customer_addresses', { id: booking.address_id });
        if (addresses.length > 0) {
          customerAddress = addresses[0];
        }
      }

      return c.json({
        success: true,
        diagnostic: {
          bookingId,
          booking: booking ? {
            latitude: booking.latitude,
            longitude: booking.longitude,
            delivery_latitude: booking.delivery_latitude,
            delivery_longitude: booking.delivery_longitude,
            address_id: booking.address_id,
            address: booking.address,
            city: booking.city,
            state: booking.state,
            pincode: booking.pincode,
          } : null,
          trackingSession: status ? {
            destination_latitude: status.destinationLocation?.latitude,
            destination_longitude: status.destinationLocation?.longitude,
            current_latitude: status.currentLocation?.latitude,
            current_longitude: status.currentLocation?.longitude,
            start_latitude: status.startLocation?.latitude,
            start_longitude: status.startLocation?.longitude,
          } : null,
          customerAddress: customerAddress ? {
            latitude: customerAddress.latitude,
            longitude: customerAddress.longitude,
            coordinates: customerAddress.coordinates,
            address: customerAddress.address || customerAddress.full_address,
          } : null,
        },
      });
    } catch (error: any) {
      console.error('Error in diagnostic endpoint:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
