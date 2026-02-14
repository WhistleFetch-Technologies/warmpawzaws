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
import { query, insert, update, select } from '../database/rds-connection';
import { getRazorpayConfig } from '../utils/razorpay-client';

const VET_ROLE_NAMES = ['veterinarian', 'vet', 'veterinary', 'vet_solo', 'vet_clinic', 'pet_clinic'];

export function registerInstantTeleV2Endpoints(app: Hono) {
  /**
   * GET /customer/tele/available-now
   * Vendors (vet only) who are "available right now" for instant tele:
   * - Have at least one row in vendor_availability_v2 for today's day_of_week
   * - With 'tele' in service_styles (or service_style/service_type = 'tele')
   * - Current time is inside time_window_start..time_window_end (no buffer applied)
   * - Vendor has published tele service in vendor_services
   * No staff. No queue.
   */
  app.get('/customer/tele/available-now', async (c) => {
    try {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

      const result = await query(
        `SELECT DISTINCT v.id AS vendor_id,
                COALESCE(v.business_name, v.owner_name, 'Vet') AS vendor_name,
                v.profile_photo_url AS photo,
                v.phone,
                v.city,
                v.address
         FROM vendors v
         INNER JOIN roles r ON r.id = v.role_id AND r.is_active = true
         INNER JOIN vendor_availability_v2 va ON va.vendor_id = v.id
         INNER JOIN vendor_services vs ON vs.vendor_id = v.id
         WHERE v.is_active = true
           AND (v.status = 'approved' OR v.status IS NULL)
           AND LOWER(r.name) IN (SELECT LOWER(unnest($3::text[])))
           AND va.day_of_week = $1
           AND (COALESCE(va.service_styles, ARRAY[]::text[]) && ARRAY['tele', 'online', 'video_consultation']::text[]
                OR va.service_style IN ('tele', 'online', 'video_consultation')
                OR va.service_type IN ('tele', 'online', 'video_consultation'))
           AND COALESCE(va.is_available, true) = true
           AND (COALESCE(va.time_window_start::text, va.start_time::text) <= $2
                AND COALESCE(va.time_window_end::text, va.end_time::text) >= $2)
           AND vs.service_style = 'tele'
           AND vs.is_enabled = true
           AND COALESCE(vs.publish_status, 'published') = 'published'
         ORDER BY v.business_name`,
        [dayOfWeek, currentTime, VET_ROLE_NAMES]
      ).catch((err) => {
        console.error('[instant-tele-v2] available-now query error:', err);
        return { rows: [] };
      });

      const rows = (result as any).rows || [];
      const vendors = rows.map((r: any) => ({
        vendorId: r.vendor_id,
        vendorName: r.vendor_name,
        photo: r.photo,
        phone: r.phone,
        city: r.city,
        address: r.address,
      }));

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
        service_name: serviceName || 'Instant Vet Consultation',
        booking_date: today,
        booking_time: timeStr,
        total_amount: totalAmount,
        status: 'confirmed',
        payment_status: 'paid',
        is_instant_tele: true,
        metadata: JSON.stringify({ instant_tele_v2: true, razorpay_order_id: razorpay_order_id }),
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

      const customerName = (await query(`SELECT name FROM customers WHERE id = $1`, [customerId]).then((r: any) => r.rows?.[0]?.name)) || 'Customer';

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
}
