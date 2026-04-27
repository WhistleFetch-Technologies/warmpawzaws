/**
 * ============================================================================
 * VENDOR BOOKING ACTIONS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Endpoints for vendors to take actions on bookings:
 * - Complete booking with OTP verification
 * - Start session (for services like dog walking)
 * - End session
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query, insert } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { geocodeAddress } from '../lib/utils/geocode';
import { resolveVendorId } from '../utils/vendor-resolve';
import { bookingUsesDedicatedEndSessionOtp, ensureDedicatedEndSessionOtp } from '../lib/booking-dedicated-end-otp';

/**
 * Get commission rate for a vendor from their tier configuration
 * @param vendorId - The vendor ID
 * @returns Commission rate as a percentage (e.g., 20 for 20%)
 */
async function getVendorCommissionRate(vendorId: string): Promise<number> {
  try {
    const tierResult = await query(
      `SELECT vt.commission_rate
       FROM vendors v
       LEFT JOIN vendor_tiers vt ON vt.is_active = true 
         AND (TRIM(LOWER(v.tier)) = TRIM(LOWER(vt.tier_name)))
       WHERE v.id = $1
       LIMIT 1`,
      [vendorId]
    );

    const commissionRate = tierResult.rows?.[0]?.commission_rate;
    
    // If commission_rate is null/undefined, fallback to 15%
    if (commissionRate != null && !isNaN(Number(commissionRate))) {
      return Number(commissionRate);
    }
    
    console.warn(`⚠️ [COMMISSION] No tier found for vendor ${vendorId}, using default 15%`);
    return 15; // Default fallback
  } catch (error: any) {
    console.error(`❌ [COMMISSION] Error getting commission rate for vendor ${vendorId}:`, error);
    return 15; // Default fallback on error
  }
}

/**
 * Helper function to get the correct OTP for a booking based on action and service type
 * @param booking - The booking object
 * @param bookingId - The booking ID
 * @param action - 'start' or 'complete' (or 'end')
 * @returns Object with expectedOTP and isWalkerService flag
 */
async function getExpectedOTPForBooking(
  booking: any,
  bookingId: string,
  action: 'start' | 'complete' | 'end' = 'complete'
): Promise<{ expectedOTP: string; isWalkerService: boolean }> {
  let isWalkerService = false;
  let expectedOTP = '';

  // For 'start' action, always use otp_code (start OTP)
  if (action === 'start') {
    expectedOTP = String(booking.otp_code || '').trim();
    return { expectedOTP, isWalkerService: false };
  }

  // For 'complete' or 'end' action: dedicated end OTP for at-home walks / sitters (see booking-dedicated-end-otp)
  try {
    isWalkerService = await bookingUsesDedicatedEndSessionOtp(bookingId);

    if (isWalkerService) {
      const endOtpResult = await query(
        `SELECT otp_code FROM otp_tokens
         WHERE metadata->>'bookingId' = $1
           AND metadata->>'action' = 'end'
           AND is_used = false
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC
         LIMIT 1`,
        [bookingId]
      ).catch(() => ({ rows: [] }));

      const endOtpRows = Array.isArray(endOtpResult) ? endOtpResult : (endOtpResult as any).rows || [];
      if (endOtpRows.length > 0) {
        expectedOTP = String(endOtpRows[0].otp_code || '').trim();
      } else {
        expectedOTP = String(booking.otp_code || '').trim();
      }
    } else {
      expectedOTP = String(booking.otp_code || '').trim();
    }
  } catch (error: any) {
    console.error(`❌ [getExpectedOTPForBooking] Error checking dedicated end OTP, falling back to otp_code:`, error);
    expectedOTP = String(booking.otp_code || '').trim();
  }

  return { expectedOTP, isWalkerService };
}

export function registerVendorBookingActionsEndpoints(app: Hono) {
  /**
   * POST /vendor/bookings/:bookingId/complete
   * Complete a booking with OTP verification
   */
  app.post("/vendor/bookings/:bookingId/complete", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId } = await c.req.json();

      console.log(`📋 [COMPLETE-BOOKING] Vendor ${vendorId} completing booking ${bookingId} with OTP: ${otp}`);

      // ✅ CRITICAL FIX: Resolve vendorId (may be vendor_identity.id) to canonical vendors.id
      const resolvedVendorId = await resolveVendorId(vendorId);
      console.log(`📋 [COMPLETE-BOOKING] Resolved vendorId ${vendorId} to ${resolvedVendorId}`);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // ✅ FIX: Resolve booking's vendor_id as well (may also be vendor_identity.id)
      const resolvedBookingVendorId = await resolveVendorId(booking.vendor_id);
      console.log(`📋 [COMPLETE-BOOKING] Resolved booking vendor_id ${booking.vendor_id} to ${resolvedBookingVendorId}`);

      // ✅ FIX: Verify vendor owns this booking - check both resolved vendor IDs
      // Also check by phone number for solo providers (same vendor with different IDs)
      let vendorAuthorized = false;

      // Direct match (after resolution)
      if (resolvedBookingVendorId === resolvedVendorId || 
          booking.vendor_id === resolvedVendorId || 
          resolvedBookingVendorId === vendorId ||
          booking.vendor_id === vendorId) {
        vendorAuthorized = true;
        console.log(`✅ [COMPLETE-BOOKING] Authorized: Direct vendor ID match`);
      } else {
        // Check if both vendor IDs resolve to the same vendor by phone number (solo provider case)
        try {
          const bookingVendor = await select('vendors', { id: resolvedBookingVendorId });
          const requestingVendor = await select('vendors', { id: resolvedVendorId });
          
          if (bookingVendor.length > 0 && requestingVendor.length > 0) {
            const bookingVendorPhone = bookingVendor[0].phone;
            const requestingVendorPhone = requestingVendor[0].phone;
            
            // Same phone = same solo provider
            if (bookingVendorPhone && requestingVendorPhone && bookingVendorPhone === requestingVendorPhone) {
              console.log(`✅ [COMPLETE-BOOKING] Authorized: Same vendor by phone (${bookingVendorPhone})`);
              vendorAuthorized = true;
            }
          }
          
          // Also check vendor_identity for solo providers
          if (!vendorAuthorized) {
            const bookingVendorIdentity = await query(
              `SELECT id, phone FROM vendor_identity WHERE id::text = $1 OR id = $1 LIMIT 1`,
              [booking.vendor_id]
            ).catch(() => ({ rows: [] }));
            
            const requestingVendorIdentity = await query(
              `SELECT id, phone FROM vendor_identity WHERE id::text = $1 OR id = $1 LIMIT 1`,
              [vendorId]
            ).catch(() => ({ rows: [] }));
            
            const bookingIdentity = (bookingVendorIdentity as any).rows?.[0];
            const requestingIdentity = (requestingVendorIdentity as any).rows?.[0];
            
            if (bookingIdentity && requestingIdentity && bookingIdentity.phone === requestingIdentity.phone) {
              console.log(`✅ [COMPLETE-BOOKING] Authorized: Same vendor by vendor_identity phone (${bookingIdentity.phone})`);
              vendorAuthorized = true;
            }
          }
        } catch (authError: any) {
          console.error(`⚠️ [COMPLETE-BOOKING] Error checking vendor authorization:`, authError);
        }
      }

      if (!vendorAuthorized) {
        console.error(`❌ [COMPLETE-BOOKING] Unauthorized: Booking vendor_id=${booking.vendor_id} (resolved=${resolvedBookingVendorId}), Requesting vendorId=${vendorId} (resolved=${resolvedVendorId})`);
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }

      // Check if booking is already completed
      if (booking.status === 'completed') {
        return c.json({ error: 'Booking is already completed' }, 400);
      }

      // ✅ FIXED: For tele/video consultations, no OTP required - completed via prescription upload or video call end
      const isTeleConsultation = booking.service_type === 'tele' || 
                                  booking.service_type === 'video_consultation' ||
                                  booking.service_style === 'tele';
      
      if (isTeleConsultation) {
        const updated = await update('bookings',
          { id: bookingId },
          {
            status: 'completed',
            completed_at: new Date().toISOString(),
          }
        );

        console.log(`✅ [COMPLETE-BOOKING] Tele consultation completed without OTP (prescription/call ended)`);
        
        // ✅ Create vendor_earnings for tele consultation (regardless of payment status — handles COD/pending)
        try {
          const commissionRate = await getVendorCommissionRate(booking.vendor_id);
          const totalAmount = parseFloat(booking.total_amount || '0');
          const commissionAmount = Math.round((totalAmount * commissionRate / 100) * 100) / 100;
          const vendorAmount = Math.round((totalAmount - commissionAmount) * 100) / 100;
          
          const existingEarnings = await query(
            `SELECT id FROM vendor_earnings WHERE booking_id = $1`,
            [bookingId]
          ).catch(() => ({ rows: [] }));
          
          const existingRows = (existingEarnings as any).rows || [];
          
          if (existingRows.length === 0 && vendorAmount > 0) {
            await insert('vendor_earnings', {
              vendor_id: booking.vendor_id,
              booking_id: bookingId,
              amount: vendorAmount,
              commission_amount: commissionAmount,
              total_amount: totalAmount,
              commission_rate: commissionRate,
              status: 'pending',
              realized_at: new Date().toISOString(),
            });
            console.log(`✅ [EARNINGS] Created vendor_earnings for tele booking ${bookingId}: vendor gets ₹${vendorAmount}`);
            
            // Update vendor totals (non-critical)
            await query(
              `UPDATE vendors 
               SET pending_payout = COALESCE(pending_payout, 0) + $1,
                   total_earnings = COALESCE(total_earnings, 0) + $1,
                   updated_at = NOW()
               WHERE id = $2`,
              [vendorAmount, booking.vendor_id]
            ).catch((err: any) => console.warn('[EARNINGS] vendor totals update:', err?.message));
          }
        } catch (error: any) {
          console.error('❌ [EARNINGS] Failed to create earnings for tele consultation:', error);
        }
        
        return c.json({ success: true, booking: updated[0], message: 'Tele consultation completed successfully!' });
      }

      // Verify OTP for in-person services
      if (!otp) {
        return c.json({ error: 'OTP is required for in-person services' }, 400);
      }

      // ✅ FIX: Get correct OTP based on service type (walker vs non-walker)
      // For walker services: use end OTP from otp_tokens table
      // For other services: use otp_code from bookings table (single OTP for completion)
      const { expectedOTP, isWalkerService } = await getExpectedOTPForBooking(booking, bookingId, 'complete');
      const providedOTP = String(otp).trim();

      if (!expectedOTP) {
        console.error(`❌ [COMPLETE-BOOKING] No OTP found for booking ${bookingId}`);
        return c.json({ error: 'No OTP found for this booking. Please contact support.' }, 400);
      }

      if (expectedOTP !== providedOTP) {
        console.error(`❌ [COMPLETE-BOOKING] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}" (Walker: ${isWalkerService})`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }
      
      // ✅ Mark end OTP as used if it's a walker service
      if (isWalkerService) {
        try {
          await update('otp_tokens',
            { 
              'metadata->>bookingId': bookingId,
              'metadata->>action': 'end',
              is_used: false
            },
            { is_used: true }
          );
          console.log(`✅ [COMPLETE-BOOKING] Marked end OTP as used for walker service`);
        } catch (error: any) {
          console.warn(`⚠️ [COMPLETE-BOOKING] Failed to mark end OTP as used:`, error);
          // Non-critical, continue with completion
        }
      }

      // Mark booking as completed
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'completed',
          otp_verified: true,
          completed_at: new Date().toISOString(),
        }
      );

      console.log(`✅ [COMPLETE-BOOKING] Booking completed successfully with OTP verification`);

      // Close any active GPS tracking session for this booking. Without this the
      // home-screen "Vendor on the way" card and the live-tracking ETA banner
      // continue to render after the at-home service is finished, because
      // CUSTOMER_ACTIVE_TRACKING_SESSIONS_SQL only filters on session-level
      // statuses ('in_transit','arrived'). Booking-level filtering also exists
      // (see gps-tracking.ts NOT IN ('completed', ...)), but updating the
      // session here makes the cleanup correct at every layer.
      try {
        await query(
          `UPDATE gps_tracking_sessions
             SET status = 'completed',
                 ended_at = NOW(),
                 last_update_at = NOW()
           WHERE booking_id = $1
             AND status IN ('started', 'in_transit', 'arrived')`,
          [bookingId]
        );
      } catch (gpsErr: any) {
        // Non-fatal: most bookings won't have a GPS session row at all.
        console.warn(`[COMPLETE-BOOKING] GPS session close (non-fatal):`, gpsErr?.message);
      }

      // ✅ CRITICAL FIX: Create vendor_earnings record regardless of payment status (handles COD/pending)
      try {
        const commissionRate = await getVendorCommissionRate(booking.vendor_id);
        const totalAmount = parseFloat(booking.total_amount || '0');
        const commissionAmount = Math.round((totalAmount * commissionRate / 100) * 100) / 100;
        const vendorAmount = Math.round((totalAmount - commissionAmount) * 100) / 100;
        
        // Check if vendor_earnings record already exists for this booking
        const existingEarnings = await query(
          `SELECT id FROM vendor_earnings WHERE booking_id = $1`,
          [bookingId]
        ).catch(() => ({ rows: [] }));
        
        const existingRows = (existingEarnings as any).rows || [];
        
        if (existingRows.length === 0 && vendorAmount > 0) {
          // Create vendor_earnings record
          await insert('vendor_earnings', {
            vendor_id: booking.vendor_id,
            booking_id: bookingId,
            amount: vendorAmount,
            commission_amount: commissionAmount,
            total_amount: totalAmount,
            commission_rate: commissionRate,
            status: 'pending',
            realized_at: new Date().toISOString(),
          });
          
          console.log(`✅ [EARNINGS] Created vendor_earnings for booking ${bookingId}: vendor gets ₹${vendorAmount} (commission: ₹${commissionAmount})`);
          
          // Update vendor's total earnings and pending payout (non-critical)
          await query(
            `UPDATE vendors 
             SET pending_payout = COALESCE(pending_payout, 0) + $1,
                 total_earnings = COALESCE(total_earnings, 0) + $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [vendorAmount, booking.vendor_id]
          ).catch((err: any) => console.warn('[EARNINGS] vendor totals update:', err?.message));
        }
      } catch (error: any) {
        console.error('❌ [EARNINGS] Failed to create earnings after booking completion:', error);
        // Don't fail booking completion if earnings creation fails
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking completed successfully!',
      });
    } catch (error: any) {
      console.error('Error completing booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/start-travel
   * Start traveling to customer location (initiates GPS tracking)
   * This is called when vendor clicks "Start Travel" button
   */
  app.post("/vendor/bookings/:bookingId/start-travel", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, staffId, startLocation } = await c.req.json();

      console.log(`🚗 [START-TRAVEL] Request: bookingId=${bookingId}, vendorId=${vendorId}, staffId=${staffId || 'none'}`);

      // ✅ CRITICAL FIX: Resolve vendorId (may be vendor_identity.id) to vendors.id
      const resolvedVendorId = await resolveVendorId(vendorId);
      console.log(`🚗 [START-TRAVEL] Resolved vendorId: ${vendorId} -> ${resolvedVendorId}`);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        console.error(`🚗 [START-TRAVEL] Booking ${bookingId} not found`);
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      const bookingVendorId = booking.vendor_id;
      
      // ✅ DEBUG: Log both IDs for comparison
      console.log(`🚗 [START-TRAVEL] Comparison: booking.vendor_id=${bookingVendorId} (type: ${typeof bookingVendorId}), resolvedVendorId=${resolvedVendorId} (type: ${typeof resolvedVendorId})`);
      console.log(`🚗 [START-TRAVEL] String comparison: "${String(bookingVendorId)}" === "${String(resolvedVendorId)}" = ${String(bookingVendorId) === String(resolvedVendorId)}`);

      // ✅ CRITICAL FIX: Compare using resolved vendorId and handle type mismatches
      const bookingVendorIdStr = String(bookingVendorId || '').trim().toLowerCase();
      const resolvedVendorIdStr = String(resolvedVendorId || '').trim().toLowerCase();
      
      if (bookingVendorIdStr !== resolvedVendorIdStr && bookingVendorId !== resolvedVendorId) {
        console.error(`🚗 [START-TRAVEL] UNAUTHORIZED: Booking ${bookingId} belongs to vendor ${bookingVendorId}, but request is from vendor ${resolvedVendorId} (original: ${vendorId})`);
        
        // ✅ ADDITIONAL DEBUG: Check if vendorId matches by looking up vendor details
        try {
          const vendorCheck = await select('vendors', { id: resolvedVendorId });
          const bookingVendorCheck = await select('vendors', { id: bookingVendorId });
          console.log(`🚗 [START-TRAVEL] Vendor check: resolvedVendor exists=${vendorCheck.length > 0}, bookingVendor exists=${bookingVendorCheck.length > 0}`);
          if (vendorCheck.length > 0) {
            console.log(`🚗 [START-TRAVEL] Resolved vendor: ${JSON.stringify({ id: vendorCheck[0].id, phone: vendorCheck[0].phone, business_name: vendorCheck[0].business_name })}`);
          }
          if (bookingVendorCheck.length > 0) {
            console.log(`🚗 [START-TRAVEL] Booking vendor: ${JSON.stringify({ id: bookingVendorCheck[0].id, phone: bookingVendorCheck[0].phone, business_name: bookingVendorCheck[0].business_name })}`);
          }
        } catch (debugErr) {
          console.warn(`🚗 [START-TRAVEL] Debug vendor lookup failed:`, debugErr);
        }
        
        return c.json({ 
          error: 'Unauthorized: This booking belongs to another vendor',
          debug: {
            bookingVendorId,
            requestedVendorId: vendorId,
            resolvedVendorId,
            comparison: {
              strict: booking.vendor_id === vendorId,
              resolved: bookingVendorIdStr === resolvedVendorIdStr,
            }
          }
        }, 403);
      }

      // Check if already traveling
      if (booking.status === 'vendor_on_way' || booking.status === 'in_transit') {
        return c.json({ error: 'Travel already started' }, 400);
      }

      // Call the GPS tracking start endpoint internally
      try {
        const { startTracking } = await import('../lib/services/gps-tracking-service');
        const { isUATMode } = await import('../lib/utils/uat-mode');
        
        const uatMode = isUATMode({ 
          isUAT: false, 
          headers: Object.fromEntries(c.req.raw.headers.entries()) 
        });

        // Get start location (current vendor location)
        let vendorStartLocation = startLocation;
        if (!vendorStartLocation?.latitude && uatMode) {
          // UAT mode: use default vendor location
          vendorStartLocation = { latitude: 19.0596, longitude: 72.8295 };
          console.log('[START-TRAVEL] UAT Mode: Using mock vendor location');
        }
        if (
          vendorStartLocation == null ||
          vendorStartLocation.latitude == null ||
          vendorStartLocation.longitude == null ||
          Number.isNaN(Number(vendorStartLocation.latitude)) ||
          Number.isNaN(Number(vendorStartLocation.longitude))
        ) {
          return c.json(
            {
              success: false,
              error:
                'startLocation with latitude and longitude is required (enable location, then try again).',
              code: 'START_LOCATION_REQUIRED',
            },
            400
          );
        }

        // Get destination: address_id → customer_addresses, then booking coords, then booking address fallback
        let destinationLocation: { latitude: number; longitude: number } | null = null;
        let destinationSource = 'unknown';

        // ✅ PRIORITY 1: Use booking.latitude/longitude (primary at_home location fields)
        if (booking.latitude != null && booking.longitude != null) {
          destinationLocation = {
            latitude: parseFloat(String(booking.latitude)),
            longitude: parseFloat(String(booking.longitude)),
          };
          destinationSource = 'booking.latitude/longitude';
          console.log(`[START-TRAVEL] Using booking coordinates as destination: ${destinationLocation.latitude}, ${destinationLocation.longitude}`);
        }

        // ✅ PRIORITY 2: Use booking.delivery_latitude/longitude (if booking coords not available)
        if (!destinationLocation && (booking.delivery_latitude != null && booking.delivery_longitude != null)) {
          destinationLocation = {
            latitude: parseFloat(String(booking.delivery_latitude)),
            longitude: parseFloat(String(booking.delivery_longitude)),
          };
          destinationSource = 'booking.delivery_latitude/longitude';
          console.log(`[START-TRAVEL] Using delivery coordinates as destination: ${destinationLocation.latitude}, ${destinationLocation.longitude}`);
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
              console.log(`[START-TRAVEL] Using customer_addresses as destination: ${destinationLocation.latitude}, ${destinationLocation.longitude}`);
            } else if ((addr.address || addr.full_address) && !uatMode) {
              const geocoded = await geocodeAddress(addr.address || addr.full_address);
              if (geocoded) {
                destinationLocation = { latitude: geocoded.latitude, longitude: geocoded.longitude };
                destinationSource = 'customer_addresses (geocoded)';
                console.log(`[START-TRAVEL] Geocoded customer_addresses to destination: ${geocoded.latitude}, ${geocoded.longitude}`);
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
            console.log(`[START-TRAVEL] Found ${addrRows.length} customer addresses for customer ${booking.customer_id}`);
            
            for (const addr of addrRows) {
              let lat: number | null = null;
              let lng: number | null = null;
              
              // Check direct lat/lng columns
              if (addr.latitude != null && addr.longitude != null) {
                lat = parseFloat(String(addr.latitude));
                lng = parseFloat(String(addr.longitude));
              }
              
              // Check coordinates JSONB
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
                console.log(`[START-TRAVEL] Using customer address ${addr.id} as destination: ${lat}, ${lng}`);
                
                // Also update the booking with the coordinates and address_id for future lookups
                try {
                  await update('bookings', { id: bookingId }, {
                    latitude: lat,
                    longitude: lng,
                    address_id: addr.id,
                  });
                  console.log(`[START-TRAVEL] Updated booking ${bookingId} with coordinates from customer address`);
                } catch (updateErr: any) {
                  console.warn(`[START-TRAVEL] Could not update booking with coordinates:`, updateErr?.message);
                }
                break;
              }
            }
          } catch (custAddrErr: any) {
            console.warn(`[START-TRAVEL] Error looking up customer addresses:`, custAddrErr?.message);
          }
        }

        // ✅ PRIORITY 4: Parse booking.address as JSON object or string
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
              destinationSource = 'booking.address (parsed object)';
              console.log(`[START-TRAVEL] Using parsed booking.address as destination: ${destinationLocation.latitude}, ${destinationLocation.longitude}`);
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

          if (addressText && !destinationLocation && !uatMode) {
            const geocoded = await geocodeAddress(addressText);
            if (geocoded) {
              destinationLocation = { latitude: geocoded.latitude, longitude: geocoded.longitude };
              destinationSource = 'booking.address (geocoded)';
              console.log(`[START-TRAVEL] Geocoded booking address to destination: ${geocoded.latitude}, ${geocoded.longitude}`);
            }
          }
        }

        if (!destinationLocation && uatMode) {
          destinationLocation = { latitude: 19.0760, longitude: 72.8777 };
          destinationSource = 'UAT mock';
          console.log('[START-TRAVEL] UAT Mode: Using mock destination');
        }

        if (!destinationLocation) {
          return c.json({ error: 'No destination address configured for this booking' }, 400);
        }

        // ✅ CRITICAL: Log destination source and coordinates for debugging
        console.log(`[START-TRAVEL] Final destination for booking ${bookingId}:`, {
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

        // ✅ Build full destination address text from customer_addresses for display
        let destinationAddressText: string | null = booking.address || null;
        let destinationAddressDetails: any = null;
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
              console.log(`[START-TRAVEL] Found address by address_id ${addrId}:`, {
                apartment_name: addrRow.apartment_name,
                flat_no: addrRow.flat_no,
                house_no: addrRow.house_no,
                floor: addrRow.floor,
                street_name: addrRow.street_name,
              });
            } else {
              console.warn(`[START-TRAVEL] No address found with address_id ${addrId}`);
            }
          }
          if (!addrRow && custId) {
            // Try default address first
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
              console.log(`[START-TRAVEL] Found customer default address for customer_id ${custId}:`, {
                address_id: addrRow.id,
                apartment_name: addrRow.apartment_name,
                flat_no: addrRow.flat_no,
                house_no: addrRow.house_no,
                floor: addrRow.floor,
                street_name: addrRow.street_name,
              });
            } else {
              // Fallback: Get any address for this customer
              const allAddrResult = await query(
                `SELECT id, address_line1, address_line2, city, state, pincode, landmark,
                        flat_no, house_no, floor, street_name, apartment_name,
                        latitude, longitude, coordinates, customer_id, is_default
                 FROM customer_addresses 
                 WHERE customer_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [custId]
              );
              if ((allAddrResult as any).rows?.length > 0) {
                addrRow = (allAddrResult as any).rows[0];
                console.log(`[START-TRAVEL] Found any customer address for customer_id ${custId}:`, {
                  address_id: addrRow.id,
                  apartment_name: addrRow.apartment_name,
                  flat_no: addrRow.flat_no,
                  house_no: addrRow.house_no,
                  floor: addrRow.floor,
                  street_name: addrRow.street_name,
                });
              } else {
                console.warn(`[START-TRAVEL] No address found for customer_id ${custId}`);
              }
            }
          }
          
          // ✅ DEBUG: Log what we found
          if (addrRow) {
            console.log(`[START-TRAVEL] Address row data:`, JSON.stringify({
              id: addrRow.id,
              apartment_name: addrRow.apartment_name,
              flat_no: addrRow.flat_no,
              house_no: addrRow.house_no,
              floor: addrRow.floor,
              street_name: addrRow.street_name,
              address_line1: addrRow.address_line1,
              address_line2: addrRow.address_line2,
            }, null, 2));
          } else {
            console.error(`[START-TRAVEL] ❌ No address row found! booking.address_id=${booking.address_id}, booking.customer_id=${booking.customer_id}`);
          }
          
          // ✅ CRITICAL FIX: If address was found but lacks detailed fields, augment from customer's other addresses
          if (addrRow && !addrRow.flat_no && !addrRow.house_no && !addrRow.floor && !addrRow.apartment_name && booking.customer_id) {
            try {
              const detailedAddrResult = await query(
                `SELECT flat_no, house_no, floor, street_name, apartment_name
                 FROM customer_addresses 
                 WHERE customer_id = $1 
                   AND (flat_no IS NOT NULL OR house_no IS NOT NULL OR floor IS NOT NULL OR apartment_name IS NOT NULL)
                 ORDER BY is_default DESC NULLS LAST, created_at DESC 
                 LIMIT 1`,
                [booking.customer_id]
              );
              if ((detailedAddrResult as any).rows?.length > 0) {
                const detAddr = (detailedAddrResult as any).rows[0];
                addrRow.flat_no = detAddr.flat_no || addrRow.flat_no;
                addrRow.house_no = detAddr.house_no || addrRow.house_no;
                addrRow.floor = detAddr.floor || addrRow.floor;
                addrRow.street_name = detAddr.street_name || addrRow.street_name;
                addrRow.apartment_name = detAddr.apartment_name || addrRow.apartment_name;
                console.log(`[START-TRAVEL] Augmented address with detailed fields from customer's other address:`, {
                  flat_no: addrRow.flat_no, house_no: addrRow.house_no, floor: addrRow.floor,
                  street_name: addrRow.street_name, apartment_name: addrRow.apartment_name,
                });
              }
            } catch (augErr) {
              console.warn('[START-TRAVEL] Could not augment address:', augErr);
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
            
            // Also update the booking's address field if it was truncated
            if (destinationAddressText && destinationAddressText !== booking.address) {
              try {
                await update('bookings', { id: bookingId }, { address: destinationAddressText });
                console.log(`[START-TRAVEL] Updated booking address with full detailed address`);
              } catch (updateAddrErr: any) {
                console.warn('[START-TRAVEL] Could not update booking address:', updateAddrErr?.message);
              }
            }
          }
        } catch (addrTextErr: any) {
          console.warn('[START-TRAVEL] Could not build destination address text:', addrTextErr?.message);
        }

        // ✅ CRITICAL FIX: Use booking.vendor_id for tracking session (not resolvedVendorId)
        // The resolvedVendorId is for authorization only. The booking.vendor_id is the source of truth.
        const session = await startTracking(
          bookingId,
          booking.vendor_id, // Use booking's vendor_id, not resolved vendorId
          staffId || null,
          vendorStartLocation,
          destinationLocation
        );

        // Update booking status (best-effort: some envs don't have vendor_departed_at column)
        try {
          await update('bookings', { id: bookingId }, {
            status: 'vendor_on_way',
            vendor_departed_at: new Date().toISOString(),
          });
        } catch (statusErr: any) {
          console.warn('[START-TRAVEL] Booking status update failed (will retry without vendor_departed_at):', statusErr?.message || statusErr);
          try {
            await update('bookings', { id: bookingId }, {
              status: 'vendor_on_way',
            });
          } catch (fallbackErr: any) {
            console.warn('[START-TRAVEL] Booking status fallback update failed:', fallbackErr?.message || fallbackErr);
          }
        }

        // Send notification to customer
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
              vendorId: resolvedVendorId,
              action: 'track_live',
            },
          });
        } catch (notifError) {
          console.warn('[START-TRAVEL] Failed to send notification:', notifError);
        }

        console.log(`✅ [START-TRAVEL] GPS tracking started, session: ${session.id}`);

        return c.json({
          success: true,
          session,
          message: 'Travel started! Customer has been notified.',
          trackingEnabled: true,
          destinationAddress: destinationAddressText,
          destinationAddressDetails,
        });

      } catch (trackingError: any) {
        console.error('[START-TRAVEL] GPS tracking error:', trackingError);
        
        // Even if GPS tracking fails, still update status for UAT mode
        const { isUATMode } = await import('../lib/utils/uat-mode');
        const uatMode = isUATMode({ 
          isUAT: false, 
          headers: Object.fromEntries(c.req.raw.headers.entries()) 
        });

        if (uatMode) {
          // Update status anyway in UAT mode
          await update('bookings', { id: bookingId }, {
            status: 'vendor_on_way',
            vendor_departed_at: new Date().toISOString(),
          });

          return c.json({
            success: true,
            message: 'Travel started (UAT mode - tracking simulated).',
            trackingEnabled: false,
            uatMode: true,
          });
        }

        throw trackingError;
      }

    } catch (error: any) {
      console.error('Error starting travel:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/mark-arrived
   * Mark vendor as arrived at customer location
   */
  app.post("/vendor/bookings/:bookingId/mark-arrived", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, arrivedAt, location } = await c.req.json();

      console.log(`📍 [MARK-ARRIVED] Vendor ${vendorId} arrived for booking ${bookingId}`);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }

      // Update booking status
      await update('bookings', { id: bookingId }, {
        status: 'arrived',
        vendor_arrived_at: arrivedAt || new Date().toISOString(),
      });

      // Update GPS tracking session if exists
      try {
        const existingSessions = await select('gps_tracking_sessions', {
          booking_id: bookingId,
          status: 'in_transit',
        });

        if (existingSessions.length > 0) {
          await update('gps_tracking_sessions', 
            { id: existingSessions[0].id },
            { 
              status: 'arrived', 
              arrived_at: new Date().toISOString(),
              current_latitude: location?.latitude || null,
              current_longitude: location?.longitude || null,
            }
          );
        }
      } catch (e) {
        console.warn('[MARK-ARRIVED] Could not update tracking session:', e);
      }

      // Send notification to customer
      try {
        const { publishNotification } = await import('../utils/sns-client');
        await publishNotification({
          userId: booking.customer_id,
          userType: 'customer',
          type: 'vendor_arrived',
          title: 'Your service provider has arrived! 🎉',
          message: `Please meet them at the door.`,
          data: {
            bookingId,
            vendorId,
            action: 'meet_vendor',
          },
        });
      } catch (notifError) {
        console.warn('[MARK-ARRIVED] Failed to send notification:', notifError);
      }

      console.log(`✅ [MARK-ARRIVED] Arrival marked successfully`);

      return c.json({
        success: true,
        message: 'Arrival marked! Customer has been notified.',
      });

    } catch (error: any) {
      console.error('Error marking arrival:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/location-update
   * Update vendor's current location during travel
   * ✅ FIX: Now uses updateLocation service to recalculate ETA/distance properly
   */
  app.post("/vendor/bookings/:bookingId/location-update", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { latitude, longitude, accuracy, heading, speed } = await c.req.json();

      console.log(`📍 [LOCATION-UPDATE] Received update for booking ${bookingId}:`, {
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
      });

      if (!latitude || !longitude) {
        return c.json({ error: 'latitude and longitude are required' }, 400);
      }

      // Find active tracking session
      const sessions = await select('gps_tracking_sessions', {
        booking_id: bookingId,
      });

      // Stack A (home-service GPS): keep accepting pings after manual arrival so walk-in-progress
      // still writes to gps_tracking_sessions + gps_location_history for customer live map.
      const activeSession = sessions.find(s =>
        s.status === 'in_transit' ||
        s.status === 'started' ||
        s.status === 'active' ||
        s.status === 'arrived'
      );

      if (!activeSession) {
        console.warn(`📍 [LOCATION-UPDATE] No active session found for booking ${bookingId}`);
        // Create new session if none exists (for backward compatibility)
        return c.json({ success: true, message: 'No active session, location noted' });
      }

      console.log(`📍 [LOCATION-UPDATE] Found active session ${activeSession.id} for booking ${bookingId}`);

      // ✅ CRITICAL FIX: Use updateLocation service to recalculate ETA/distance
      // This ensures accurate ETA/distance calculation using Google Maps API
      const { updateLocation } = await import('../lib/services/gps-tracking-service');
      
      const result = await updateLocation(activeSession.id, {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? parseFloat(accuracy) : undefined,
        heading: heading ? parseFloat(heading) : undefined,
        speed: speed ? parseFloat(speed) : undefined,
        timestamp: new Date().toISOString(),
      });

      console.log(`✅ [LOCATION-UPDATE] Successfully updated location for booking ${bookingId}:`, {
        sessionId: activeSession.id,
        eta: result.eta,
        distanceRemaining: result.distanceRemaining,
      });

      return c.json({
        success: true,
        sessionId: activeSession.id,
        eta: result.eta,
        distanceRemaining: result.distanceRemaining,
      });

    } catch (error: any) {
      console.error(`❌ [LOCATION-UPDATE] Error updating location for booking ${bookingId}:`, error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/bookings/:bookingId/tracking-session
   * Get existing tracking session for a booking
   */
  app.get("/vendor/bookings/:bookingId/tracking-session", async (c) => {
    try {
      const { bookingId } = c.req.param();

      const sessions = await select('gps_tracking_sessions', { booking_id: bookingId });
      
      // Get the most recent active session
      const activeSession = sessions
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .find(s => s.status !== 'completed' && s.status !== 'cancelled');

      if (!activeSession) {
        return c.json({ success: true, session: null });
      }

      // Map to frontend format
      return c.json({
        success: true,
        session: {
          status: activeSession.status === 'in_transit' ? 'traveling' : activeSession.status,
          startedAt: activeSession.started_at,
          arrivedAt: activeSession.arrived_at,
          sessionStartedAt: activeSession.session_started_at,
          completedAt: activeSession.completed_at,
          routePoints: activeSession.route_points || [],
          totalDistance: activeSession.total_distance || 0,
          currentEta: activeSession.estimated_eta_minutes,
          distanceToDestination: activeSession.distance_remaining_km,
        },
      });

    } catch (error: any) {
      console.error('Error getting tracking session:', error);
      return c.json({ success: true, session: null }); // Graceful fallback
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/start-session
   * Start a session (for services like dog walking with live tracking)
   */
  app.post("/vendor/bookings/:bookingId/start-session", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId } = await c.req.json();

      console.log(`🚀 [START-SESSION] Vendor ${vendorId} starting session for booking ${bookingId} with OTP: ${otp}`);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }

      // Check if session already started
      if (booking.status === 'in_progress') {
        return c.json({ error: 'Session already started' }, 400);
      }

      // Verify OTP
      const expectedOTP = String(booking.otp_code || '').trim();
      const providedOTP = String(otp).trim();

      if (expectedOTP !== providedOTP) {
        console.error(`❌ [START-SESSION] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}"`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }

      // Start session — started_at anchors vendor walk timer after refresh (GET /details)
      const nowIso = new Date().toISOString();
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'in_progress',
          otp_verified: true,
          started_at: (booking as any).started_at || nowIso,
        }
      );

      console.log(`✅ [START-SESSION] Session started successfully`);

      try {
        if (await bookingUsesDedicatedEndSessionOtp(bookingId)) {
          await ensureDedicatedEndSessionOtp(bookingId);
        }
      } catch (otpErr: any) {
        console.warn('[START-SESSION] End OTP issuance non-fatal:', otpErr?.message);
      }

      // ✅ AUTO-INITIATE GPS TRACKING for at_home services
      if (booking.service_style === 'at_home' || booking.service_type === 'at_home') {
        try {
          console.log(`🚀 [GPS-AUTO-INIT] Auto-initiating GPS tracking for booking ${bookingId}`);
          
          // Check if tracking session already exists (any status)
          const existingSessions = await select('gps_tracking_sessions', {
            booking_id: bookingId,
          });

          if (existingSessions.length === 0) {
            // Get destination coordinates from booking
            let destinationLat: number | null = null;
            let destinationLng: number | null = null;
            
            // Priority 1: Use booking.latitude/longitude
            if (booking.latitude != null && booking.longitude != null) {
              destinationLat = parseFloat(String(booking.latitude));
              destinationLng = parseFloat(String(booking.longitude));
            } 
            // Priority 2: Use booking.delivery_latitude/longitude
            else if ((booking as any).delivery_latitude != null && (booking as any).delivery_longitude != null) {
              destinationLat = parseFloat(String((booking as any).delivery_latitude));
              destinationLng = parseFloat(String((booking as any).delivery_longitude));
            }
            // Priority 3: Get from address_id if booking doesn't have coordinates
            else if ((booking as any).address_id) {
              try {
                const addresses = await select('customer_addresses', { id: (booking as any).address_id });
                if (addresses.length > 0) {
                  const addr = addresses[0] as any;
                  
                  // Extract coordinates from address
                  if (addr.coordinates) {
                    try {
                      const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
                      destinationLat = coords?.lat ?? coords?.latitude ?? null;
                      destinationLng = coords?.lng ?? coords?.longitude ?? null;
                    } catch {
                      // Ignore parse errors
                    }
                  }
                  
                  // Also check if address has separate latitude/longitude columns
                  if (!destinationLat && addr.latitude) {
                    destinationLat = parseFloat(String(addr.latitude));
                  }
                  if (!destinationLng && addr.longitude) {
                    destinationLng = parseFloat(String(addr.longitude));
                  }
                  
                  if (destinationLat && destinationLng) {
                    console.log(`[GPS-AUTO-INIT] Extracted coordinates from address_id ${(booking as any).address_id}: ${destinationLat}, ${destinationLng}`);
                  }
                }
              } catch (addrErr) {
                console.warn('[GPS-AUTO-INIT] Could not fetch address by address_id:', addrErr);
              }
            }
            
            // Only create session if we have destination coordinates
            if (destinationLat != null && destinationLng != null) {
              // Create tracking session with proper status and columns
              const { insert } = await import('../database/rds-connection');
              const newSessions = await insert('gps_tracking_sessions', {
                booking_id: bookingId,
                vendor_id: vendorId,
                customer_id: booking.customer_id,
                status: 'in_transit', // Use 'in_transit' not 'active'
                destination_latitude: destinationLat,
                destination_longitude: destinationLng,
                is_active: true,
                started_at: new Date(),
                last_update_at: new Date(), // Use 'last_update_at' not 'last_update'
                created_at: new Date(),
              });

              console.log(`✅ [GPS-AUTO-INIT] GPS tracking session created: ${newSessions[0].id}`);

              // Send notification to customer
              try {
                const { publishNotification } = await import('../utils/sns-client');
                await publishNotification({
                  userId: booking.customer_id,
                  userType: 'customer',
                  type: 'booking_tracking_started',
                  title: 'Service Provider is on the way!',
                  message: `Your ${booking.service_name || 'service'} provider has started and GPS tracking is now active.`,
                  data: {
                    bookingId,
                    trackingSessionId: newSessions[0].id,
                  },
                });
              } catch (notifError) {
                console.error('Failed to send tracking notification:', notifError);
                // Non-critical, continue
              }
            } else {
              console.warn(`⚠️ [GPS-AUTO-INIT] Cannot create tracking session: booking ${bookingId} has no destination coordinates`);
            }
          }
        } catch (gpsError) {
          console.error('❌ [GPS-AUTO-INIT] Failed to auto-initiate GPS tracking:', gpsError);
          // Non-critical error, don't fail the session start
        }
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Session started! Customer can now track live location.',
      });
    } catch (error: any) {
      console.error('Error starting session:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/check-in
   * Check in a booking (for services like grooming, boarding)
   */
  app.post("/vendor/bookings/:bookingId/check-in", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, staffId, notes, petCondition } = await c.req.json();

      console.log(`✅ [CHECK-IN] Vendor ${vendorId} checking in booking ${bookingId}`);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }

      // Check if booking is already checked in or completed
      if (booking.status === 'checked_in' || booking.status === 'in_progress' || booking.status === 'completed') {
        return c.json({ error: `Booking is already ${booking.status}` }, 400);
      }

      // Update booking status to checked_in
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'checked_in',
          checked_in_at: new Date().toISOString(),
          checked_in_by: staffId || null,
          notes: notes || booking.notes,
          pet_condition: petCondition || null,
        }
      );

      console.log(`✅ [CHECK-IN] Booking checked in successfully`);

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking checked in successfully!',
      });
    } catch (error: any) {
      console.error('Error checking in booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/end-session
   * End a session
   */
  app.post("/vendor/bookings/:bookingId/end-session", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, notes } = await c.req.json();

      console.log(`🏁 [END-SESSION] Vendor ${vendorId} ending session for booking ${bookingId}`);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Verify vendor owns this booking
      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }

      // Check if session is in progress
      if (booking.status !== 'in_progress') {
        return c.json({ error: `Session cannot be ended. Current status: ${booking.status}` }, 400);
      }

      // End session and mark as completed
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'completed',
          completed_at: new Date().toISOString(),
          notes: notes || booking.notes,
        }
      );

      console.log(`✅ [END-SESSION] Session ended successfully`);

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Session ended successfully!',
      });
    } catch (error: any) {
      console.error('Error ending session:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/otp/verify
   * Verify OTP for booking actions
   */
  app.post("/vendor/bookings/:bookingId/otp/verify", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, action } = await c.req.json();

      console.log(`🔐 [OTP-VERIFY] Verifying OTP for booking ${bookingId}, action: ${action}`);

      if (!otp) {
        return c.json({ error: 'OTP is required' }, 400);
      }

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // ✅ FIX: Get correct OTP based on action and service type (walker vs non-walker)
      const otpAction = (action === 'end' ? 'complete' : action) as 'start' | 'complete';
      const { expectedOTP, isWalkerService } = await getExpectedOTPForBooking(booking, bookingId, otpAction);
      const providedOtp = String(otp).trim();
      
      // Only validate if we have an expected OTP
      if (!expectedOTP) {
        console.error(`❌ [OTP-VERIFY] No OTP found for booking ${bookingId}`);
        return c.json({ error: 'No OTP found for this booking. Please contact support.', verified: false }, 400);
      }
      
      if (expectedOTP !== providedOtp) {
        console.error(`❌ [OTP-VERIFY] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOtp}" (Walker: ${isWalkerService}, Action: ${action})`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.', verified: false }, 400);
      }

      // ✅ Mark end OTP as used if it's a walker service completing
      if (isWalkerService && (action === 'complete' || action === 'end')) {
        try {
          await update('otp_tokens',
            { 
              'metadata->>bookingId': bookingId,
              'metadata->>action': 'end',
              is_used: false
            },
            { is_used: true }
          );
          console.log(`✅ [OTP-VERIFY] Marked end OTP as used for walker service`);
        } catch (error: any) {
          console.warn(`⚠️ [OTP-VERIFY] Failed to mark end OTP as used:`, error);
          // Non-critical, continue
        }
      }

      // Update booking based on action
      let newStatus = booking.status;
      if (action === 'complete' || action === 'end') {
        newStatus = 'completed';
        await update('bookings', { id: bookingId }, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });

        // Mirror the COMPLETE-BOOKING handler: close any active GPS tracking
        // session so the customer-side "Vendor on the way" card disappears.
        try {
          await query(
            `UPDATE gps_tracking_sessions
               SET status = 'completed',
                   ended_at = NOW(),
                   last_update_at = NOW()
             WHERE booking_id = $1
               AND status IN ('started', 'in_transit', 'arrived')`,
            [bookingId]
          );
        } catch (gpsErr: any) {
          console.warn(`[OTP-VERIFY] GPS session close (non-fatal):`, gpsErr?.message);
        }
      } else if (action === 'start') {
        newStatus = 'in_progress';
        await update('bookings', { id: bookingId }, {
          status: 'in_progress',
          started_at: new Date().toISOString()
        });
      }

      return c.json({
        success: true,
        verified: true,
        message: 'OTP verified successfully',
        newStatus,
        vendorEarnings: booking.vendor_earnings || booking.total_amount * 0.85
      });
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/status
   * Update booking status (alias for PUT)
   */
  app.post("/vendor/bookings/:bookingId/status", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { status, note } = await c.req.json();

      console.log(`📝 [STATUS-UPDATE] Updating booking ${bookingId} to ${status}`);

      if (!status) {
        return c.json({ error: 'Status is required' }, 400);
      }

      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'arrived'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
      }

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const updateData: any = { status };
      if (note) updateData.notes = note;
      if (status === 'completed') updateData.completed_at = new Date().toISOString();
      if (status === 'confirmed') updateData.confirmed_at = new Date().toISOString();

      const updated = await update('bookings', { id: bookingId }, updateData);

      return c.json({
        success: true,
        booking: updated[0],
        message: `Booking status updated to ${status}`
      });
    } catch (error: any) {
      console.error('Error updating booking status:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/accept
   * Accept a booking
   */
  app.post("/vendor/bookings/:bookingId/accept", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId } = await c.req.json();

      console.log(`✅ [ACCEPT] Accepting booking ${bookingId} for vendor ${vendorId}`);

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      if (booking.status !== 'pending') {
        return c.json({ error: `Cannot accept booking with status: ${booking.status}` }, 400);
      }

      const updated = await update('bookings', { id: bookingId }, {
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      });

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking accepted successfully'
      });
    } catch (error: any) {
      console.error('Error accepting booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/reject
   * Reject a booking
   */
  app.post("/vendor/bookings/:bookingId/reject", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, reason } = await c.req.json();

      console.log(`❌ [REJECT] Rejecting booking ${bookingId} for vendor ${vendorId}`);

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      if (booking.status !== 'pending') {
        return c.json({ error: `Cannot reject booking with status: ${booking.status}` }, 400);
      }

      const updated = await update('bookings', { id: bookingId }, {
        status: 'cancelled',
        cancellation_reason: reason || 'Rejected by vendor',
        cancelled_at: new Date().toISOString()
      });

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking rejected successfully'
      });
    } catch (error: any) {
      console.error('Error rejecting booking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/bookings/:bookingId/verify-otp
   * Alias for OTP verification
   */
  app.post("/vendor/bookings/:bookingId/verify-otp", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, action } = await c.req.json();

      console.log(`🔐 [VERIFY-OTP] Verifying OTP for booking ${bookingId}`);

      if (!otp) {
        return c.json({ error: 'OTP is required', verified: false }, 400);
      }

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found', verified: false }, 404);
      }

      const booking = bookings[0];

      // ✅ FIX: Get correct OTP based on action and service type (walker vs non-walker)
      // Default to 'complete' if action not specified
      const otpAction = (action === 'end' ? 'complete' : (action || 'complete')) as 'start' | 'complete';
      const { expectedOTP, isWalkerService } = await getExpectedOTPForBooking(booking, bookingId, otpAction);
      const providedOtp = String(otp).trim();
      
      if (!expectedOTP) {
        console.error(`❌ [VERIFY-OTP] No OTP found for booking ${bookingId}`);
        return c.json({ error: 'No OTP found for this booking', verified: false }, 400);
      }
      
      if (expectedOTP !== providedOtp) {
        console.error(`❌ [VERIFY-OTP] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOtp}" (Walker: ${isWalkerService}, Action: ${action || 'complete'})`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.', verified: false }, 400);
      }

      // ✅ Mark end OTP as used if it's a walker service completing
      if (isWalkerService && (action === 'complete' || action === 'end' || !action)) {
        try {
          await update('otp_tokens',
            { 
              'metadata->>bookingId': bookingId,
              'metadata->>action': 'end',
              is_used: false
            },
            { is_used: true }
          );
          console.log(`✅ [VERIFY-OTP] Marked end OTP as used for walker service`);
        } catch (error: any) {
          console.warn(`⚠️ [VERIFY-OTP] Failed to mark end OTP as used:`, error);
          // Non-critical, continue
        }
      }

      return c.json({
        success: true,
        verified: true,
        message: 'OTP verified successfully',
        vendorEarnings: booking.vendor_earnings || booking.total_amount * 0.85
      });
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      return c.json({ error: error.message, verified: false }, 500);
    }
  });

  /**
   * GET /vendor/bookings
   * Get all bookings (without vendorId in URL, gets vendorId from query or auth)
   */
  app.get("/vendor/bookings", async (c) => {
    try {
      const status = c.req.query("status") || 'all';
      const vendorId = c.req.query("vendorId");

      console.log(`📋 [BOOKINGS] Getting bookings, status: ${status}, vendorId: ${vendorId}`);

      let bookingsQuery = `
        SELECT b.*, 
               c.full_name as customer_name, c.phone as customer_phone,
               p.name as pet_name, p.species as pet_type
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN pets p ON b.pet_id = p.id
      `;

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (vendorId) {
        conditions.push(`b.vendor_id = $${paramIndex++}`);
        params.push(vendorId);
      }

      if (status && status !== 'all') {
        conditions.push(`b.status = $${paramIndex++}`);
        params.push(status);
      }

      if (conditions.length > 0) {
        bookingsQuery += ` WHERE ${conditions.join(' AND ')}`;
      }

      bookingsQuery += ` ORDER BY b.booking_date DESC, b.booking_time DESC LIMIT 100`;

      const result = await query(bookingsQuery, params);

      return c.json({
        success: true,
        bookings: result.rows || []
      });
    } catch (error: any) {
      console.error('Error getting bookings:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
