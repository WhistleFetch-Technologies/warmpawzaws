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
 * DEPRECATED: Use instant-tele-v3 instead.
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

}
