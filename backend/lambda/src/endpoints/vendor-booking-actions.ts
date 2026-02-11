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
 * Migrated from: supabase/functions/server/vendor-booking-actions.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { geocodeAddress } from '../lib/utils/geocode';

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
        
        // ✅ Create vendor_earnings for tele consultation too
        if (booking.payment_status === 'paid') {
          try {
            const { insert, query } = await import('../database/rds-connection');
            const { getVendorTierCommission } = await import('../endpoints/razorpay');
            const commissionRate = await getVendorTierCommission(booking.vendor_id);
            
            const totalAmount = parseFloat(booking.total_amount || '0');
            const commissionAmount = (totalAmount * commissionRate) / 100;
            const vendorAmount = totalAmount - commissionAmount;
            
            const existingEarnings = await query(
              `SELECT id FROM vendor_earnings WHERE booking_id = $1`,
              [bookingId]
            );
            
            const existingRows = Array.isArray(existingEarnings) 
              ? existingEarnings 
              : (existingEarnings as any).rows || [];
            
            if (existingRows.length === 0) {
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
              
              await query(
                `UPDATE vendors 
                 SET pending_payout = COALESCE(pending_payout, 0) + $1,
                     total_earnings = COALESCE(total_earnings, 0) + $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [vendorAmount, booking.vendor_id]
              );
              
              const { sendToSettlementQueue } = await import('../utils/sqs-client');
              await sendToSettlementQueue({
                bookingId,
                vendorId: booking.vendor_id,
                amount: totalAmount,
                vendorAmount: vendorAmount,
                commission: commissionAmount,
                trigger: 'booking_completed',
                completedAt: new Date().toISOString(),
              });
            }
          } catch (error: any) {
            console.error('❌ [EARNINGS] Failed to create earnings for tele consultation:', error);
          }
        }
        
        return c.json({ success: true, booking: updated[0], message: 'Tele consultation completed successfully!' });
      }

      // Verify OTP for in-person services
      if (!otp) {
        return c.json({ error: 'OTP is required for in-person services' }, 400);
      }

      // Check OTP from booking
      const expectedOTP = String(booking.otp_code || '').trim();
      const providedOTP = String(otp).trim();

      if (expectedOTP !== providedOTP) {
        console.error(`❌ [COMPLETE-BOOKING] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}"`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
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

      // ✅ CRITICAL FIX: Create vendor_earnings record immediately when booking is completed
      if (booking.payment_status === 'paid') {
        try {
          const { insert, query } = await import('../database/rds-connection');
          
          // Get vendor tier commission rate
          const { getVendorTierCommission } = await import('../endpoints/razorpay');
          const commissionRate = await getVendorTierCommission(booking.vendor_id);
          
          const totalAmount = parseFloat(booking.total_amount || '0');
          const commissionAmount = (totalAmount * commissionRate) / 100;
          const vendorAmount = totalAmount - commissionAmount;
          
          // Check if vendor_earnings record already exists for this booking
          const existingEarnings = await query(
            `SELECT id FROM vendor_earnings WHERE booking_id = $1`,
            [bookingId]
          );
          
          const existingRows = Array.isArray(existingEarnings) 
            ? existingEarnings 
            : (existingEarnings as any).rows || [];
          
          if (existingRows.length === 0) {
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
            
            console.log(`✅ [EARNINGS] Created vendor_earnings record for booking ${bookingId}: ₹${vendorAmount} (commission: ₹${commissionAmount})`);
            
            // Update vendor's total earnings and pending payout
            await query(
              `UPDATE vendors 
               SET pending_payout = COALESCE(pending_payout, 0) + $1,
                   total_earnings = COALESCE(total_earnings, 0) + $1,
                   updated_at = NOW()
               WHERE id = $2`,
              [vendorAmount, booking.vendor_id]
            );
          }
          
          // Trigger automatic settlement
          const { sendToSettlementQueue } = await import('../utils/sqs-client');
          await sendToSettlementQueue({
            bookingId,
            vendorId: booking.vendor_id,
            amount: totalAmount,
            vendorAmount: vendorAmount,
            commission: commissionAmount,
            trigger: 'booking_completed',
            completedAt: new Date().toISOString(),
          });
          console.log(`✅ [SETTLEMENT] Settlement queued for booking ${bookingId} after completion`);
        } catch (error: any) {
          console.error('❌ [SETTLEMENT] Failed to create earnings or queue settlement after booking completion:', error);
          // Don't fail booking completion if earnings/settlement creation fails
        }
      } else {
        console.warn(`⚠️ [SETTLEMENT] Booking ${bookingId} completed but payment status is not 'paid' (${booking.payment_status}), settlement will be handled by payment verification or daily cron`);
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

      console.log(`🚗 [START-TRAVEL] Vendor ${vendorId} starting travel for booking ${bookingId}`);

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

        // Get destination: address_id → customer_addresses, then booking coords, then booking address fallback
        let destinationLocation: { latitude: number; longitude: number } | null = null;

        if (booking.address_id) {
          const addresses = await select('customer_addresses', { id: booking.address_id });
          if (addresses.length > 0) {
            const addr = addresses[0] as any;
            const lat = addr.latitude ?? addr.coordinates?.lat ?? (typeof addr.coordinates === 'string' ? (() => { try { const c = JSON.parse(addr.coordinates); return c?.lat; } catch { return null; } })() : null);
            const lng = addr.longitude ?? addr.coordinates?.lng ?? (typeof addr.coordinates === 'string' ? (() => { try { const c = JSON.parse(addr.coordinates); return c?.lng; } catch { return null; } })() : null);
            if (lat != null && lng != null) {
              destinationLocation = { latitude: parseFloat(String(lat)), longitude: parseFloat(String(lng)) };
            } else if ((addr.address || addr.full_address) && !uatMode) {
              const geocoded = await geocodeAddress(addr.address || addr.full_address);
              if (geocoded) {
                destinationLocation = { latitude: geocoded.latitude, longitude: geocoded.longitude };
                console.log('[START-TRAVEL] Geocoded customer_addresses to destination:', geocoded.latitude, geocoded.longitude);
              }
            }
          }
        }

        if (!destinationLocation && (booking.delivery_latitude != null && booking.delivery_longitude != null)) {
          destinationLocation = {
            latitude: parseFloat(String(booking.delivery_latitude)),
            longitude: parseFloat(String(booking.delivery_longitude)),
          };
        }

        if (!destinationLocation && (booking.latitude != null && booking.longitude != null)) {
          destinationLocation = {
            latitude: parseFloat(String(booking.latitude)),
            longitude: parseFloat(String(booking.longitude)),
          };
        }

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

          if (addressText && !destinationLocation && !uatMode) {
            const geocoded = await geocodeAddress(addressText);
            if (geocoded) {
              destinationLocation = { latitude: geocoded.latitude, longitude: geocoded.longitude };
              console.log('[START-TRAVEL] Geocoded booking address to destination:', geocoded.latitude, geocoded.longitude);
            }
          }
        }

        if (!destinationLocation && uatMode) {
          destinationLocation = { latitude: 19.0760, longitude: 72.8777 };
          console.log('[START-TRAVEL] UAT Mode: Using mock destination');
        }

        if (!destinationLocation) {
          return c.json({ error: 'No destination address configured for this booking' }, 400);
        }

        // Start GPS tracking session
        const session = await startTracking(
          bookingId,
          vendorId,
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
              vendorId,
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
   */
  app.post("/vendor/bookings/:bookingId/location-update", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { latitude, longitude, eta, distanceRemaining, status, accuracy } = await c.req.json();

      // Find active tracking session
      const sessions = await select('gps_tracking_sessions', {
        booking_id: bookingId,
      });

      const activeSession = sessions.find(s => 
        s.status === 'in_transit' || s.status === 'started' || s.status === 'active'
      );

      if (!activeSession) {
        // Create new session if none exists (for backward compatibility)
        return c.json({ success: true, message: 'No active session, location noted' });
      }

      // Update session
      await update('gps_tracking_sessions',
        { id: activeSession.id },
        {
          current_latitude: latitude,
          current_longitude: longitude,
          estimated_eta_minutes: eta,
          distance_remaining_km: distanceRemaining,
          last_update_at: new Date().toISOString(),
        }
      );

      return c.json({
        success: true,
        sessionId: activeSession.id,
      });

    } catch (error: any) {
      console.error('Error updating location:', error);
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

      // Start session
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: 'in_progress',
          otp_verified: true,
        }
      );

      console.log(`✅ [START-SESSION] Session started successfully`);

      // ✅ AUTO-INITIATE GPS TRACKING for at_home services
      if (booking.service_style === 'at_home' || booking.service_type === 'at_home') {
        try {
          console.log(`🚀 [GPS-AUTO-INIT] Auto-initiating GPS tracking for booking ${bookingId}`);
          
          // Check if tracking session already exists
          const existingSessions = await select('gps_tracking_sessions', {
            booking_id: bookingId,
            status: 'active',
          });

          if (existingSessions.length === 0) {
            // Create tracking session
            const { insert } = await import('../database/rds-connection');
            const newSessions = await insert('gps_tracking_sessions', {
              booking_id: bookingId,
              vendor_id: vendorId,
              status: 'active',
              started_at: new Date(),
              last_update: new Date(),
              auto_initiated: true, // Mark as auto-initiated
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

      // ✅ FIXED: Strict OTP validation - must match actual OTP stored in booking
      const expectedOtp = String(booking.otp_code || booking.completion_otp || booking.start_otp || '').trim();
      const providedOtp = String(otp).trim();
      
      // Only validate if we have an expected OTP
      if (!expectedOtp) {
        console.error(`❌ [OTP-VERIFY] No OTP found for booking ${bookingId}`);
        return c.json({ error: 'No OTP found for this booking. Please contact support.', verified: false }, 400);
      }
      
      if (expectedOtp !== providedOtp) {
        console.error(`❌ [OTP-VERIFY] Invalid OTP. Expected: "${expectedOtp}", Got: "${providedOtp}"`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.', verified: false }, 400);
      }

      // Update booking based on action
      let newStatus = booking.status;
      if (action === 'complete') {
        newStatus = 'completed';
        await update('bookings', { id: bookingId }, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });
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

      // ✅ FIXED: Strict OTP validation - must match actual OTP stored in booking
      const expectedOtp = String(booking.otp_code || booking.completion_otp || booking.start_otp || '').trim();
      const providedOtp = String(otp).trim();
      
      if (!expectedOtp) {
        console.error(`❌ [VERIFY-OTP] No OTP found for booking ${bookingId}`);
        return c.json({ error: 'No OTP found for this booking', verified: false }, 400);
      }
      
      if (expectedOtp !== providedOtp) {
        console.error(`❌ [VERIFY-OTP] Invalid OTP. Expected: "${expectedOtp}", Got: "${providedOtp}"`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.', verified: false }, 400);
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
