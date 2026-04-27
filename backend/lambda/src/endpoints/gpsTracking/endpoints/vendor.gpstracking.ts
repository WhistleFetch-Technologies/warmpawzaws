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
import { randomUUID } from 'crypto';
import { select, update, query, insert } from '../../../database/rds-connection';
import {
  markPackageSessionInProgressForBooking,
  completePackageSessionForBooking,
  type SqlClient,
} from '../../../utils/package-session-sync';
import { logBookingStatusChange } from '../../../utils/audit-log';
import {
  parseVendorCancellationReason,
  vendorCancellationReasonLabel,
  applyRefundAfterProviderCancellation,
} from '../../../lib/services/provider-booking-cancel-refund';
import {
  bookingUsesDedicatedEndSessionOtp,
  ensureDedicatedEndSessionOtp,
} from '../../../lib/booking-dedicated-end-otp';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { geocodeAddress } from '../../../lib/utils/geocode';
import { resolveVendorId } from '../../../utils/vendor-resolve';
import { publishNotification } from 'src/utils/sns-client';
import { startTracking, completeTracking, updateLocation, getTrackingStatus } from 'src/lib/services/gpsServices/gps-tracking-service';
import { acceptBookingRequestSchema, checkInRequestSchema, completeBookingRequestSchema, endSessionRequestSchema, locationUpdateRequestSchema, markArrivedRequestSchema, otpVerifyRequestSchema, rejectBookingRequestSchema, startSessionRequestSchema, startTravelRequestSchema } from 'src/zodContracts/gpsTracking.contract';
import { validateBody } from 'src/middleware/validation-middleware';
import z from 'zod';
import { BookingStatus, gps_tracking_sessions, ServiceStyle, OtpAction } from 'src/endpoints/constants';
import { resolvePlannedServiceDurationMinutesFromBookingId } from 'src/lib/booking-service-duration';

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
  action: OtpAction = OtpAction.COMPLETE
): Promise<{ expectedOTP: string; isWalkerService: boolean }> {
  let isWalkerService = false;
  let expectedOTP = '';

  // For 'start' action, always use otp_code (start OTP)
  if (action === OtpAction.START) {
    expectedOTP = String(booking.otp_code || '').trim();
    return { expectedOTP, isWalkerService: false };
  }

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

async function bookingAllowsInServiceWalkTracking(booking: any): Promise<boolean> {
  if (!booking || booking.status !== BookingStatus.IN_PROGRESS) return false;
  const sn = String(booking.service_name || '').toLowerCase();
  const st = String(booking.service_type || '').toLowerCase();
  if (st.includes('walk') || sn.includes('walk') || sn.includes('walking')) return true;
  const res = await query(
    `SELECT LOWER(r.name) AS n FROM vendors v JOIN roles r ON r.id = v.role_id WHERE v.id = $1 LIMIT 1`,
    [booking.vendor_id]
  ).catch(() => ({ rows: [] }));
  const n = String((res as any).rows?.[0]?.n || '');
  return ['pet_walker', 'walker', 'dog_walker', 'walker_solo', 'walking'].includes(n);
}

/**
 * Helper function to fetch customer address details by customer_id
 * @param customerId - The customer ID
 * @param addressId - Optional address ID to fetch specific address
 * @returns Address row with all details or null if not found
 */
async function getCustomerAddressDetails(
  customerId: string,
  addressId?: string | null
): Promise<any | null> {
  try {
    let addrRow: any = null;

    // Priority 1: Fetch by address_id if provided
    if (addressId && typeof addressId === 'string') {
      const addrResult = await query(
        `SELECT id, address_line1, address_line2, city, state, pincode, landmark,
                flat_no, house_no, floor, street_name, apartment_name,
                coordinates, customer_id, is_default, address_type, full_name, phone
         FROM customer_addresses 
         WHERE id = $1 AND customer_id = $2`,
        [addressId, customerId]
      );
      if ((addrResult as any).rows?.length > 0) {
        addrRow = (addrResult as any).rows[0];
        return addrRow;
      }
    }

    // Priority 2: Fetch default address for customer
    if (customerId) {
      const defaultAddrResult = await query(
        `SELECT id, address_line1, address_line2, city, state, pincode, landmark,
                flat_no, house_no, floor, street_name, apartment_name,
                coordinates, customer_id, is_default, address_type, full_name, phone
         FROM customer_addresses 
         WHERE customer_id = $1 
         ORDER BY is_default DESC NULLS LAST, created_at DESC 
         LIMIT 1`,
        [customerId]
      );
      if ((defaultAddrResult as any).rows?.length > 0) {
        addrRow = (defaultAddrResult as any).rows[0];
        return addrRow;
      }
    }

    return null;
  } catch (error: any) {
    console.error('[GET-CUSTOMER-ADDRESS] Error fetching address:', error?.message);
    return null;
  }
}

/**
 * Helper function to format address details into readable text
 * @param addrRow - Address row from customer_addresses
 * @returns Formatted address string and details object
 */
function formatAddressDetails(addrRow: any): {
  formattedText: string | null;
  details: any;
} {
  const hasValue = (val: any): boolean => val != null && String(val).trim().length > 0;
  const getValue = (val: any): string | null => hasValue(val) ? String(val).trim() : null;

  const parts: string[] = [];

  // Apartment name
  const apartmentName = getValue(addrRow.apartment_name);
  if (apartmentName) parts.push(apartmentName);

  // Flat and House numbers
  const flatNo = getValue(addrRow.flat_no);
  const houseNo = getValue(addrRow.house_no);
  if (flatNo && houseNo) {
    parts.push(`Flat ${flatNo}, House ${houseNo}`);
  } else if (flatNo) {
    parts.push(`Flat ${flatNo}`);
  } else if (houseNo) {
    parts.push(`House ${houseNo}`);
  }

  // Floor
  const floor = getValue(addrRow.floor);
  if (floor) parts.push(`Floor ${floor}`);

  // Street name - clean up if it contains "Flat No." prefix
  let streetName = getValue(addrRow.street_name);
  if (streetName) {
    if (streetName.match(/^Flat\s+No\.?\s*/i)) {
      streetName = streetName.replace(/^Flat\s+No\.?\s*/i, '').trim();
    }
    if (streetName) parts.push(streetName);
  }

  // Address lines
  const addressLine1 = getValue(addrRow.address_line1);
  if (addressLine1) parts.push(addressLine1);

  const addressLine2 = getValue(addrRow.address_line2);
  if (addressLine2) parts.push(addressLine2);

  // Landmark
  const landmark = getValue(addrRow.landmark);
  if (landmark) parts.push(`Near ${landmark}`);

  // City, State, Pincode
  const city = getValue(addrRow.city);
  if (city) parts.push(city);

  const state = getValue(addrRow.state);
  if (state) parts.push(state);

  const pincode = getValue(addrRow.pincode);
  if (pincode) parts.push(pincode);

  const formattedText = parts.length > 0 ? parts.join(', ') : null;

  const details = {
    id: addrRow.id,
    apartmentName,
    flatNo,
    houseNo,
    floor,
    streetName: getValue(addrRow.street_name), // Original value, not cleaned
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    pincode,
    addressType: addrRow.address_type,
    fullName: addrRow.full_name,
    phone: addrRow.phone,
    isDefault: addrRow.is_default,
    coordinates: addrRow.coordinates,
    formattedAddress: formattedText,
  };

  return { formattedText, details };
}

/**
 * Helper function to build destination address details from customer_addresses
 * @param booking - The booking object
 * @returns Object with destinationAddressText and destinationAddressDetails
 */
async function buildDestinationAddress(booking: any): Promise<{
  destinationAddressText: string | null;
  destinationAddressDetails: any;
}> {
  let destinationAddressText: string | null = booking.address || null;
  let destinationAddressDetails: any = null;

  try {
    const customerId = booking.customer_id;
    const addressId = booking.address_id;

    if (!customerId) {
      console.warn('[BUILD-ADDRESS] No customer_id in booking');
      return { destinationAddressText, destinationAddressDetails };
    }

    // Fetch address details using customer_id
    const addrRow = await getCustomerAddressDetails(customerId, addressId);

    if (addrRow) {
      const { formattedText, details } = formatAddressDetails(addrRow);
      destinationAddressText = formattedText || booking.address || null;
      destinationAddressDetails = details;
    } else {
      console.warn(`[BUILD-ADDRESS] No address found for customer_id: ${customerId}`);
    }
  } catch (error: any) {
    console.error('[BUILD-ADDRESS] Error building destination address:', error?.message);
  }

  return { destinationAddressText, destinationAddressDetails };
}

export function registerVendorBookingActionsEndpoints(app: Hono) {

  /**
   * POST /vendor/bookings/:bookingId/complete
   * Complete a booking with OTP verification
   */
  app.post("/vendor/bookings/:bookingId/complete", validateBody(completeBookingRequestSchema), async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId } = (c as any).get('validatedBody') as z.infer<typeof completeBookingRequestSchema>;

      console.log(`[COMPLETE-BOOKING] Request body------------------------>: ${JSON.stringify(c.req.body)}`);
      console.log(`[COMPLETE-BOOKING] OTP: ${otp}, Vendor ID: ${vendorId}`);
      console.log(`[COMPLETE-BOOKING] Booking ID: ${bookingId}`);
      // Resolve vendorId (may be vendor_identity.id) to canonical vendors.id
      const resolvedVendorId = await resolveVendorId(vendorId);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      //Resolve booking's vendor_id as well (may also be vendor_identity.id)
      const resolvedBookingVendorId = await resolveVendorId(booking.vendor_id);

      //Verify vendor owns this booking - check both resolved vendor IDs
      // Also check by phone number for solo providers (same vendor with different IDs)
      let vendorAuthorized = false;

      // Direct match (after resolution)
      if (resolvedBookingVendorId === resolvedVendorId ||
        booking.vendor_id === resolvedVendorId ||
        resolvedBookingVendorId === vendorId ||
        booking.vendor_id === vendorId) {
        vendorAuthorized = true;
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
              vendorAuthorized = true;
            }
          }
        } catch (authError: any) {
          console.error(`⚠️ [COMPLETE-BOOKING] Error checking vendor authorization:`, authError);
        }
      }

      if (!vendorAuthorized) {
        return c.json({ error: 'Unauthorized: This booking belongs to another vendor' }, 403);
      }

      // Check if booking is already completed
      if (booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.CANCELLED) {
        return c.json({ error: 'Booking is already completed' }, 400);
      }

      // For tele/video consultations, no OTP required - completed via prescription upload or video call end
      const isTeleConsultation = booking.service_type === ServiceStyle.TELE ||
        booking.service_type === gps_tracking_sessions.VIDEO_CONSULTATION ||
        booking.service_style === ServiceStyle.TELE;
      if (isTeleConsultation) {
        const updated = await update('bookings',
          { id: bookingId },
          {
            status: BookingStatus.COMPLETED,
            completed_at: new Date().toISOString(),
          }
        );


        // Create vendor_earnings for tele consultation (regardless of payment status — handles COD/pending)
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
              status: BookingStatus.PENDING,
              realized_at: new Date().toISOString(),
            });

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
      const { expectedOTP, isWalkerService } = await getExpectedOTPForBooking(booking, bookingId, OtpAction.COMPLETE);
      const providedOTP = String(otp).trim();

      if (!expectedOTP) {
        return c.json({ error: 'No OTP found for this booking. Please contact support.' }, 400);
      }

      if (expectedOTP !== providedOTP) {
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }

      //  Mark end OTP as used if it's a walker service
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
        } catch (error: any) {
          console.warn(`⚠️ [COMPLETE-BOOKING] Failed to mark end OTP as used:`, error);
          // Non-critical, continue with completion
        }
      }

      // Mark booking as completed
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: BookingStatus.COMPLETED,
          otp_verified: true,
          completed_at: new Date().toISOString(),
        }
      );
      console.log(`[COMPLETE-BOOKING] Updated booking: ${JSON.stringify(updated)}`);

      // ✅ MANDATORY: Complete GPS tracking session if it exists (for at_home services)
      const activeSessions = await select('gps_tracking_sessions', {
        booking_id: bookingId,
      });

      console.log(`[COMPLETE-BOOKING] Found ${activeSessions.length} GPS session(s) for booking ${bookingId}`);

      // Find active session (not already completed or cancelled)
      const activeSession = activeSessions.find(
        (s: any) => s.status !== 'completed' && s.status !== 'cancelled'
      );

      if (activeSession) {
        console.log(`[COMPLETE-BOOKING] Completing GPS session ${activeSession.id} with status: ${activeSession.status}`);
        console.log(`[COMPLETE-BOOKING] Active session------------------------>: ${JSON.stringify(activeSession)}`);
        // ✅ MANDATORY: Fail if GPS session completion fails
        await completeTracking(activeSession.id);

        // Verify the update succeeded
        const updatedSession = await select('gps_tracking_sessions', { id: activeSession.id });
        if (updatedSession.length > 0 && updatedSession[0].status === 'completed') {
          console.log(`✅ [COMPLETE-BOOKING] GPS tracking session ${activeSession.id} successfully marked as completed`);
        } else {
          throw new Error(`Failed to verify GPS session ${activeSession.id} was marked as completed. Current status: ${updatedSession[0]?.status}`);
        }
      } else {
        console.log(`[COMPLETE-BOOKING] No active GPS tracking session found for booking ${bookingId} (checked ${activeSessions.length} session(s))`);
      }

      //Create vendor_earnings record regardless of payment status (handles COD/pending)
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

          console.log(` [EARNINGS] Created vendor_earnings for booking ${bookingId}: vendor gets ₹${vendorAmount} (commission: ₹${commissionAmount})`);

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

      try {
        const db: SqlClient = { query } as SqlClient;
        await completePackageSessionForBooking(db, bookingId);
      } catch (pssErr: any) {
        console.warn('[COMPLETE-BOOKING] package session sync:', pssErr?.message);
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
  app.post("/vendor/bookings/:bookingId/start-travel", validateBody(startTravelRequestSchema), async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, staffId, startLocation } = (c as any).get('validatedBody') as z.infer<typeof startTravelRequestSchema>;


      // Resolve vendorId (may be vendor_identity.id) to vendors.id
      const resolvedVendorId = await resolveVendorId(vendorId);

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      const bookingVendorId = booking.vendor_id;



      //  Compare using resolved vendorId and handle type mismatches
      const bookingVendorIdStr = String(bookingVendorId || '').trim().toLowerCase();
      const resolvedVendorIdStr = String(resolvedVendorId || '').trim().toLowerCase();

      if (bookingVendorIdStr !== resolvedVendorIdStr && bookingVendorId !== resolvedVendorId) {

        // Check if vendorId matches by looking up vendor details
        try {
          const vendorCheck = await select('vendors', { id: resolvedVendorId });
          const bookingVendorCheck = await select('vendors', { id: bookingVendorId });
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

      // Check if there's an existing active tracking session
      // If yes, return it so the user can continue tracking instead of showing error
      const existingSession = await getTrackingStatus(bookingId);

      if (existingSession && (existingSession.status === 'in_transit' || existingSession.status === 'started')) {
        console.log(`[START-TRAVEL] Found existing active session ${existingSession.id}, returning for continuation`);

        // Build destination address details
        const { destinationAddressText, destinationAddressDetails } = await buildDestinationAddress(booking);
        console.log(`[START-TRAVEL] Destination address text: ${destinationAddressText}`);
        console.log(`[START-TRAVEL] Destination address details: ${JSON.stringify(destinationAddressDetails)}`);
        return c.json({
          success: true,
          session: existingSession,
          message: 'Continuing existing travel session',
          trackingEnabled: true,
          destinationAddress: destinationAddressText,
          destinationAddressDetails,
        });
      }

      // No active session found - proceed with creating a new one
      try {
        const { isUATMode } = await import('../../../lib/utils/uat-mode');

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

        // Get destination: booking coords → address_id row → customer addresses → booking text / geocode
        let destinationLocation: { latitude: number; longitude: number } | null = null;
        let destinationSource = 'unknown';

        const formatCustomerAddressRowForGeocode = (addr: Record<string, any>): string | null => {
          const parts = [
            addr.apartment_name,
            addr.flat_no || addr.house_no
              ? [addr.flat_no ? `Flat ${addr.flat_no}` : null, addr.house_no ? `House ${addr.house_no}` : null].filter(Boolean).join(', ')
              : null,
            addr.street_name,
            addr.address_line1,
            addr.address_line2,
            addr.landmark ? `Near ${addr.landmark}` : null,
            addr.city,
            addr.state,
            addr.pincode,
          ].filter(Boolean);
          return parts.length > 0 ? parts.join(', ') : null;
        };

        // PRIORITY 1: Use booking.latitude/longitude (primary at_home location fields)
        if (booking.latitude != null && booking.longitude != null) {
          destinationLocation = {
            latitude: parseFloat(String(booking.latitude)),
            longitude: parseFloat(String(booking.longitude)),
          };
          destinationSource = 'booking.latitude/longitude';
          console.log(`[START-TRAVEL] Using booking coordinates as destination: ${destinationLocation.latitude}, ${destinationLocation.longitude}`);
        }

        // PRIORITY 2: Use booking.delivery_latitude/longitude (if booking coords not available)
        if (!destinationLocation && (booking.delivery_latitude != null && booking.delivery_longitude != null)) {
          destinationLocation = {
            latitude: parseFloat(String(booking.delivery_latitude)),
            longitude: parseFloat(String(booking.delivery_longitude)),
          };
          destinationSource = 'booking.delivery_latitude/longitude';

        }

        // PRIORITY 2.5: booking.address_id → exact customer_addresses row (align with vendor-booking-actions)
        if (!destinationLocation && (booking as any).address_id) {
          try {
            const addresses = await select('customer_addresses', { id: (booking as any).address_id });
            if (addresses.length > 0) {
              const addr = addresses[0] as any;
              let lat: number | null = null;
              let lng: number | null = null;
              if (addr.latitude != null && addr.longitude != null) {
                lat = parseFloat(String(addr.latitude));
                lng = parseFloat(String(addr.longitude));
              }
              if ((lat == null || lng == null) && addr.coordinates) {
                try {
                  const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
                  lat = coords?.lat ?? coords?.latitude ?? lat;
                  lng = coords?.lng ?? coords?.longitude ?? lng;
                  if (lat != null) lat = parseFloat(String(lat));
                  if (lng != null) lng = parseFloat(String(lng));
                } catch {
                  /* ignore */
                }
              }
              if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0) {
                destinationLocation = { latitude: lat, longitude: lng };
                destinationSource = 'customer_addresses (booking.address_id)';
                console.log(`[START-TRAVEL] Using address_id ${(booking as any).address_id} coords: ${lat}, ${lng}`);
              } else if (!uatMode) {
                const geoText = formatCustomerAddressRowForGeocode(addr);
                if (geoText) {
                  const geocoded = await geocodeAddress(geoText);
                  if (geocoded) {
                    destinationLocation = { latitude: geocoded.latitude, longitude: geocoded.longitude };
                    destinationSource = 'customer_addresses (address_id, geocoded)';
                    console.log(`[START-TRAVEL] Geocoded address_id row to destination: ${geocoded.latitude}, ${geocoded.longitude}`);
                  }
                }
              }
            }
          } catch (addrIdErr: any) {
            console.warn('[START-TRAVEL] address_id lookup failed:', addrIdErr?.message);
          }
        }

        // PRIORITY 3: Use customer_addresses - query by customer_id from booking
        if (!destinationLocation && booking.customer_id) {
          try {
            // Query customer_addresses using booking.customer_id
            // Note: coordinates are stored in JSONB field, not separate latitude/longitude columns
            const custAddresses = await query(
              `SELECT id, latitude, longitude, coordinates, address_line1, address_line2, city, state, pincode,
                      landmark, flat_no, house_no, floor, street_name, apartment_name, is_default
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

              if (addr.latitude != null && addr.longitude != null) {
                lat = parseFloat(String(addr.latitude));
                lng = parseFloat(String(addr.longitude));
              }

              // Extract coordinates from JSONB field (e.g., {"lat": 12.9756425, "lng": 77.6032208})
              if ((lat == null || lng == null) && addr.coordinates) {
                try {
                  const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
                  lat = coords?.lat ?? coords?.latitude ?? null;
                  lng = coords?.lng ?? coords?.longitude ?? null;
                  if (lat != null) lat = parseFloat(String(lat));
                  if (lng != null) lng = parseFloat(String(lng));
                } catch (err) {
                  console.warn('[START-TRAVEL] Failed to parse coordinates JSON:', err);
                }
              }

              if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                destinationLocation = { latitude: lat, longitude: lng };
                destinationSource = `customer_addresses (customer_id lookup, addr ${addr.id})`;
                console.log(`[START-TRAVEL] Using customer address ${addr.id} as destination: ${lat}, ${lng}`);

                // Also update the booking with the coordinates for future lookups
                // Note: bookings table doesn't have address_id column, so we only update coordinates
                try {
                  await update('bookings', { id: bookingId }, {
                    latitude: lat,
                    longitude: lng,
                  });
                  console.log(`[START-TRAVEL] Updated booking ${bookingId} with coordinates from customer address`);
                } catch (updateErr: any) {
                  console.warn(`[START-TRAVEL] Could not update booking with coordinates:`, updateErr?.message);
                }
                break; // Use first valid address with coordinates
              }
            }

            // If no coordinates yet, geocode any saved customer address row (try each until one succeeds)
            if (!destinationLocation && addrRows.length > 0 && !uatMode) {
              for (const addr of addrRows) {
                const addressText = formatCustomerAddressRowForGeocode(addr);
                if (!addressText) continue;
                const geocoded = await geocodeAddress(addressText);
                if (geocoded) {
                  destinationLocation = { latitude: geocoded.latitude, longitude: geocoded.longitude };
                  destinationSource = `customer_addresses (geocoded, addr ${addr.id})`;
                  console.log(`[START-TRAVEL] Geocoded customer_addresses to destination: ${geocoded.latitude}, ${geocoded.longitude}`);
                  break;
                }
              }
            }
          } catch (addrErr: any) {
            console.warn(`[START-TRAVEL] Error looking up customer address by customer_id:`, addrErr?.message);
            // Fall through to PRIORITY 4 below
          }
        }



        // // PRIORITY 3.5: Look up customer's addresses by customer_id (fallback for all bookings)
        // if (!destinationLocation && booking.customer_id) {
        //   try {
        //     const custAddresses = await query(
        //       `SELECT id, latitude, longitude, coordinates, address_line1, city, state, pincode, is_default
        //        FROM customer_addresses 
        //        WHERE customer_id = $1 
        //        ORDER BY is_default DESC NULLS LAST, created_at DESC 
        //        LIMIT 5`,
        //       [booking.customer_id]
        //     );
        //     const addrRows = (custAddresses as any).rows || [];
        //     console.log(`[START-TRAVEL] Found ${addrRows.length} customer addresses for customer ${booking.customer_id}`);

        //     for (const addr of addrRows) {
        //       let lat: number | null = null;
        //       let lng: number | null = null;

        //       // Check direct lat/lng columns
        //       if (addr.latitude != null && addr.longitude != null) {
        //         lat = parseFloat(String(addr.latitude));
        //         lng = parseFloat(String(addr.longitude));
        //       }

        //       // Check coordinates JSONB
        //       if (lat == null && addr.coordinates) {
        //         try {
        //           const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
        //           lat = coords?.lat ?? coords?.latitude ?? null;
        //           lng = coords?.lng ?? coords?.longitude ?? null;
        //           if (lat != null) lat = parseFloat(String(lat));
        //           if (lng != null) lng = parseFloat(String(lng));
        //         } catch { /* ignore */ }
        //       }

        //       if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        //         destinationLocation = { latitude: lat, longitude: lng };
        //         destinationSource = `customer_addresses (customer_id lookup, addr ${addr.id})`;
        //         console.log(`[START-TRAVEL] Using customer address ${addr.id} as destination: ${lat}, ${lng}`);

        //         // Also update the booking with the coordinates and address_id for future lookups
        //         try {
        //           await update('bookings', { id: bookingId }, {
        //             latitude: lat,
        //             longitude: lng,
        //             address_id: addr.id,
        //           });
        //           console.log(`[START-TRAVEL] Updated booking ${bookingId} with coordinates from customer address`);
        //         } catch (updateErr: any) {
        //           console.warn(`[START-TRAVEL] Could not update booking with coordinates:`, updateErr?.message);
        //         }
        //         break;
        //       }
        //     }
        //   } catch (custAddrErr: any) {
        //     console.warn(`[START-TRAVEL] Error looking up customer addresses:`, custAddrErr?.message);
        //   }
        // }

        // PRIORITY 4: Parse booking.address as JSON object or string
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

          // booking.address may be empty while city/state/pincode live on separate columns (RDS bookings)
          if (!addressText && !destinationLocation) {
            const b = booking as Record<string, unknown>;
            const parts = [b.address, b.city, b.state, b.pincode].filter(
              (x) => x != null && String(x).trim() !== ''
            ) as string[];
            if (parts.length > 0) {
              addressText = parts.map((x) => String(x).trim()).join(', ');
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
          destinationLocation = { latitude: 19.076, longitude: 72.8777 };
          destinationSource = 'UAT mock destination';
          console.log('[START-TRAVEL] UAT Mode: Using mock destination (no coords on booking)');
        }

        if (!destinationLocation) {
          return c.json({ error: 'No destination address configured for this booking' }, 400);
        }


        // Build full destination address text from customer_addresses for display
        const { destinationAddressText, destinationAddressDetails } = await buildDestinationAddress(booking);

        // Update booking address if we built a better formatted one
        if (destinationAddressText && destinationAddressText !== booking.address) {
          try {
            await update('bookings', { id: bookingId }, { address: destinationAddressText });
            console.log(`[START-TRAVEL] Updated booking address with full detailed address`);
          } catch (updateAddrErr: any) {
            console.warn('[START-TRAVEL] Could not update booking address:', updateAddrErr?.message);
          }
        }

        // Use booking.vendor_id for tracking session (not resolvedVendorId)
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
        const { isUATMode } = await import('../../../lib/utils/uat-mode');
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
  app.post("/vendor/bookings/:bookingId/mark-arrived", validateBody(markArrivedRequestSchema), async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, arrivedAt, location } = (c as any).get('validatedBody') as z.infer<typeof markArrivedRequestSchema>;


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
              status: gps_tracking_sessions.ARRIVED,
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
   *  Now uses updateLocation service to recalculate ETA/distance properly
   */
  app.post("/vendor/bookings/:bookingId/location-update", validateBody(locationUpdateRequestSchema), async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { latitude, longitude, accuracy, heading, speed } = (c as any).get('validatedBody') as z.infer<typeof locationUpdateRequestSchema>;


      if (!latitude || !longitude) {
        return c.json({ error: 'latitude and longitude are required' }, 400);
      }

      // Find active tracking session (en route), or arrived session while in-service walk continues
      const sessions = await select('gps_tracking_sessions', {
        booking_id: bookingId,
      });

      const bookingsForLoc = await select('bookings', { id: bookingId });
      const bookingForLoc = bookingsForLoc[0];
      const allowArrivedWalk =
        bookingForLoc && (await bookingAllowsInServiceWalkTracking(bookingForLoc));

      let activeSession = sessions.find(
        (s: any) =>
          s.status === gps_tracking_sessions.IN_TRANSIT ||
          s.status === gps_tracking_sessions.STARTED ||
          s.status === gps_tracking_sessions.ACTIVE
      );
      if (!activeSession && allowArrivedWalk) {
        activeSession = sessions.find((s: any) => s.status === gps_tracking_sessions.ARRIVED);
      }

      if (!activeSession) {
        return c.json({ success: true, message: 'No active session, location noted' });
      }


      // Use updateLocation service to recalculate ETA/distance
      // This ensures accurate ETA/distance calculation using Google Maps API

      const result = await updateLocation(activeSession.id, {
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy,
        heading: heading,
        speed: speed,
        timestamp: new Date().toISOString(),
      });


      return c.json({
        success: true,
        sessionId: activeSession.id,
        eta: result.eta,
        distanceRemaining: result.distanceRemaining,
      });

    } catch (error: any) {
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
        .find(s => s.status !== gps_tracking_sessions.COMPLETED && s.status !== gps_tracking_sessions.CANCELLED);
      if (!activeSession) {
        return c.json({ success: true, session: null });
      }

      const plannedWalkDurationMinutes = await resolvePlannedServiceDurationMinutesFromBookingId(bookingId);
      let sessionStartedAt = activeSession.session_started_at as string | undefined;

      /** Legacy rows: session_started_at was never set — derive from history / arrived_at so refresh shows a real countdown. */
      if (!sessionStartedAt && activeSession.id) {
        try {
          const bookingRows = await select('bookings', { id: bookingId });
          const bst = String((bookingRows[0] as any)?.status || '').toLowerCase();
          if (bst === 'in_progress') {
            const arrivedAt = (activeSession as any).arrived_at as string | undefined;
            let derived: string | undefined;
            try {
              const hist = arrivedAt
                ? await query(
                    `SELECT MIN(recorded_at)::text AS t FROM gps_location_history
                     WHERE session_id = $1::uuid AND recorded_at >= $2::timestamptz`,
                    [activeSession.id, arrivedAt]
                  )
                : await query(
                    `SELECT MIN(recorded_at)::text AS t FROM gps_location_history WHERE session_id = $1::uuid`,
                    [activeSession.id]
                  );
              derived = hist.rows?.[0]?.t || undefined;
            } catch {
              /* ignore */
            }
            sessionStartedAt = derived || arrivedAt || sessionStartedAt;
            if (sessionStartedAt) {
              try {
                await update(
                  'gps_tracking_sessions',
                  { id: activeSession.id },
                  { session_started_at: sessionStartedAt }
                );
              } catch (persistErr: any) {
                console.warn('[TRACKING-SESSION] persist session_started_at:', persistErr?.message || persistErr);
              }
            }
          }
        } catch (fillErr: any) {
          console.warn('[TRACKING-SESSION] fill session_started_at:', fillErr?.message || fillErr);
        }
      }

      let elapsedWalkSeconds: number | null = null;
      let remainingWalkSeconds: number | null = null;
      if (sessionStartedAt) {
        const elapsed = Math.floor(
          (Date.now() - new Date(sessionStartedAt).getTime()) / 1000
        );
        elapsedWalkSeconds = Math.max(0, elapsed);
        remainingWalkSeconds = Math.max(0, plannedWalkDurationMinutes * 60 - elapsedWalkSeconds);
      }

      // Map to frontend format
      return c.json({
        success: true,
        session: {
          status: activeSession.status === gps_tracking_sessions.IN_TRANSIT ? gps_tracking_sessions.IS_TRAVELING : activeSession.status,
          startedAt: activeSession.started_at,
          arrivedAt: activeSession.arrived_at,
          sessionStartedAt: sessionStartedAt,
          completedAt: activeSession.completed_at,
          routePoints: activeSession.route_points || [],
          totalDistance: activeSession.total_distance || 0,
          currentEta: activeSession.estimated_eta_minutes,
          distanceToDestination: activeSession.distance_remaining_km,
          plannedWalkDurationMinutes,
          elapsedWalkSeconds,
          remainingWalkSeconds,
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
  app.post("/vendor/bookings/:bookingId/start-session", validateBody(startSessionRequestSchema), async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, vendorId } = (c as any).get('validatedBody') as z.infer<typeof startSessionRequestSchema>;


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

      // Already in progress (e.g. page refresh) — idempotent success, no OTP re-entry
      if (booking.status === BookingStatus.IN_PROGRESS) {
        const nowIso = new Date().toISOString();
        if (!(booking as any).started_at) {
          try {
            await update('bookings', { id: bookingId }, { started_at: nowIso });
          } catch (e: any) {
            console.warn('[START-SESSION] idempotent started_at:', e?.message || e);
          }
        }
        try {
          const gpsRows = await select('gps_tracking_sessions', { booking_id: bookingId });
          const activeGps = gpsRows
            .slice()
            .sort(
              (a: any, b: any) =>
                new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            )
            .find(
              (s: any) =>
                s.status !== gps_tracking_sessions.COMPLETED && s.status !== gps_tracking_sessions.CANCELLED
            );
          if (activeGps?.id && !activeGps.session_started_at) {
            await update(
              'gps_tracking_sessions',
              { id: activeGps.id },
              { session_started_at: new Date().toISOString() }
            );
          }
        } catch (e: any) {
          console.warn('[START-SESSION] idempotent GPS row sync:', e?.message || e);
        }
        try {
          const db: SqlClient = { query } as SqlClient;
          await markPackageSessionInProgressForBooking(db, bookingId);
        } catch (pssErr: any) {
          console.warn('[START-SESSION] package_scheduled_sessions in_progress sync:', pssErr?.message);
        }
        return c.json({
          success: true,
          alreadyStarted: true,
          booking,
          message: 'Session is already in progress.',
        });
      }

      // Verify OTP
      const expectedOTP = String(booking.otp_code || '').trim();
      const providedOTP = String(otp).trim();

      if (expectedOTP !== providedOTP) {
        console.error(`❌ [START-SESSION] Invalid OTP. Expected: "${expectedOTP}", Got: "${providedOTP}"`);
        return c.json({ error: 'Invalid OTP. Please check with the customer.' }, 400);
      }

      // Start session — persist started_at so GET /details can restore walk countdown after refresh
      const nowIso = new Date().toISOString();
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: BookingStatus.IN_PROGRESS,
          otp_verified: true,
          started_at: (booking as any).started_at || nowIso,
        }
      );

      try {
        if (await bookingUsesDedicatedEndSessionOtp(bookingId)) {
          await ensureDedicatedEndSessionOtp(bookingId);
        }
      } catch (otpErr: any) {
        console.warn('[START-SESSION] End OTP issuance non-fatal:', otpErr?.message);
      }

      // Sync walk start time on existing GPS row (vendor journey already created the session)
      try {
        const gpsAfterStart = await select('gps_tracking_sessions', { booking_id: bookingId });
        const activeAfter = gpsAfterStart
          .slice()
          .sort(
            (a: any, b: any) =>
              new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          )
          .find(
            (s: any) =>
              s.status !== gps_tracking_sessions.COMPLETED && s.status !== gps_tracking_sessions.CANCELLED
          );
        if (activeAfter?.id) {
          await update(
            'gps_tracking_sessions',
            { id: activeAfter.id },
            {
              session_started_at: activeAfter.session_started_at || new Date().toISOString(),
            }
          );
        }
      } catch (e: any) {
        console.warn('[START-SESSION] session_started_at sync:', e?.message || e);
      }

      //  AUTO-INITIATE GPS TRACKING for at_home services
      if (booking.service_style === ServiceStyle.AT_HOME || booking.service_type === ServiceStyle.AT_HOME) {
        try {
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
              const newSessions = await insert('gps_tracking_sessions', {
                booking_id: bookingId,
                vendor_id: vendorId,
                customer_id: booking.customer_id,
                status: gps_tracking_sessions.IN_TRANSIT, // Use 'in_transit' not 'active'
                destination_latitude: destinationLat,
                destination_longitude: destinationLng,
                is_active: true,
                started_at: new Date(),
                last_update_at: new Date(), // Use 'last_update_at' not 'last_update'
                created_at: new Date(),
              });


              // Send notification to customer
              try {
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

      try {
        const db: SqlClient = { query } as SqlClient;
        await markPackageSessionInProgressForBooking(db, bookingId);
      } catch (pssErr: any) {
        console.warn('[START-SESSION] package_scheduled_sessions in_progress sync:', pssErr?.message);
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
  app.post("/vendor/bookings/:bookingId/check-in", validateBody(checkInRequestSchema), async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, staffId, notes, petCondition } = (c as any).get('validatedBody') as z.infer<typeof checkInRequestSchema>;


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
      if (booking.status === BookingStatus.CHECKED_IN || booking.status === BookingStatus.IN_PROGRESS || booking.status === BookingStatus.COMPLETED) {
        return c.json({ error: `Booking is already ${booking.status}` }, 400);
      }

      // Update booking status to checked_in
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: BookingStatus.CHECKED_IN,
          checked_in_at: new Date().toISOString(),
          checked_in_by: staffId || null,
          notes: notes || booking.notes,
          pet_condition: petCondition || null,
        }
      );


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
  app.post("/vendor/bookings/:bookingId/end-session", validateBody(endSessionRequestSchema), async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, notes } = (c as any).get('validatedBody') as z.infer<typeof endSessionRequestSchema>;


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
      if (booking.status !== BookingStatus.IN_PROGRESS) {
        return c.json({ error: `Session cannot be ended. Current status: ${booking.status}` }, 400);
      }

      // End session and mark as completed
      const updated = await update('bookings',
        { id: bookingId },
        {
          status: BookingStatus.COMPLETED,
          completed_at: new Date().toISOString(),
          notes: notes || booking.notes,
        }
      );

      try {
        const db: SqlClient = { query } as SqlClient;
        await completePackageSessionForBooking(db, bookingId);
      } catch (pssErr: any) {
        console.warn('[END-SESSION] package session completion sync:', pssErr?.message);
      }

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
  app.post("/vendor/bookings/:bookingId/otp/verify", validateBody(otpVerifyRequestSchema), async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, action } = (c as any).get('validatedBody') as z.infer<typeof otpVerifyRequestSchema>;

      if (!otp) {
        return c.json({ error: 'OTP is required' }, 400);
      }

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Map request action to OtpAction enum (legacy GPS names + dashboard aliases: start | complete | end)
      let mappedAction: OtpAction = OtpAction.COMPLETE;
      if (action === 'end_session' || action === 'end') {
        mappedAction = OtpAction.END;
      } else if (action === 'start_travel' || action === 'start') {
        mappedAction = OtpAction.START;
      } else {
        mappedAction = OtpAction.COMPLETE;
      }

      // Get correct OTP based on action and service type (walker vs non-walker)
      const otpAction = (mappedAction === OtpAction.END ? OtpAction.COMPLETE : mappedAction) as OtpAction.START | OtpAction.COMPLETE;
      const { expectedOTP, isWalkerService } = await getExpectedOTPForBooking(booking, bookingId, otpAction);
      const providedOtp = String(otp).trim();

      // Only validate if we have an expected OTP
      if (!expectedOTP) {
        return c.json({ error: 'No OTP found for this booking. Please contact support.', verified: false }, 400);
      }

      if (expectedOTP !== providedOtp) {
        return c.json({ error: 'Invalid OTP. Please check with the customer.', verified: false }, 400);
      }

      // Mark end OTP as used if it's a walker service completing
      if (isWalkerService && otpAction === OtpAction.COMPLETE) {
        try {
          await update('otp_tokens',
            {
              'metadata->>bookingId': bookingId,
              'metadata->>action': OtpAction.END,
              is_used: false
            },
            { is_used: true }
          );
          console.log(`[OTP-VERIFY] Marked end OTP as used for walker service`);
        } catch (error: any) {
          console.warn(`[OTP-VERIFY] Failed to mark end OTP as used:`, error);
          // Non-critical, continue
        }
      }

      // Update booking based on action
      let newStatus = booking.status;
      if (mappedAction === OtpAction.COMPLETE || mappedAction === OtpAction.END) {
        newStatus = 'completed';
        await update('bookings', { id: bookingId }, {
          status: 'completed',
          completed_at: new Date().toISOString()
        });
      } else if (mappedAction === OtpAction.START) {
        newStatus = 'in_progress';
        await update('bookings', { id: bookingId }, {
          status: 'in_progress',
          started_at: new Date().toISOString()
        });
      }

      try {
        const db: SqlClient = { query } as SqlClient;
        if (mappedAction === OtpAction.START) {
          await markPackageSessionInProgressForBooking(db, bookingId);
        }
        if (mappedAction === OtpAction.COMPLETE || mappedAction === OtpAction.END) {
          await completePackageSessionForBooking(db, bookingId);
        }
      } catch (pssErr: any) {
        console.warn('[OTP-VERIFY] package session sync:', pssErr?.message);
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
  app.post("/vendor/bookings/:bookingId/accept", validateBody(acceptBookingRequestSchema), async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId } = (c as any).get('validatedBody') as z.infer<typeof acceptBookingRequestSchema>;


      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      if (booking.status !== 'pending') {
        return c.json({ error: `Cannot accept booking with status: ${booking.status}` }, 400);
      }

      const updated = await update('bookings', { id: bookingId }, {
        status: BookingStatus.CONFIRMED,
        confirmed_at: new Date().toISOString(),
        confirmed_by: vendorId,
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
  app.post("/vendor/bookings/:bookingId/reject", validateBody(rejectBookingRequestSchema), async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, reason, vendorCancellationReason: tierRaw } = (c as any).get('validatedBody') as z.infer<
        typeof rejectBookingRequestSchema
      >;

      const vendorCancellationReason = parseVendorCancellationReason(tierRaw) ?? 'operational';

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      const oldStatus = booking.status;
      if (!['pending', 'confirmed'].includes(String(oldStatus))) {
        return c.json({ error: `Cannot reject booking with status: ${booking.status}` }, 400);
      }

      const reasonLabel = vendorCancellationReasonLabel(vendorCancellationReason);
      const extraNote = typeof reason === 'string' && reason.trim() ? reason.trim() : '';
      const cancellation_reason = extraNote
        ? `Provider declined (${reasonLabel}). ${extraNote}`
        : `Provider declined: ${reasonLabel}.`;

      const updated = await update('bookings', { id: bookingId }, {
        status: BookingStatus.CANCELLED,
        cancellation_reason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'provider',
      });

      const refundInfo = await applyRefundAfterProviderCancellation(
        booking,
        vendorCancellationReason,
        cancellation_reason,
        { refundMethod: 'wallet' }
      ).catch((e: any) => {
        console.warn('[vendor/reject] refund apply failed:', e?.message);
        return null;
      });

      await logBookingStatusChange(
        bookingId,
        oldStatus,
        'cancelled',
        vendorId || booking.vendor_id,
        'vendor',
        extraNote ? `Vendor rejected (${reasonLabel}): ${extraNote}` : `Vendor rejected (${reasonLabel})`
      );

      try {
        const { publishBookingStatusUpdated } = await import('src/utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id || vendorId,
          oldStatus,
          newStatus: 'cancelled',
          reason: cancellation_reason,
          eventTimestamp: new Date().toISOString(),
          eventId: randomUUID(),
        });
      } catch (pubErr) {
        console.error('Failed to publish booking status updated event:', pubErr);
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking rejected successfully',
        refund: refundInfo ?? undefined,
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
  app.post("/vendor/bookings/:bookingId/verify-otp", validateBody(otpVerifyRequestSchema), async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, action } = (c as any).get('validatedBody') as z.infer<typeof otpVerifyRequestSchema>;

      console.log(`🔐 [VERIFY-OTP] Verifying OTP for booking ${bookingId}`);

      if (!otp) {
        return c.json({ error: 'OTP is required', verified: false }, 400);
      }

      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found', verified: false }, 404);
      }

      const booking = bookings[0];

      // Map request action (from otpVerifyRequestSchema) to OtpAction enum
      // Request actions include legacy GPS names plus dashboard aliases: start | complete | end
      let mappedAction: OtpAction = OtpAction.COMPLETE;
      if (action === 'end_session' || action === 'end') {
        mappedAction = OtpAction.END;
      } else if (action === 'start_travel' || action === 'start') {
        mappedAction = OtpAction.START;
      } else {
        mappedAction = OtpAction.COMPLETE;
      }

      // Get correct OTP based on action and service type (walker vs non-walker)
      // Default to 'complete' if action not specified
      const otpAction = (mappedAction === OtpAction.END ? OtpAction.COMPLETE : mappedAction) as OtpAction.START | OtpAction.COMPLETE;
      const { expectedOTP, isWalkerService } = await getExpectedOTPForBooking(booking, bookingId, otpAction);
      const providedOtp = String(otp).trim();

      if (!expectedOTP) {
        return c.json({ error: 'No OTP found for this booking', verified: false }, 400);
      }

      if (expectedOTP !== providedOtp) {
        return c.json({ error: 'Invalid OTP. Please check with the customer.', verified: false }, 400);
      }

      //Mark end OTP as used if it's a walker service completing
      if (isWalkerService && (mappedAction === OtpAction.COMPLETE || mappedAction === OtpAction.END || !action)) {
        try {
          await update('otp_tokens',
            {
              'metadata->>bookingId': bookingId,
              'metadata->>action': OtpAction.END,
              is_used: false
            },
            { is_used: true }
          );
          console.log(` [VERIFY-OTP] Marked end OTP as used for walker service`);
        } catch (error: any) {
          console.warn(` [VERIFY-OTP] Failed to mark end OTP as used:`, error);
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
