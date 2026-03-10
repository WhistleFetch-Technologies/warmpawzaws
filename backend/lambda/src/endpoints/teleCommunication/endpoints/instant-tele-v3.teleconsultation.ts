/**
 * ============================================================================
 * INSTANT TELE V3 - Vendor-Accept-First Flow
 * ============================================================================
 *
 * Customer picks a vendor -> booking created (pending) -> vendor gets notification
 * -> vendor accepts/rejects -> on accept, customer pays -> call starts.
 *
 * Endpoints:
 *   POST /customer/tele/instant-request          – customer picks vendor, creates booking
 *   GET  /customer/tele/instant-stream/:bookingId – SSE stream for customer status
 *   POST /vendor/tele/instant-accept/:bookingId   – vendor accepts incoming call
 *   POST /vendor/tele/instant-reject/:bookingId   – vendor rejects incoming call
 *   GET  /vendor/tele/instant-stream/:bookingId   – SSE stream for vendor (payment tracking)
 *
 * After payment, both sides use existing /video-call/join endpoint.
 *
 * Date: 2026-03-03
 * ============================================================================
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { query, insert, update, select } from '../../../database/rds-connection';
import { validateBody } from 'src/middleware/validation-middleware';
import { instantTeleRequestSchema } from 'src/zodContracts/teleCommunication.contract';
import type { z } from 'zod';
import { BookingStatus, BookingPaymentStatus, PaymentTransactionStatus, InstantTeleEventType, UserType } from 'src/endpoints/constants';
import { processInstantTeleRejectionRefund } from 'src/utils/payments/refund-service';

// Timeout for vendor to respond (seconds)
const VENDOR_RESPONSE_TIMEOUT_SECONDS = 60 * 60;

/**
 * Helper function to determine allowed CORS origin for SSE requests
 * Matches the logic from handler/index.ts to ensure consistency
 */
const getAllowedCorsOrigin = (origin: string | null | undefined): string => {
  // Get allowed origins from environment variable
  const allowedOriginsEnv = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

  // Default origins for local development
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
  ];

  const allowedOrigins = allowedOriginsEnv.length > 0 ? allowedOriginsEnv : defaultOrigins;
  const defaultOrigin = allowedOrigins[0] || '*';

  if (!origin) {
    return defaultOrigin;
  }

  // Normalize for comparison
  const normalizedOrigin = origin.toLowerCase();
  const normalizedAllowed = allowedOrigins.map(o => o.toLowerCase());

  // Check exact match
  if (normalizedAllowed.includes(normalizedOrigin)) {
    return origin;
  }

  // Allow any CloudFront origin (for flexibility in dev/prod)
  if (normalizedOrigin.includes('cloudfront.net')) {
    return origin;
  }

  // Allow localhost for development
  if (normalizedOrigin.includes('localhost')) {
    return origin;
  }

  return defaultOrigin;
};

export function registerInstantTeleV3Endpoints(app: Hono) {

  // ============================================
  // CUSTOMER: INSTANT REQUEST
  // ============================================

  /**
   * POST /customer/tele/instant-request
   * Customer picks a vendor. Creates booking with status='pending', payment_status='pending'.
   * Sends notification to vendor. Returns bookingId for SSE tracking.
   *
   * Body: { customerId, vendorId, petId, serviceId, serviceName, amount }
   */
  app.post('/customer/tele/instant-request', validateBody(instantTeleRequestSchema), async (c) => {
    try {
      const body = (c as any).get('validatedBody') as z.infer<typeof instantTeleRequestSchema>;

      const { customerId, vendorId, petId, serviceId, serviceName, amount } = body;


      // Verify vendor is available for instant tele
      const vendorResult = await query(
        `SELECT id, business_name, owner_name, available_for_instant_tele
         FROM vendors WHERE id = $1`,
        [vendorId]
      );
      if (vendorResult.rows.length === 0) {
        return c.json({ success: false, error: 'Vendor not found' }, 404);
      }
      const vendor = vendorResult.rows[0];
      if (!vendor.available_for_instant_tele) {
        return c.json({ success: false, error: 'Vendor is not currently available for instant consultations' }, 400);
      }

      // Resolve service details if serviceId provided
      // bookings.service_id must reference services.id, not vendor_services.id
      // vendor_services.service_id is the FK to services.id
      let resolvedPrice = Number(amount) || 0;
      let resolvedServiceName = serviceName || 'Instant Vet Consultation';
      let resolvedServiceId: string | null = null;

      if (serviceId) {
        try {
          // serviceId could be vendor_services.id (UUID) or vendor_services.service_id (UUID)
          // Try both: first as vendor_services.id, then as vendor_services.service_id
          const svcRes = await query(
            `SELECT service_id, price, service_name, duration_minutes
             FROM vendor_services
             WHERE (id = $1 OR service_id = $1) AND vendor_id = $2 AND is_enabled = true
             LIMIT 1`,
            [serviceId, vendorId]
          );
          if (svcRes.rows.length > 0 && svcRes.rows[0].service_id) {
            resolvedPrice = Number(svcRes.rows[0].price) || resolvedPrice;
            resolvedServiceName = svcRes.rows[0].service_name || resolvedServiceName;
            resolvedServiceId = svcRes.rows[0].service_id;
          }
        } catch (e) {
          console.warn('[instant-v3] Service lookup failed:', e);
        }
      }

      // If no specific service provided, try to find vendor's tele service
      if (!resolvedServiceId) {
        try {
          const svcRes = await query(
            `SELECT service_id, price, service_name
             FROM vendor_services
             WHERE vendor_id = $1 AND service_style = 'tele' AND is_enabled = true
               AND COALESCE(publish_status, 'published') IN ('published', 'auto_published')
               AND service_id IS NOT NULL
             LIMIT 1`,
            [vendorId]
          );
          if (svcRes.rows.length > 0 && svcRes.rows[0].service_id) {
            resolvedServiceId = svcRes.rows[0].service_id;
            resolvedPrice = Number(svcRes.rows[0].price) || resolvedPrice;
            resolvedServiceName = svcRes.rows[0].service_name || resolvedServiceName;
          }
        } catch (e) {
          console.warn('[instant-v3] Fallback service lookup failed:', e);
        }
      }

      //If still no service_id found, we cannot create booking (service_id is NOT NULL in bookings)
      if (!resolvedServiceId) {
        return c.json({
          success: false,
          error: 'No valid service found. Please ensure the vendor has at least one enabled tele service with a valid service catalog entry.'
        }, 400);
      }

      // Create booking with status='pending'
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0];

      const bookingResult = await query(`
        INSERT INTO bookings (
          customer_id, vendor_id, staff_id, service_id, pet_id,
          service_type, booking_date, booking_time,
          base_price, total_amount, status, payment_status, is_instant_tele, notes,
          created_at, updated_at
        ) VALUES (
          $1, $2, NULL, $3, $4,
          'tele', $5, $6,
          $7, $7, $8, $9, true, $10,
          NOW(), NOW()
        )
        RETURNING *
      `, [
        customerId,
        vendorId,
        resolvedServiceId,
        petId,
        today,
        timeStr,
        resolvedPrice,
        BookingStatus.PENDING,
        BookingPaymentStatus.PENDING,
        `[Instant Tele V3] Service: ${resolvedServiceName}`,
      ]);

      const booking = bookingResult.rows[0];
      if (!booking?.id) {
        return c.json({ success: false, error: 'Booking creation failed' }, 500);
      }

      const vendorName = vendor.business_name || vendor.owner_name || 'Provider';
      const customerName = (
        await query(
          `SELECT COALESCE(full_name, 'Customer') AS name FROM customers WHERE id = $1`,
          [customerId]
        ).then((r: any) => r.rows?.[0]?.name)
      ) || 'Customer';

      // Get pet name for notification
      let petName = 'Pet';
      try {
        const petRes = await query(`SELECT name FROM pets WHERE id = $1`, [petId]);
        if (petRes.rows.length > 0) petName = petRes.rows[0].name || 'Pet';
      } catch (_) { /* ignore */ }

      // Send notification to vendor (incoming call)
      //Pass data/channels as plain objects — the insert() function handles JSON.stringify + ::jsonb cast
      try {
        const notifResult = await insert('notifications', {
          recipient_id: vendorId,
          recipient_type: 'vendor',
          notification_type: 'tele_instant_incoming',
          title: 'Incoming Instant Call',
          message: `${customerName} wants an instant consultation for ${petName}. Accept or decline.`,
          data: {
            booking_id: booking.id,
            customer_id: customerId,
            customer_name: customerName,
            pet_name: petName,
            service_name: resolvedServiceName,
            amount: resolvedPrice,
            call_type: 'incoming_instant',
            action: 'accept_reject',
            instant: true,
          },
          channels: { email: false, sms: false, inApp: true, push: true },
          is_read: false,
        });
        console.log('[instant-v3] ✅ Vendor notification inserted for booking:', booking.id, 'notif ID:', notifResult?.[0]?.id);
      } catch (e: any) {
        console.error('[instant-v3] ❌ Vendor notification insert FAILED:', e?.message || e);
      }

      return c.json({
        success: true,
        bookingId: booking.id,
        vendorName,
        amount: resolvedPrice,
        serviceName: resolvedServiceName,
        message: 'Request sent. Waiting for vendor to accept.',
      });
    } catch (error: any) {
      console.error('[instant-v3] instant-request error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================
  // VENDOR: ACCEPT INCOMING CALL
  // ============================================

  /**
   * POST /vendor/tele/instant-accept/:bookingId
   * Vendor accepts the incoming instant call.
   * Updates booking to pending_payment, creates video_call_sessions row,
   * sets available_for_instant_tele = false.
   */
  app.post('/vendor/tele/instant-accept/:bookingId', async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      if (!bookingId) {
        return c.json({ success: false, error: 'Booking ID is required' }, 400);
      }

      // Fetch booking
      const bookingResult = await query(
        `SELECT * FROM bookings WHERE id = $1`,
        [bookingId]
      );
      if (bookingResult.rows.length === 0) {
        return c.json({ success: false, error: 'Booking not found' }, 404);
      }
      const booking = bookingResult.rows[0];

      // Only allow accepting pending bookings & is_instant_tele is true
      if (booking.status !== BookingStatus.PENDING) {
        return c.json({
          success: false,
          error: `Booking is in "${booking.status}" status, expected "pending"`,
        }, 400);
      } else if (!booking.is_instant_tele) {
        return c.json({
          success: false,
          error: 'Booking is not an instant tele consultation',
        }, 400);
      }

      const vendorId = booking.vendor_id;

      // Update booking to pending_payment
      // update(table, filters, data) — filters first, then data
      await update('bookings', { id: bookingId }, {
        status: BookingStatus.CONFIRMED,
        payment_status: BookingPaymentStatus.PENDING,
        updated_at: new Date(),
        notes: booking.notes
          ? `${booking.notes}\n[Vendor accepted at ${new Date().toISOString()}]`
          : `[Vendor accepted at ${new Date().toISOString()}]`,
      });

      // Create video_call_sessions row (waiting for payment) only vendor will be able to accept and reate meetign 
      let sessionId: string | null = null;
      try {
        const sessionRes = await insert('video_call_sessions', {
          booking_id: bookingId,
          customer_id: booking.customer_id,
          vendor_id: vendorId,
          staff_id: null,
          status: 'waiting',
          created_at: new Date().toISOString(),
        });
        if (sessionRes && sessionRes.length > 0) {
          sessionId = sessionRes[0].id;
        }
      } catch (e) {
        console.warn('[instant-v3] Video session creation failed:', e);
      }

      // Set vendor unavailable
      // try {
      //   await update('vendors', { id: vendorId }, { available_for_instant_tele: false });
      // } catch (e) {
      //   console.warn('[instant-v3] Failed to set vendor unavailable:', e);
      // }

      // Notify customer that vendor accepted
      const vendorResult = await select('vendors', { id: vendorId });
      const vendorName = vendorResult[0]?.business_name || vendorResult[0]?.owner_name || 'Provider';

      try {
        await insert('notifications', {
          recipient_id: booking.customer_id,
          recipient_type: 'customer',
          notification_type: 'tele_instant_accepted',
          title: 'Vet Accepted!',
          message: `${vendorName} accepted your consultation. Please complete payment to start the call.`,
          data: {
            booking_id: bookingId,
            vendor_id: vendorId,
            vendor_name: vendorName,
            total_amount: booking.total_amount,
            action: 'complete_payment',
            session_id: sessionId,
          },
          channels: { email: false, sms: false, inApp: true, push: true },
          is_read: false,
        });
      } catch (e: any) {
        console.error('[instant-v3] ❌ Customer accept notification failed:', e?.message || e);
      }

      return c.json({
        success: true,
        bookingId,
        sessionId,
        totalAmount: booking.total_amount,
        message: 'Booking accepted. Waiting for customer payment.',
      });
    } catch (error: any) {
      console.error('[instant-v3] instant-accept error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================
  // VENDOR: REJECT INCOMING CALL
  // ============================================

  /**
   * POST /vendor/tele/instant-reject/:bookingId
   * Vendor rejects the incoming instant call.
   * Updates booking to rejected.
   */
  app.post('/vendor/tele/instant-reject/:bookingId', async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      if (!bookingId) {
        return c.json({ success: false, error: 'Booking ID is required' }, 400);
      }

      // Fetch booking
      const bookingResult = await query(
        `SELECT * FROM bookings WHERE id = $1`,
        [bookingId]
      );
      if (bookingResult.rows.length === 0) {
        return c.json({ success: false, error: 'Booking not found' }, 404);
      }
      const booking = bookingResult.rows[0];

      if (!booking.is_instant_tele) {
        return c.json({
          success: false,
          error: 'Booking is not an instant tele consultation',
        }, 400);

      }

      // Update booking to rejected
      // update(table, filters, data) — filters first, then data
      await update('bookings', { id: bookingId }, {
        status: BookingStatus.CANCELLED,
        payment_status: BookingPaymentStatus.PENDING,
        updated_at: new Date(),
        notes: booking.notes
          ? `${booking.notes}\n[Vendor rejected at ${new Date().toISOString()}]`
          : `[Vendor rejected at ${new Date().toISOString()}]`,
      });
      console.log('booking rejected---------------------------------------------->', bookingId);
      // Notify customer
      try {
        const vendorResult = await select('vendors', { id: booking.vendor_id });
        const vendorName = vendorResult[0]?.business_name || vendorResult[0]?.owner_name || 'Provider';

        await insert('notifications', {
          recipient_id: booking.customer_id,
          recipient_type: 'customer',
          notification_type: 'tele_instant_rejected',
          title: 'Consultation Declined',
          message: `${vendorName} is currently unavailable. Please try another vet.`,
          data: {
            booking_id: bookingId,
            vendor_id: booking.vendor_id,
            action: 'try_another',
          },
          channels: { email: false, sms: false, inApp: true, push: true },
          is_read: false,
        });
      } catch (e: any) {
        console.error('[instant-v3] ❌ Customer rejection notification failed:', e?.message || e);
      }

      return c.json({
        success: true,
        bookingId,
        message: 'Call rejected.',
      });
    } catch (error: any) {
      console.error('[instant-v3] instant-reject error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * should i enforce panalty on the vendor for cancelling the booking
   * if yes then how to enforce it
   * if no then how to handle it
   * if yes then how to enforce it
   */
  app.post('/vendor/tele/instant-cancel/:bookingId', async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      if (!bookingId) {
        return c.json({ success: false, error: 'Booking ID is required' }, 400);
      }

      // Fetch booking
      const bookingResult = await query(
        `SELECT * FROM bookings WHERE id = $1 AND is_instant_tele = true`,
        [bookingId]
      );
      if (bookingResult.rows.length === 0) {
        return c.json({ success: false, error: 'Booking not found' }, 404);
      }
      const booking = bookingResult.rows[0];
      if (booking.status !== BookingStatus.CONFIRMED) {
        return c.json({ success: false, error: 'Booking is not accepted' }, 400);
      }

      const vendorId = booking.vendor_id;
      const vendorResult = await query(
        `SELECT business_name, owner_name FROM vendors WHERE id = $1`,
        [vendorId]
      );
      const vendorName = vendorResult.rows[0]?.business_name || vendorResult.rows[0]?.owner_name || 'Provider';

      // Handle different cases based on payment status
      if (booking.payment_status === BookingPaymentStatus.PAID) {
        // Payment was made - initiate refund
        try {
          await processInstantTeleRejectionRefund(
            bookingId,
            booking.customer_id,
            booking.total_amount,
            vendorName
          );
          console.log(`[instant-v3] ✅ Refund processed for cancelled booking: ${bookingId}`);
        } catch (error: any) {
          console.error(`[instant-v3] ❌ Error processing refund for cancelled booking:`, error);
          // Update booking to reflect refund failure
          try {
            const paymentResult = await query(
              `SELECT payment_id FROM bookings WHERE id = $1`,
              [bookingId]
            );
            const paymentId = paymentResult.rows[0]?.payment_id;

            await update('bookings', { id: bookingId }, {
              payment_status: BookingPaymentStatus.REFUND_FAILED,
              status: BookingStatus.CANCELLED, // Keep as CANCELLED, not REJECTED
              updated_at: new Date().toISOString(),
              notes: booking.notes
                ? `${booking.notes}\n[Booking cancelled by vendor. Refund failed: ${error.message || 'Unknown error'}]`
                : `[Booking cancelled by vendor. Refund failed: ${error.message || 'Unknown error'}]`,
            });

            if (paymentId) {
              await query(
                `UPDATE payments 
                 SET payment_status = $1, 
                     updated_at = NOW(),
                     failure_reason = $2
                 WHERE id = $3`,
                [PaymentTransactionStatus.REFUND_FAILED, `Refund failed: ${error.message || 'Unknown error'}`, paymentId]
              );
            }
          } catch (updateError: any) {
            console.error(`[instant-v3] ❌ Error updating booking after refund failure:`, updateError);
          }
        }

        // Update video_call_sessions if exists
        try {
          await query(
            `UPDATE video_call_sessions 
             SET status = 'cancelled', updated_at = NOW()
             WHERE booking_id = $1`,
            [bookingId]
          );
        } catch (e) {
          console.warn('[instant-v3] Failed to update video_call_sessions:', e);
        }

        // Notify customer about cancellation and refund
        try {
          await insert('notifications', {
            recipient_id: booking.customer_id,
            recipient_type: 'customer',
            notification_type: 'tele_instant_cancelled',
            title: 'Consultation Cancelled',
            message: `${vendorName} has cancelled the consultation. Your payment will be refunded.`,
            data: {
              booking_id: bookingId,
              vendor_id: vendorId,
              vendor_name: vendorName,
              action: 'try_another',
              refund_initiated: true,
            },
            channels: { email: false, sms: false, inApp: true, push: true },
            is_read: false,
          });
        } catch (e: any) {
          console.error('[instant-v3] ❌ Customer cancellation notification failed:', e?.message || e);
        }
      } else {
        // Payment is pending - simpler cancellation
        // Update video_call_sessions if exists
        try {
          await query(
            `UPDATE video_call_sessions 
             SET status = $2, updated_at = NOW()
             WHERE booking_id = $1 AND status = 'waiting'`,
            [bookingId, BookingStatus.CANCELLED]
          );
        } catch (e) {
          console.warn('[instant-v3] Failed to update video_call_sessions:', e);
        }

        // Make vendor available again
        try {
          await update('vendors', { id: vendorId }, {
            available_for_instant_tele: true,
            updated_at: new Date().toISOString(),
          });
        } catch (e: any) {
          console.warn('[instant-v3] Failed to set vendor available:', e);
        }

        // Notify customer
        try {
          await insert('notifications', {
            recipient_id: booking.customer_id,
            recipient_type: 'customer',
            notification_type: 'tele_instant_cancelled',
            title: 'Consultation Cancelled',
            message: `${vendorName} has cancelled the consultation. Please try another vet.`,
            data: {
              booking_id: bookingId,
              vendor_id: vendorId,
              vendor_name: vendorName,
              action: 'try_another',
            },
            channels: { email: false, sms: false, inApp: true, push: true },
            is_read: false,
          });
        } catch (e: any) {
          console.error('[instant-v3] ❌ Customer cancellation notification failed:', e?.message || e);
        }
      }

      // Update booking to cancelled (only if not already updated by refund failure)
      if (booking.payment_status !== BookingPaymentStatus.PAID) {
        await update('bookings', { id: bookingId }, {
          status: BookingStatus.CANCELLED,
          updated_at: new Date().toISOString(),
          notes: booking.notes
            ? `${booking.notes}\n[Booking cancelled by vendor at ${new Date().toISOString()}]`
            : `[Booking cancelled by vendor at ${new Date().toISOString()}]`,
        });
      }

      // Make vendor available again (for both cases)
      try {
        await update('vendors', { id: vendorId }, {
          available_for_instant_tele: true,
          updated_at: new Date().toISOString(),
        });
      } catch (e: any) {
        console.warn('[instant-v3] Failed to set vendor available:', e);
      }

      return c.json({
        success: true,
        bookingId,
        message: 'Booking cancelled successfully.',
        refundInitiated: booking.payment_status === BookingPaymentStatus.PAID,
      });
    } catch (error: any) {
      console.error('[instant-v3] instant-cancel error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * GET /customer/tele/instant-stream/:bookingId
   * SSE stream for customer. Polls booking status.
   * Emits: vendor_accepted, vendor_rejected, payment_confirmed, timeout.
  
   */
  app.get('/customer/tele/instant-stream/:bookingId', async (c) => {
    const bookingId = c.req.param('bookingId');
    if (!bookingId) return c.json({ error: 'Booking ID is required' }, 400);

    // Get origin from request headers
    const origin = c.req.header('origin') || c.req.header('Origin') || '';
    const allowedOrigin = getAllowedCorsOrigin(origin);

    // Set SSE-specific headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    // Set CORS headers for SSE (critical for CloudFront deployments)
    c.header('Access-Control-Allow-Origin', allowedOrigin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Cache-Control');

    return streamSSE(c, async (stream) => {
      let isActive = true;
      let lastStatus = '';
      let startTime = Date.now();

      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
      let pollInterval: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        isActive = false;
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      };

      // Send connected event
      try {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'connected', message: 'Instant tele stream connected', timestamp: new Date().toISOString() }),
          event: 'connection',
        });
      } catch {
        cleanup();
        return;
      }

      // Helper function to poll and emit status changes
      const pollBookingStatus = async () => {
        if (!isActive) return;

        try {
          //check if booking  exists
          const result = await query(
            `SELECT b.*, v.business_name, v.owner_name
             FROM bookings b
             LEFT JOIN vendors v ON b.vendor_id = v.id
             WHERE b.id = $1 AND b.is_instant_tele = true`,
            [bookingId]
          );
          if (result.rows.length === 0) {
            await stream.writeSSE({
              data: JSON.stringify({ type: 'error', message: 'Booking not found' }),
              event: 'error',
            });
            cleanup();
            return;
          }

          const booking = result.rows[0];
          const currentStatus = `${booking.status}: ${booking.payment_status}`;
          const vendorName = booking.business_name || booking.owner_name || 'Provider';

          // Check timeout (only for pending bookings) if th evendor deos not accept the booking within the timeout period mark it as expiered
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          if (booking.status === BookingStatus.PENDING && elapsedSeconds > VENDOR_RESPONSE_TIMEOUT_SECONDS) {
            try {
              await update('bookings', { id: bookingId }, {
                status: BookingStatus.EXPIRED,
                updated_at: new Date(),
                payment_status: BookingPaymentStatus.PENDING,
                notes: booking.notes
                  ? `${booking.notes}\n[Auto - expired: vendor did not respond within ${VENDOR_RESPONSE_TIMEOUT_SECONDS}s]`
                  : `[Auto - expired: vendor did not respond within ${VENDOR_RESPONSE_TIMEOUT_SECONDS}s]`,
              });
            } catch (e) {
              console.warn('[instant-v3] Auto-expire failed:', e);
            }

            await stream.writeSSE({
              data: JSON.stringify({
                type: 'timeout',
                message: 'Vendor did not respond in time. Please try another vet.',
                bookingId,
                timestamp: new Date().toISOString(),
              }),
              event: 'timeout',
            });
            cleanup();
            return;
          }

          // Keep checking the status of the booking and emit the status changes to the customer
          if (currentStatus !== lastStatus) {

            // Vendor accepted and payment is pending
            if (booking.status === BookingStatus.CONFIRMED && booking.payment_status === BookingPaymentStatus.PENDING && booking.is_instant_tele) {
              await stream.writeSSE({
                data: JSON.stringify({
                  type: InstantTeleEventType.VENDOR_ACCEPTED,
                  bookingId,
                  vendorName,
                  totalAmount: booking.total_amount,
                  message: `${vendorName} accepted! Complete payment to start the call.`,
                  timestamp: new Date().toISOString(),
                }),
                event: InstantTeleEventType.VENDOR_ACCEPTED,
              });
            }

            //Vendor rejected and payment is paid we need to refund the payment
            //     if (booking.status === BookingStatus.CANCELLED && booking.payment_status === BookingPaymentStatus.PAID && booking.is_instant_tele) {

            //       processInstantTeleRejectionRefund(
            //         bookingId,
            //         booking.customer_id,
            //         booking.total_amount,
            //         vendorName
            //       ).then((result) => {
            //         console.log(`[instant - v3] Refund processed: ${result.refundId}`);
            //       }).catch(async (error: any) => {
            //         console.error(`[instant - v3] ❌ Error processing refund: `, error);
            //         try {
            //           // Get payment_id from booking
            //           const bookingResult = await query(
            //             `SELECT payment_id FROM bookings WHERE id = $1`,
            //             [bookingId]
            //           );

            //           const paymentId = bookingResult.rows[0]?.payment_id;

            //           // Update booking payment status
            //           await update('bookings', { id: bookingId }, {
            //             payment_status: BookingPaymentStatus.REFUND_FAILED,
            //             status: BookingStatus.REJECTED,
            //             updated_at: new Date().toISOString(),
            //             notes: booking.notes
            //               ? `${booking.notes}\n[Refund failed: ${error.message || 'Unknown error'}]`
            //               : `[Refund failed: ${error.message || 'Unknown error'}]`,
            //           });

            //           // Update payments table if payment_id exists
            //           if (paymentId) {
            //             await query(
            //               `UPDATE payments 
            //                SET payment_status = $1,
            // updated_at = NOW(),
            // failure_reason = $2
            //                WHERE id = $3`,
            //               [PaymentTransactionStatus.REFUND_FAILED, `Refund failed: ${error.message || 'Unknown error'}`, paymentId]
            //             );
            //             console.log(`[instant - v3] Updated payments table for payment ${paymentId}`);
            //           } else {
            //             console.warn(`[instant - v3] No payment_id found for booking ${bookingId}`);
            //           }
            //         } catch (updateError: any) {
            //           console.error(`[instant - v3] Error updating booking / payment after refund failure: `, updateError);
            //         }
            //       });

            //       await stream.writeSSE({
            //         data: JSON.stringify({
            //           type: InstantTeleEventType.CANCELLED_BUT_PAID,
            //           bookingId,
            //           vendorName,
            //           totalAmount: booking.total_amount,
            //           message: `${vendorName} rejected the call! but the payment is processed.we will refund the payment.`,
            //           timestamp: new Date().toISOString(),
            //         }),
            //         event: InstantTeleEventType.CANCELLED_BUT_PAID,
            //       });
            //       setTimeout(() => {
            //         cleanup();
            //       }, 3000);

            //     }

            // if (booking.status === BookingStatus.CANCELLED && booking.payment_status === BookingPaymentStatus.PENDING) {
            //   await stream.writeSSE({
            //     data: JSON.stringify({
            //       type: InstantTeleEventType.CANCELLED_BUT_PAID,
            //       bookingId,
            //       vendorName,
            //       totalAmount: booking.total_amount,
            //       message: `${vendorName} accepted! Complete payment to start the call.`,
            //     }),
            //   });
            // }


            // Vendor rejected and payment is pending
            if (booking.status === BookingStatus.CANCELLED && booking.is_instant_tele && booking.payment_status === BookingPaymentStatus.PENDING) {
              await stream.writeSSE({
                data: JSON.stringify({
                  type: InstantTeleEventType.VENDOR_REJECTED,
                  bookingId,
                  customer_id: booking.customer_id,
                  message: `${vendorName} is currently unavailable.Please try another vet.`,
                  timestamp: new Date().toISOString(),
                }),
                event: InstantTeleEventType.VENDOR_REJECTED,
              });
              setTimeout(() => cleanup(), 3000);
            }


            // Payment confirmed and payment is paid
            if (booking.status === BookingStatus.CONFIRMED && booking.payment_status === BookingPaymentStatus.PAID) {

              let meetingId: string | null = null;
              try {
                const sessionRes = await query(
                  `SELECT meeting_id, id FROM video_call_sessions WHERE booking_id = $1 LIMIT 1`,
                  [bookingId]
                );
                if (sessionRes.rows.length > 0) {
                  meetingId = sessionRes.rows[0].meeting_id || sessionRes.rows[0].id;
                }
              } catch (_) { /* ignore */ }

              await stream.writeSSE({
                data: JSON.stringify({
                  type: InstantTeleEventType.PAYMENT_CONFIRMED,
                  bookingId,
                  meetingId,
                  message: 'Payment confirmed! Joining video call...',
                  timestamp: new Date().toISOString(),
                }),
                event: InstantTeleEventType.PAYMENT_CONFIRMED,
              });
              setTimeout(() => cleanup(), 5000);
            }


          }

          // Expired or cancelled
          if ([BookingStatus.EXPIRED, BookingStatus.CANCELLED].includes(booking.status)) {
            await stream.writeSSE({
              data: JSON.stringify({
                type: InstantTeleEventType.ENDED,
                reason: booking.status,
                message: booking.status === 'expired'
                  ? 'Booking expired. Please try again.'
                  : 'Booking was cancelled.',
                bookingId,
                timestamp: new Date().toISOString(),
              }),
              event: InstantTeleEventType.ENDED,
            });
            cleanup();
          }
        } catch (err: any) {
          console.error('[instant-v3] SSE poll error:', err);
          await stream.writeSSE({
            data: JSON.stringify({ type: 'error', message: err?.message || 'Polling failed' }),
            event: 'error',
          });
        }
      };

      // Run immediate poll on connection (don't wait 2 seconds)
      await pollBookingStatus();

      // Heartbeat every 30s
      heartbeatInterval = setInterval(async () => {
        if (!isActive) return;
        try {
          await stream.writeSSE({
            data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
            event: 'heartbeat',
          });
        } catch { isActive = false; }
      }, 30000);

      pollInterval = setInterval(() => {
        pollBookingStatus();
      }, 2000);

      c.req.raw.signal?.addEventListener('abort', cleanup);
      stream.onAbort?.(() => cleanup());
    });
  });


  /**
   * GET /vendor/tele/instant-stream/:bookingId
   * SSE stream for vendor. After accepting, tracks payment status.
   * Emits: payment_completed when customer pays.
   * if the vendor cancles the booking we need to refund the payment and do we also have to put the penality on the vendor
   */
  app.get('/vendor/tele/instant-stream/:bookingId', async (c) => {
    const bookingId = c.req.param('bookingId');
    if (!bookingId) return c.json({ error: 'Booking ID is required' }, 400);

    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
      let isActive = true;
      let lastStatus = '';

      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
      let pollInterval: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        isActive = false;
        if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
        if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
      };

      // Send connected event
      try {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'connected', message: 'Vendor instant stream connected', timestamp: new Date().toISOString() }),
          event: 'connection',
        });
      } catch {
        cleanup();
        return;
      }

      // Helper function to poll and emit status changes
      const pollBookingStatus = async () => {
        if (!isActive) return;

        try {
          const result = await query(
            `SELECT b.status, b.payment_status, b.customer_id, b.total_amount, b.is_instant_tele
             FROM bookings b WHERE b.id = $1 AND b.is_instant_tele = true`,
            [bookingId]
          );
          if (result.rows.length === 0) {
            await stream.writeSSE({
              data: JSON.stringify({ type: 'error', message: 'Booking not found' }),
              event: 'error',
            });
            cleanup();
            return;
          }

          const booking = result.rows[0];
          const currentStatus = `${booking.status}:${booking.payment_status} `;

          // Emit if status changed OR if this is the first poll and payment is already completed
          if (currentStatus !== lastStatus || (lastStatus === '' && booking.status === BookingStatus.CONFIRMED && booking.payment_status === BookingPaymentStatus.PAID)) {

            // Status update to vendor
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'status_update',
                status: booking.status,
                paymentStatus: booking.payment_status,
                timestamp: new Date().toISOString(),
              }),
              event: 'status_update',
            });

            // Payment completed
            if (booking.status === BookingStatus.CONFIRMED && booking.payment_status === BookingPaymentStatus.PAID && booking.is_instant_tele) {
              let meetingId: string | null = null;
              try {
                const sessionRes = await query(
                  `SELECT meeting_id, id FROM video_call_sessions WHERE booking_id = $1 LIMIT 1`,
                  [bookingId]
                );
                if (sessionRes.rows.length > 0) {
                  meetingId = sessionRes.rows[0].meeting_id || sessionRes.rows[0].id;
                }
              } catch (_) { /* ignore */ }

              await stream.writeSSE({
                data: JSON.stringify({
                  type: 'payment_completed',
                  bookingId,
                  meetingId,
                  message: 'Customer has paid. Joining call...',
                  timestamp: new Date().toISOString(),
                }),
                event: 'payment_completed',
              });
              setTimeout(() => cleanup(), 5000);
            }

            // Booking cancelled or expired
            if ([BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.REJECTED].includes(booking.status)) {
              await stream.writeSSE({
                data: JSON.stringify({
                  type: 'ended',
                  reason: booking.status,
                  message: 'Booking was cancelled or expired.',
                  timestamp: new Date().toISOString(),
                }),
                event: 'ended',
              });
              cleanup();
            }
          }
        } catch (error: any) {
          console.error('[vendor-instant-stream] poll error:', error);
        }
      };

      await pollBookingStatus();

      heartbeatInterval = setInterval(async () => {
        if (!isActive) return;
        try {
          await stream.writeSSE({
            data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
            event: 'heartbeat',
          });
        } catch { isActive = false; }
      }, 30000);

      // Poll every 2s (using the helper function to avoid code duplication)
      pollInterval = setInterval(() => {
        pollBookingStatus();
      }, 2000);

      c.req.raw.signal?.addEventListener('abort', cleanup);
      stream.onAbort?.(() => cleanup());
    });
  });

  /**
   * GET /customer/tele/instant-cancel/:bookingId
   * Customer cancels the instant tele consultation.
   * Updates booking to cancelled.
   */

  app.get('/customer/tele/instant-cancel/:bookingId', async (c) => {

    try {
      const bookingId = c.req.param('bookingId');
      if (!bookingId) return c.json({ error: 'Booking ID is required' }, 400);


      const bookingResult = await query(
        `SELECT * FROM bookings WHERE id = $1 AND is_instant_tele = true`,
        [bookingId]
      );
      if (bookingResult.rows.length === 0) return c.json({ error: 'Booking not found' }, 404);
      const booking = bookingResult.rows[0];
      if (booking.status !== BookingStatus.CONFIRMED) return c.json({ error: 'Booking is not accepted' }, 400);

      await query(
        `UPDATE bookings SET status = $2,cancelled_by=$3, updated_at = NOW() WHERE id = $1`,
        [bookingId, BookingStatus.CANCELLED, UserType.CUSTOMER]
      );
      return c.json({ success: true, message: 'Booking cancelled' });
    } catch (error: any) {
      console.error('[customer-instant-cancel] error:', error);
      return c.json({ error: error.message }, 500);
    }

  });

}
