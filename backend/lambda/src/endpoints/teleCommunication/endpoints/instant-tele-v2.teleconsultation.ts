/**
 * ============================================================================
 * INSTANT TELE V2 - Vendor-only, payment-first, no queue/no staff
 * ============================================================================
 *
 * - GET /customer/tele/available-now: Vendors (vet only) with current time
 *   inside a tele-enabled window in vendor_availability_v2. No buffer. No staff.
 * - POST /customer/tele/instant-after-payment: Verify payment → create booking
 *   → notify both vendor and customer → return bookingId. No call until payment done.
 *
 * Instant video calling is Vet-only. Other roles use scheduled tele only.
 * Date: 2026-02-14
 * ============================================================================
 */

import { Hono } from 'hono';
import { createHmac } from 'crypto';
import { query, insert, update, select } from '../../../database/rds-connection';
import { getRazorpayConfig } from '../../../utils/payments/razorpay-client';
import { VET_ROLE_NAMES } from '../../customer/constants';
import { regeneratePresignedUrl } from 'src/endpoints/constants/helper';
import { BookingStatus } from 'src/endpoints/constants';


export function registerInstantTeleV2Endpoints(app: Hono) {
  /**
   * GET /customer/tele/available-now
   * Vendors (vet only) who are "available right now" for instant tele:
   * - Have at least one row in vendor_availability_v2 for today's day_of_week
   * - With 'tele' in service_styles (or service_style/service_type = 'tele')
   * - Current time is inside time_window_start..time_window_end (no buffer applied)
   * - Vendor has published tele service in vendor_services
   * No staff. No queue.
   *
   * ✅ FIX: Vendor availability windows are stored in IST (Asia/Kolkata).
   * AWS Lambda runs in UTC, so new Date().getHours() returns UTC hours.
   * We must convert to IST before comparing against availability windows.
   */
  app.get('/customer/tele/available-now', async (c) => {
    try {
      // ✅ FIX: Convert UTC to IST (UTC+5:30) for availability comparison
      // Vendor availability windows (09:00-14:00, 16:00-22:00) are stored in IST
      // AWS Lambda's new Date() returns UTC, so we must offset by +5:30
      const now = new Date();
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +5:30 in milliseconds
      const istNow = new Date(now.getTime() + IST_OFFSET_MS);
      const dayOfWeek = istNow.getUTCDay(); // Use UTC methods on the IST-shifted date
      const currentTime = `${String(istNow.getUTCHours()).padStart(2, '0')}:${String(istNow.getUTCMinutes()).padStart(2, '0')}:00`;

      const result = await query(
        `
      SELECT
          v.id AS vendor_id,
          COALESCE(v.business_name, v.owner_name, 'Vet') AS vendor_name,
          photo.profile_photo_url AS photo,
          v.phone,
          v.city,
          v.address
      
      FROM vendors v
      
      INNER JOIN vendor_identity vi 
          ON vi.vendor_id = v.id
      
      INNER JOIN roles r 
          ON r.id = vi.selected_role_id
          AND r.is_active = true
      
      INNER JOIN vendor_availability_v2 va 
          ON va.vendor_id = v.id
      
      LEFT JOIN vendor_onboarding_applications voa
          ON voa.vendor_identity_id = vi.id
      
      LEFT JOIN LATERAL (
          SELECT doc->>'url' AS profile_photo_url
          FROM jsonb_array_elements(voa.uploaded_documents) AS doc
          WHERE doc->>'type' = 'profilePhoto'
          LIMIT 1
      ) photo ON true
      
      WHERE v.is_active = true
        AND (v.status = 'approved' OR v.status IS NULL)
        AND v.available_for_instant_tele = true
        AND LOWER(r.name) = ANY($2::text[])
        AND va.day_of_week = $1
        AND COALESCE(va.is_available, true) = true
        AND COALESCE(va.time_window_start, va.start_time) <= $3::time
        AND COALESCE(va.time_window_end, va.end_time) >= $3::time
        AND va.service_type IN ('tele','online','video_consultation')
      
        AND EXISTS (
              SELECT 1
              FROM vendor_services vs
              WHERE vs.vendor_id = v.id
                AND vs.service_style = 'tele'
                AND vs.is_enabled = true
                AND COALESCE(vs.publish_status, 'published') = 'published'
        )
      
      ORDER BY v.business_name;
      `,
        [
          dayOfWeek,
          VET_ROLE_NAMES.map(r => r.toLowerCase()),
          currentTime
        ]
      ).catch((err) => {
        console.error('[instant-tele-v2] available-now query error:', err);
        return { rows: [] };
      });
      const rows = (result as any).rows || [];
      const vendors = await Promise.all(
        rows.map(async (r: any) => ({
          vendorId: r.vendor_id,
          vendorName: r.vendor_name,
          photo: await regeneratePresignedUrl(r.photo),
          phone: r.phone,
          city: r.city,
          address: r.address,
        }))
      );

      return c.json({ success: true, vendors, total: vendors.length });
    } catch (error: any) {
      console.error('[instant-tele-v2] available-now error:', error);
      return c.json({ success: false, error: error.message, vendors: [] }, 500);
    }
  });

  /**
   * POST /customer/tele/instant-after-payment
   * Called after payment success. Verifies payment then creates booking and notifies both.
   * Body: razorpay_order_id, razorpay_payment_id, razorpay_signature,
   *       vendorId, customerId, petId, serviceId, amount, serviceName?, vendorName?, petName?
   * Returns: { success, bookingId } - no meetingId; join creates meeting on first join.
   */
  app.post('/customer/tele/instant-after-payment', async (c) => {
    try {
      const body = await c.req.json();
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        vendorId,
        customerId,
        petId,
        serviceId,
        amount,
        serviceName,
        vendorName,
        petName,
      } = body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return c.json({ success: false, error: 'Payment verification data required' }, 400);
      }
      if (!vendorId || !customerId || !petId || !serviceId) {
        return c.json({ success: false, error: 'vendorId, customerId, petId, serviceId required' }, 400);
      }

      const config = await getRazorpayConfig();
      if (!config?.keySecret) {
        return c.json({ success: false, error: 'Payment configuration error' }, 500);
      }
      const text = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSig = createHmac('sha256', config.keySecret).update(text).digest('hex');
      if (expectedSig !== razorpay_signature) {
        return c.json({ success: false, error: 'Invalid payment signature' }, 400);
      }

      const payResult = await query(
        `SELECT id, booking_id, payment_status, customer_id, vendor_id FROM payments WHERE razorpay_order_id = $1`,
        [razorpay_order_id]
      );
      const payRows = (payResult as any).rows || [];
      if (payRows.length === 0) {
        return c.json({ success: false, error: 'Payment record not found' }, 404);
      }
      const payment = payRows[0];
      if (payment.payment_status !== 'completed') {
        return c.json({ success: false, error: 'Payment not completed. Complete payment first.' }, 400);
      }
      if (payment.booking_id) {
        return c.json({ success: true, bookingId: payment.booking_id, alreadyCreated: true });
      }

      const today = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toISOString().split('T')[1].substring(0, 5);
      const totalAmount = Number(amount) || 0;


      const bookingInsert = await insert('bookings', {
        customer_id: customerId,
        vendor_id: vendorId,
        staff_id: null,
        pet_id: petId,
        service_id: serviceId,
        service_type: 'tele',
        booking_date: today,
        booking_time: timeStr,
        base_price: totalAmount,
        total_amount: totalAmount,
        status: 'confirmed',
        payment_status: 'paid',
        is_instant_tele: true, // ✅ Mark as instant tele booking
        notes: `[Instant Tele V2] Razorpay Order: ${razorpay_order_id}. Service: ${serviceName || 'Instant Vet Consultation'}`,
      });
      const booking = Array.isArray(bookingInsert) ? bookingInsert[0] : bookingInsert;
      const bookingId = booking?.id;
      if (!bookingId) {
        return c.json({ success: false, error: 'Booking creation failed' }, 500);
      }

      await query(
        `UPDATE payments SET booking_id = $1, updated_at = NOW() WHERE razorpay_order_id = $2`,
        [bookingId, razorpay_order_id]
      );

      const customerName = (await query(`SELECT COALESCE(full_name, 'Customer') AS name FROM customers WHERE id = $1`, [customerId]).then((r: any) => r.rows?.[0]?.name)) || 'Customer';

      try {
        await insert('notifications', {
          recipient_id: vendorId,
          recipient_type: 'vendor',
          type: 'tele_call_incoming',
          title: '📞 Instant Video Call',
          message: `${customerName} has paid and is waiting to connect. Join the call now.`,
          data: JSON.stringify({
            booking_id: bookingId,
            call_type: 'incoming',
            action: 'answer_call',
            instant: true,
          }),
          is_read: false,
          requires_action: true,
          action_url: `/video/${bookingId}`,
          created_at: new Date(),
        });
      } catch (e) {
        console.warn('[instant-tele-v2] Vendor notification failed:', e);
      }
      try {
        await insert('notifications', {
          recipient_id: customerId,
          recipient_type: 'customer',
          type: 'tele_call_connecting',
          title: 'Connecting to vet',
          message: `${vendorName || 'Vet'} will join shortly. Please wait.`,
          data: JSON.stringify({
            booking_id: bookingId,
            action: 'join_call',
            instant: true,
          }),
          is_read: false,
          requires_action: true,
          action_url: `/video/${bookingId}`,
          created_at: new Date(),
        });
      } catch (e) {
        console.warn('[instant-tele-v2] Customer notification failed:', e);
      }

      return c.json({
        success: true,
        bookingId,
        message: 'Booking created. You can join the video call now.',
      });
    } catch (error: any) {
      console.error('[instant-tele-v2] instant-after-payment error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  /**
   * POST /customer/tele/confirm-payment
   * Self-contained endpoint for queue-accepted flow.
   * Booking already exists with status='pending_payment'.
   * Verifies Razorpay signature, updates payment + booking, sends notifications.
   * Does NOT depend on /razorpay/verify-payment having run first.
   * Body: bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount
   */
  app.post('/customer/tele/confirm-payment', async (c) => {
    try {
      const body = await c.req.json();
      const {
        bookingId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        amount,
      } = body;

      if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return c.json({ success: false, error: 'Booking ID and payment verification data required' }, 400);
      }

      // 1. Verify Razorpay signature
      const config = await getRazorpayConfig();
      if (!config?.keySecret) {
        return c.json({ success: false, error: 'Payment configuration error' }, 500);
      }
      const text = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSig = createHmac('sha256', config.keySecret).update(text).digest('hex');
      if (expectedSig !== razorpay_signature) {
        return c.json({ success: false, error: 'Invalid payment signature' }, 400);
      }

      // 2. Fetch booking
      const bookingResult = await query(`SELECT * FROM bookings WHERE id = $1`, [bookingId]);
      if (bookingResult.rows.length === 0) {
        return c.json({ success: false, error: 'Booking not found' }, 404);
      }
      const booking = bookingResult.rows[0];

      // Idempotent: if booking is already confirmed+paid or completed+paid, return success
      if ((booking.status === 'confirmed' || booking.status === 'completed') && booking.payment_status === 'paid') {
        const meetRes = await query(`SELECT meeting_id, id FROM video_call_sessions WHERE booking_id = $1 LIMIT 1`, [bookingId]);
        return c.json({
          success: true,
          bookingId,
          meetingId: meetRes.rows[0]?.meeting_id || meetRes.rows[0]?.id || null,
          message: 'Booking already confirmed.',
          alreadyConfirmed: true,
        });
      }

      // Accept v3 bookings: status='confirmed' with payment_status='pending' and is_instant_tele=true
      const isV3Booking = booking.status === 'confirmed' && booking.payment_status === 'pending' && booking.is_instant_tele === true;
      // Accept v2 bookings: status='pending_payment'
      const isV2Booking = booking.status === 'pending_payment';

      if (!isV2Booking && !isV3Booking) {
        return c.json({
          success: false,
          error: `Booking is in "${booking.status}" status with payment_status "${booking.payment_status}". Expected "pending_payment" status or "confirmed" status with pending payment for instant tele bookings.`
        }, 400);
      }

      // 3. Find or create payment record (self-contained — no dependency on verify-payment)
      let paymentResult = await query(
        `SELECT id, booking_id, payment_status FROM payments WHERE razorpay_order_id = $1 LIMIT 1`,
        [razorpay_order_id]
      );
      let payment = paymentResult.rows[0];

      if (payment) {
        // Payment record found — mark it completed if not already
        if (payment.payment_status !== 'completed') {
          await query(
            `UPDATE payments SET payment_status = 'completed', razorpay_payment_id = $1, booking_id = COALESCE(booking_id, $2), completed_at = NOW(), updated_at = NOW() WHERE id = $3`,
            [razorpay_payment_id, bookingId, payment.id]
          );
        } else if (!payment.booking_id) {
          // Already completed but not linked to booking
          await query(`UPDATE payments SET booking_id = $1, updated_at = NOW() WHERE id = $2`, [bookingId, payment.id]);
        }
      } else {
        // No payment record with this razorpay_order_id — try finding by booking_id
        paymentResult = await query(
          `SELECT id, booking_id, payment_status FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [bookingId]
        );
        payment = paymentResult.rows[0];

        if (payment) {
          await query(
            `UPDATE payments SET payment_status = 'completed', razorpay_order_id = $1, razorpay_payment_id = $2, completed_at = NOW(), updated_at = NOW() WHERE id = $3`,
            [razorpay_order_id, razorpay_payment_id, payment.id]
          );
        } else {
          // No payment record at all — create one
          await insert('payments', {
            booking_id: bookingId,
            customer_id: booking.customer_id,
            vendor_id: booking.vendor_id,
            razorpay_order_id,
            razorpay_payment_id,
            amount: Number(amount) || Number(booking.total_amount) || 0,
            currency: 'INR',
            payment_method: 'razorpay',
            payment_status: 'completed',
            completed_at: new Date(),
          });
        }
      }

      // 4. Update booking to confirmed/completed + paid

      await update('bookings', { id: bookingId }, {
        status: BookingStatus.CONFIRMED,
        payment_status: 'paid',
        updated_at: new Date(),
        notes: booking.notes
          ? `${booking.notes}\n[Razorpay: ${razorpay_order_id}/${razorpay_payment_id}]`
          : `[Razorpay: ${razorpay_order_id}/${razorpay_payment_id}]`,
      });

      // 5. Get meeting ID
      const meetingResult = await query(`SELECT meeting_id, id FROM video_call_sessions WHERE booking_id = $1 LIMIT 1`, [bookingId]);
      const meetingId = meetingResult.rows[0]?.meeting_id || meetingResult.rows[0]?.id || null;

      // 6. Notifications
      const customerName = (await query(`SELECT COALESCE(full_name, 'Customer') AS name FROM customers WHERE id = $1`, [booking.customer_id]).then((r: any) => r.rows?.[0]?.name)) || 'Customer';
      const vendorName = (await query(`SELECT business_name FROM vendors WHERE id = $1`, [booking.vendor_id]).then((r: any) => r.rows?.[0]?.business_name)) || 'Provider';

      // ✅ FIX: Use correct column names (notification_type, not type), plain objects for JSONB, no non-existent columns
      try {
        await insert('notifications', {
          recipient_id: booking.vendor_id,
          recipient_type: 'vendor',
          notification_type: 'tele_call_incoming',
          title: '📞 Instant Video Call',
          message: `${customerName} has completed payment and is waiting to connect. Join the call now.`,
          data: { booking_id: bookingId, bookingId, call_type: 'incoming', action: 'answer_call', instant: true, meeting_id: meetingId },
          channels: { email: false, sms: false, inApp: true, push: true },
          is_read: false,
        });
      } catch (e) {
        console.error('[confirm-payment] Vendor notification failed:', e);
      }

      try {
        await insert('notifications', {
          recipient_id: booking.customer_id,
          recipient_type: 'customer',
          notification_type: 'tele_call_connecting',
          title: 'Connecting to vet',
          message: `${vendorName} will join shortly. Please wait.`,
          data: { booking_id: bookingId, bookingId, action: 'join_call', instant: true, meeting_id: meetingId },
          channels: { email: false, sms: false, inApp: true, push: true },
          is_read: false,
        });
      } catch (e) {
        console.error('[confirm-payment] Customer notification failed:', e);
      }

      return c.json({ success: true, bookingId, meetingId, message: 'Payment confirmed. Booking is now confirmed.' });
    } catch (error: any) {
      console.error('[confirm-payment] error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}
