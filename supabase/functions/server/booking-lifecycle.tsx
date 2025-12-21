import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";
import { triggerBookingNotification } from "./sms-notification-service-enhanced.tsx";

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

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Policy Check: Cannot reschedule within 2 hours
      const originalDate = new Date(`${booking.scheduledDate}T${booking.scheduledTime}`);
      const now = new Date();
      const hoursDiff = (originalDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 2) {
        return sendError(c, 'Cannot reschedule within 2 hours of appointment', 400);
      }

      // Update Booking
      const oldDate = booking.scheduledDate;
      const oldTime = booking.scheduledTime;

      booking.scheduledDate = newDate;
      booking.scheduledTime = newTimeSlot;
      booking.rescheduledAt = new Date().toISOString();
      booking.rescheduleReason = reason || 'Customer request';
      booking.status = 'rescheduled'; // or 'confirmed' if auto-approved
      
      // Add to history
      if (!booking.history) booking.history = [];
      booking.history.push({
        action: 'reschedule',
        from: `${oldDate} ${oldTime}`,
        to: `${newDate} ${newTimeSlot}`,
        at: new Date().toISOString(),
        by: phone || 'customer'
      });

      await kv.set(`booking:${bookingId}`, booking);

      // 🔔 NOTIFICATION
      const customer = await kv.get(`customer:${booking.customerId}`);
      await triggerBookingNotification(kv, 'booking.rescheduled', { booking, customer });

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

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      if (booking.status !== 'pending') {
        return sendError(c, `Booking is already ${booking.status}`, 400);
      }

      booking.status = 'confirmed';
      booking.confirmedAt = new Date().toISOString();
      
      await kv.set(`booking:${bookingId}`, booking);

      // 🔔 NOTIFICATION
      const customer = await kv.get(`customer:${booking.customerId}`);
      await triggerBookingNotification(kv, 'booking.confirmed', { booking, customer });

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

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) return sendError(c, 'Booking not found', 404);
      if (booking.vendorId !== vendorId) return sendError(c, 'Unauthorized', 403);

      booking.status = 'cancelled';
      booking.cancelledAt = new Date().toISOString();
      booking.cancellationReason = reason || 'Vendor rejected request';
      
      // Trigger Refund Logic Here (TODO: Integrate with Payment System)
      booking.refundStatus = 'pending';

      await kv.set(`booking:${bookingId}`, booking);

      // 🔔 NOTIFICATION
      const customer = await kv.get(`customer:${booking.customerId}`);
      await triggerBookingNotification(kv, 'booking.cancelled', { booking, customer });

      return sendSuccess(c, { booking });
    } catch (error) {
      return sendError(c, error, 500);
    }
  });
}
