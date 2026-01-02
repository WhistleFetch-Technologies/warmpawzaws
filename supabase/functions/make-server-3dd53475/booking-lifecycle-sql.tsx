/**
 * ============================================================================
 * BOOKING LIFECYCLE ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Booking lifecycle management:
 * - Reschedule booking
 * - Accept booking (vendor)
 * - Reject booking (vendor)
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - Uses `BookingsRepository` and `CustomersRepository`
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 8)
 * KV Operations Removed: 9
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { triggerBookingNotification } from "./sms-notification-service-enhanced-sql.tsx"; // ✅ FIXED: Updated to SQL version

export function registerBookingLifecycleEndpoints(app: Hono) {

  /**
   * POST /make-server-3dd53475/bookings/:bookingId/reschedule
   * Reschedule a booking (Customer or Vendor)
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/reschedule", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { newDate, newTimeSlot, reason, phone } = await c.req.json();

      if (!newDate || !newTimeSlot) {
        return sendError(c, 'New date and time are required', 400);
      }

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Policy Check: Cannot reschedule within 2 hours
      const originalDate = new Date(`${booking.booking_date}T${booking.booking_time}`);
      const now = new Date();
      const hoursDiff = (originalDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 2) {
        return sendError(c, 'Cannot reschedule within 2 hours of appointment', 400);
      }

      // ✅ SQL: Update booking
      const oldDate = booking.booking_date;
      const oldTime = booking.booking_time;

      const updatedBooking = await bookingsRepo.update(bookingId, {
        booking_date: newDate,
        booking_time: newTimeSlot,
        status: 'rescheduled',
        cancellation_reason: reason || 'Customer request',
        updated_at: new Date().toISOString()
      });

      // ✅ SQL: Get customer for notification
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(booking.customer_id);

      // 🔔 NOTIFICATION
      if (customer) {
        await triggerBookingNotification(null, 'booking.rescheduled', { 
          booking: updatedBooking, 
          customer 
        });
      }

      console.log(`✅ Booking ${bookingId} rescheduled to ${newDate} ${newTimeSlot}`);
      return sendSuccess(c, { booking: updatedBooking });

    } catch (error) {
      console.error('Error rescheduling booking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/bookings/:bookingId/accept
   * Vendor accepts a pending booking (Cafe/Resort)
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/accept", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId } = await c.req.json(); // Verify vendor ownership

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      if (booking.status !== 'pending') {
        return sendError(c, `Booking is already ${booking.status}`, 400);
      }

      // ✅ SQL: Update booking status
      const updatedBooking = await bookingsRepo.update(bookingId, {
        status: 'confirmed',
        updated_at: new Date().toISOString()
      });

      // ✅ SQL: Get customer for notification
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(booking.customer_id);

      // 🔔 NOTIFICATION
      if (customer) {
        await triggerBookingNotification(null, 'booking.confirmed', { 
          booking: updatedBooking, 
          customer 
        });
      }

      console.log(`✅ Booking ${bookingId} accepted by vendor ${vendorId}`);
      return sendSuccess(c, { booking: updatedBooking });

    } catch (error) {
      console.error('Error accepting booking:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/bookings/:bookingId/reject
   * Vendor rejects a pending booking
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/reject", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, reason } = await c.req.json();

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Update booking status
      const updatedBooking = await bookingsRepo.update(bookingId, {
        status: 'cancelled',
        cancellation_reason: reason || 'Vendor rejected request',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      // ✅ FIX: Process refund automatically
      try {
        const refundResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-3dd53475/bookings/${bookingId}/process-refund`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
            },
            body: JSON.stringify({
              refundMethod: 'wallet', // Default to wallet for vendor rejections
              reason: reason || 'Vendor rejected request'
            })
          }
        );

        if (refundResponse.ok) {
          const refundData = await refundResponse.json();
          // Update booking with refund info
          await bookingsRepo.update(bookingId, {
            payment_status: 'refunded',
            updated_at: new Date().toISOString()
          });
        }
      } catch (refundError) {
        console.error('Error processing refund:', refundError);
        // Continue - refund will be retried
      }

      // ✅ SQL: Get customer for notification
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(booking.customer_id);

      // 🔔 NOTIFICATION
      if (customer) {
        await triggerBookingNotification(null, 'booking.cancelled', { 
          booking: updatedBooking, 
          customer 
        });
      }

      return sendSuccess(c, { booking: updatedBooking });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}

