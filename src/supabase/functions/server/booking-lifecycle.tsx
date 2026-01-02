// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { triggerBookingNotification } from "./sms-notification-service-enhanced";
import { 
  getBookingsRepository,
  getCustomersRepository
} from '../../../supabase/lib/repositories/index';

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

      // ✅ SQL: Get booking from bookings table
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

      // Update Booking
      const oldDate = booking.booking_date;
      const oldTime = booking.booking_time;

      // ✅ SQL: Update booking in bookings table
      const history = booking.metadata?.history || [];
      history.push({
        action: 'reschedule',
        from: `${oldDate} ${oldTime}`,
        to: `${newDate} ${newTimeSlot}`,
        at: new Date().toISOString(),
        by: phone || 'customer'
      });

      await bookingsRepo.update(bookingId, {
        booking_date: newDate,
        booking_time: newTimeSlot,
        status: 'rescheduled',
        metadata: {
          ...booking.metadata,
          rescheduledAt: new Date().toISOString(),
          rescheduleReason: reason || 'Customer request',
          history
        }
      });

      const updatedBooking = await bookingsRepo.findById(bookingId);

      // 🔔 NOTIFICATION
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(booking.customer_id);
      await triggerBookingNotification(null, 'booking.rescheduled', { booking: updatedBooking, customer });

      console.log(`✅ Booking ${bookingId} rescheduled to ${newDate} ${newTimeSlot}`);
      return sendSuccess(c, { booking });

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

      // ✅ SQL: Get booking from bookings table
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
      await bookingsRepo.update(bookingId, {
        status: 'confirmed',
        metadata: {
          ...booking.metadata,
          confirmedAt: new Date().toISOString()
        }
      });

      const updatedBooking = await bookingsRepo.findById(bookingId);

      // 🔔 NOTIFICATION
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(booking.customer_id);
      await triggerBookingNotification(null, 'booking.confirmed', { booking: updatedBooking, customer });

      console.log(`✅ Booking ${bookingId} accepted by vendor ${vendorId}`);
      return sendSuccess(c, { booking });

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

      // ✅ SQL: Get booking from bookings table
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) return sendError(c, 'Booking not found', 404);
      if (booking.vendor_id !== vendorId) return sendError(c, 'Unauthorized', 403);

      let refundStatus = 'pending';
      let refundId = null;
      let refundAmount = null;
      
      // ✅ FIX: Process refund automatically - use relative path or internal call
      try {
        // Internal API call - use relative path for same function environment
        const refundResponse = await fetch(
          `/make-server-3dd53475/bookings/${bookingId}/process-refund`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              refundMethod: 'wallet', // Default to wallet for vendor rejections
              reason: reason || 'Vendor rejected request'
            })
          }
        );

        if (refundResponse.ok) {
          const refundData = await refundResponse.json();
          refundStatus = 'refunded';
          refundId = refundData.refund?.id;
          refundAmount = refundData.refund?.amount;
        }
      } catch (refundError) {
        console.error('Error processing refund:', refundError);
      }

      // ✅ SQL: Update booking status
      await bookingsRepo.update(bookingId, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || 'Vendor rejected request',
        metadata: {
          ...booking.metadata,
          cancelledBy: 'vendor',
          refundStatus,
          refundId,
          refundAmount
        }
      });

      const updatedBooking = await bookingsRepo.findById(bookingId);

      // 🔔 NOTIFICATION
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(booking.customer_id);
      await triggerBookingNotification(null, 'booking.cancelled', { booking: updatedBooking, customer });

      return sendSuccess(c, { booking });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}
