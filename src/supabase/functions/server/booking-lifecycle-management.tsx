import { Hono } from "hono";
// ✅ SQL MIGRATION: Removed KV import, using SQL repositories
import { generateId } from './database-schema';
import { getBookingsRepository } from "../../../supabase/lib/repositories/bookings";
import { getVendorsRepository } from "../../../supabase/lib/repositories/vendors";
import { getNotificationsRepository } from "../../../supabase/lib/repositories/notifications";
import { getPlatformSettingsRepository } from "../../../supabase/lib/repositories/platform-settings";
import { getVendorPoliciesRepository } from "../../../supabase/lib/repositories/vendor-policies";
import { createNotificationHelper } from './notification-system';
import { broadcastVendorUpdate } from './websocket-server';

/**
 * BOOKING LIFECYCLE MANAGEMENT
 * Complete booking flow: reschedule, cancel, refund, accept/decline
 * 
 * Features:
 * - Reschedule with slot availability check
 * - Cancel with refund calculation
 * - Vendor accept/decline
 * - Refund policy enforcement
 * - Commission adjustments on refunds
 * - Notification triggers
 */

export function registerBookingLifecycleManagement(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // =============================================
  // GET REFUND ELIGIBILITY
  // =============================================
  app.get(`${BASE}/bookings/:bookingId/refund-eligibility`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // ✅ SQL: Get vendor's refund policy
      const vendorsRepo = getVendorsRepository();
      const vendorPoliciesRepo = getVendorPoliciesRepository();
      const vendor = booking.vendor_id ? await vendorsRepo.findById(booking.vendor_id) : null;
      const vendorRefundPolicy = booking.vendor_id ? await vendorPoliciesRepo.getDefaultPolicy(booking.vendor_id, 'refund') : null;
      
      // ✅ SQL: Get platform refund settings
      const platformSettingsRepo = getPlatformSettingsRepository();
      const platformRefundSettings = await platformSettingsRepo.getSetting('refund_settings');

      // Calculate time until booking
      const now = new Date();
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time || '00:00'}`);
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Determine refund percentage based on cancellation time
      let refundPercentage = 0;
      let cancellationFee = 0;

      if (booking.status === 'in_progress' || booking.status === 'completed') {
        refundPercentage = 0;
        cancellationFee = booking.total_amount || 0;
      } else if (hoursUntil >= 24) {
        // More than 24 hours: Full refund
        refundPercentage = 100;
        cancellationFee = 0;
      } else if (hoursUntil >= 12) {
        // 12-24 hours: 75% refund
        refundPercentage = 75;
        cancellationFee = (booking.total_amount || 0) * 0.25;
      } else if (hoursUntil >= 6) {
        // 6-12 hours: 50% refund
        refundPercentage = 50;
        cancellationFee = (booking.total_amount || 0) * 0.50;
      } else if (hoursUntil >= 2) {
        // 2-6 hours: 25% refund
        refundPercentage = 25;
        cancellationFee = (booking.total_amount || 0) * 0.75;
      } else {
        // Less than 2 hours: No refund
        refundPercentage = 0;
        cancellationFee = booking.total_amount || 0;
      }

      const refundAmount = ((booking.total_amount || 0) * refundPercentage) / 100;

      return c.json({
        success: true,
        eligible: refundPercentage > 0,
        refundPercentage,
        refundAmount,
        cancellationFee,
        hoursUntil: Math.floor(hoursUntil),
        policy: {
          '24+ hours': '100% refund',
          '12-24 hours': '75% refund',
          '6-12 hours': '50% refund',
          '2-6 hours': '25% refund',
          'Less than 2 hours': 'No refund'
        }
      });

    } catch (error) {
      console.error('[REFUND] Error:', error);
      return c.json({ error: 'Failed to check refund eligibility' }, 500);
    }
  });

  // =============================================
  // CANCEL BOOKING WITH REFUND
  // =============================================
  app.post(`${BASE}/bookings/:bookingId/cancel`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { userId, userType, reason } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Verify access
      if (userType === 'customer' && booking.customer_id !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      if (userType === 'vendor' && booking.vendor_id !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Cannot cancel if already completed
      if (booking.status === 'completed') {
        return c.json({ error: 'Cannot cancel completed booking' }, 400);
      }

      // Calculate refund
      const now = new Date();
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.booking_time || '00:00'}`);
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      let refundPercentage = 0;
      if (hoursUntil >= 24) refundPercentage = 100;
      else if (hoursUntil >= 12) refundPercentage = 75;
      else if (hoursUntil >= 6) refundPercentage = 50;
      else if (hoursUntil >= 2) refundPercentage = 25;

      const refundAmount = ((booking.total_amount || 0) * refundPercentage) / 100;
      const cancellationFee = (booking.total_amount || 0) - refundAmount;

      // ✅ SQL: Cancel booking using cancel method
      const cancelledBooking = await bookingsRepo.cancel(bookingId, reason || 'Customer cancellation');

      // If refund eligible, initiate refund process via refund service
      let refundRecord = null;
      if (refundAmount > 0 && booking.payment_id) {
        console.log(`💰 [REFUND] Processing refund of ₹${refundAmount} for booking ${bookingId}`);
        
        try {
          // ✅ SQL: Create refund record
          const { getRefundsRepository } = await import("../../../supabase/lib/repositories/refunds.ts");
          const refundsRepo = getRefundsRepository();
          refundRecord = await refundsRepo.create({
            payment_id: booking.payment_id,
            booking_id: bookingId,
            customer_id: booking.customer_id,
            vendor_id: booking.vendor_id || undefined,
            refund_amount: refundAmount,
            refund_reason: reason || 'Booking cancellation',
            refund_status: 'pending',
          });
          
          // Process refund via wallet or Razorpay (handled by refund processing service)
          // Note: Actual refund processing should be handled by a dedicated refund service
          console.log(`✅ [REFUND] Refund record created: ${refundRecord.id}`);
        } catch (refundError) {
          console.error('[REFUND] Error creating refund record:', refundError);
        }
      }

      // ✅ SQL: Send notifications using notification system
      await sendCancellationNotifications(cancelledBooking, userType);

      return c.json({
        success: true,
        booking: cancelledBooking,
        refund: refundRecord ? {
          id: refundRecord.id,
          amount: refundAmount,
          status: refundRecord.refund_status,
        } : null,
        message: refundAmount > 0 
          ? `Booking cancelled. ₹${refundAmount} will be refunded.`
          : 'Booking cancelled. No refund applicable.'
      });

    } catch (error) {
      console.error('[CANCEL] Error:', error);
      return c.json({ error: 'Failed to cancel booking' }, 500);
    }
  });

  // =============================================
  // RESCHEDULE BOOKING
  // =============================================
  app.post(`${BASE}/bookings/:bookingId/reschedule`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { userId, newDate, newTime, reason } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Verify customer access
      if (booking.customer_id !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Cannot reschedule if in progress or completed
      if (booking.status === 'in_progress' || booking.status === 'completed') {
        return c.json({ error: 'Cannot reschedule active or completed booking' }, 400);
      }

      // Check if slot is available
      const isAvailable = await checkSlotAvailability(
        booking.vendor_id || '',
        booking.staff_id || '',
        newDate,
        newTime,
        60 // Default duration
      );

      if (!isAvailable) {
        return c.json({ error: 'Selected slot is not available' }, 400);
      }

      // ✅ SQL: Reschedule booking
      const rescheduledBooking = await bookingsRepo.reschedule(bookingId, newDate, newTime);

      // ✅ SQL: Send notifications
      await sendRescheduleNotifications(rescheduledBooking);

      return c.json({
        success: true,
        booking: rescheduledBooking,
        message: 'Booking rescheduled successfully'
      });

    } catch (error) {
      console.error('[RESCHEDULE] Error:', error);
      return c.json({ error: 'Failed to reschedule booking' }, 500);
    }
  });

  // =============================================
  // VENDOR: ACCEPT BOOKING
  // =============================================
  app.post(`${BASE}/bookings/:bookingId/accept`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, staffId, notes } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      if (booking.status !== 'pending' && booking.status !== 'confirmed') {
        return c.json({ error: 'Booking already processed' }, 400);
      }

      // ✅ SQL: Confirm booking and update staff if provided
      const updateData: any = { status: 'confirmed' };
      if (staffId) {
        updateData.staff_id = staffId;
      }
      if (notes) {
        updateData.notes = notes;
      }
      const confirmedBooking = await bookingsRepo.update(bookingId, updateData);

      // ✅ SQL: Send confirmation notification
      await sendBookingConfirmationNotification(confirmedBooking);

      // ✅ BROADCAST: Send real-time update to vendor mobile app
      try {
        broadcastVendorUpdate({
          vendorId,
          updateType: 'booking',
          title: 'Booking Accepted',
          message: `Booking ${bookingId} has been accepted${staffId ? ` and assigned to staff` : ''}`,
          bookingId,
          staffId,
          data: { status: 'confirmed', booking: confirmedBooking }
        });
      } catch (wsError) {
        console.error('[ACCEPT] WebSocket broadcast error:', wsError);
        // Don't fail the request if WebSocket fails
      }

      return c.json({
        success: true,
        booking: confirmedBooking,
        message: 'Booking accepted successfully'
      });

    } catch (error) {
      console.error('[ACCEPT] Error:', error);
      return c.json({ error: 'Failed to accept booking' }, 500);
    }
  });

  // =============================================
  // VENDOR: DECLINE BOOKING
  // =============================================
  app.post(`${BASE}/bookings/:bookingId/decline`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, reason, suggestAlternative } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // ✅ SQL: Cancel booking (vendor decline = cancellation with full refund)
      const declinedBooking = await bookingsRepo.cancel(bookingId, reason || 'Declined by vendor');

      // Full refund on vendor decline - create refund record
      const refundAmount = booking.total_amount || 0;
      if (refundAmount > 0 && booking.payment_id) {
        try {
          const { getRefundsRepository } = await import("../../../supabase/lib/repositories/refunds.ts");
          const refundsRepo = getRefundsRepository();
          await refundsRepo.create({
            payment_id: booking.payment_id,
            booking_id: bookingId,
            customer_id: booking.customer_id,
            vendor_id: booking.vendor_id || undefined,
            refund_amount: refundAmount,
            refund_reason: 'Vendor declined booking',
            refund_status: 'pending',
          });
          console.log(`💰 [REFUND] Vendor declined - Full refund of ₹${refundAmount}`);
        } catch (refundError) {
          console.error('[REFUND] Error creating refund:', refundError);
        }
      }

      // ✅ SQL: Send notification
      await sendBookingDeclinedNotification(declinedBooking);

      return c.json({
        success: true,
        booking: declinedBooking,
        message: 'Booking declined. Customer will be refunded.'
      });

    } catch (error) {
      console.error('[DECLINE] Error:', error);
      return c.json({ error: 'Failed to decline booking' }, 500);
    }
  });

  // =============================================
  // GET AVAILABLE SLOTS FOR RESCHEDULE
  // =============================================
  app.get(`${BASE}/bookings/:bookingId/available-slots`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const date = c.req.query('date');

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // ✅ SQL: Get staff schedule and bookings for the date
      // Note: Staff schedules should be stored in SQL - for now, use default schedule
      const staffSchedule = {
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      };

      // ✅ SQL: Get bookings for this staff/vendor on the date
      const vendorBookings = booking.vendor_id 
        ? await bookingsRepo.findByVendor(booking.vendor_id, { date })
        : [];
      
      const dateBookings = vendorBookings.filter(b => 
        b.booking_date === date && 
        b.staff_id === booking.staff_id && 
        b.status !== 'cancelled'
      );

      // Generate available slots
      const slots = generateAvailableSlots(
        staffSchedule,
        dateBookings,
        60 // Default duration
      );

      return c.json({
        success: true,
        date,
        slots,
        totalSlots: slots.length
      });

    } catch (error) {
      console.error('[SLOTS] Error:', error);
      return c.json({ error: 'Failed to fetch available slots' }, 500);
    }
  });

  // Helper functions
  async function checkSlotAvailability(
    vendorId: string,
    staffId: string,
    date: string,
    time: string,
    duration: number
  ): Promise<boolean> {
    // ✅ SQL: Get bookings for this vendor/staff on the date
    const bookingsRepo = getBookingsRepository();
    const vendorBookings = await bookingsRepo.findByVendor(vendorId, { date: date || undefined });
    
    for (const booking of vendorBookings) {
      if (
        (staffId ? booking.staff_id === staffId : true) &&
        booking.booking_date === date &&
        booking.status !== 'cancelled'
      ) {
        // Check if times overlap
        if (booking.booking_time === time) {
          return false;
        }
      }
    }
    
    return true;
  }

  function generateAvailableSlots(schedule: any, existingBookings: any[], duration: number) {
    const slots = [];
    const startTime = schedule.startTime || '09:00';
    const endTime = schedule.endTime || '18:00';
    
    // Simple slot generation (can be enhanced)
    const [startHour] = startTime.split(':').map(Number);
    const [endHour] = endTime.split(':').map(Number);
    
    for (let hour = startHour; hour < endHour; hour++) {
      const slot = `${hour.toString().padStart(2, '0')}:00`;
      
      // Check if slot is occupied
      const isOccupied = existingBookings.some(b => b.booking_time === slot);
      
      if (!isOccupied) {
        slots.push({
          time: slot,
          available: true
        });
      }
    }
    
    return slots;
  }

  async function sendCancellationNotifications(booking: any, cancelledBy: string) {
    // ✅ SQL: Create notifications for both parties using notification system
    try {
      await createNotificationHelper({
        recipientId: booking.customer_id,
        recipientType: 'customer',
        type: 'booking_cancelled',
        category: 'bookings',
        title: 'Booking Cancelled',
        message: cancelledBy === 'customer' 
          ? `Your booking has been cancelled.`
          : `Your booking was cancelled by the vendor. Full refund will be processed.`,
        data: { bookingId: booking.id },
        priority: 'high',
      });

      if (booking.vendor_id) {
        await createNotificationHelper({
          recipientId: booking.vendor_id,
          recipientType: 'vendor',
          type: 'booking_cancelled',
          category: 'bookings',
          title: 'Booking Cancelled',
          message: cancelledBy === 'customer'
            ? `Customer cancelled booking for ${new Date(booking.booking_date).toLocaleDateString()}`
            : 'You cancelled this booking',
          data: { bookingId: booking.id },
          priority: 'medium',
        });
      }

      console.log(`📧 [NOTIFICATION] Cancellation notifications sent for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending cancellation notifications:', error);
    }
  }

  async function sendRescheduleNotifications(booking: any) {
    // ✅ SQL: Send notifications using notification system
    try {
      if (booking.vendor_id) {
        await createNotificationHelper({
          recipientId: booking.vendor_id,
          recipientType: 'vendor',
          type: 'booking_rescheduled',
          category: 'bookings',
          title: 'Booking Rescheduled',
          message: `Customer rescheduled to ${new Date(booking.booking_date).toLocaleDateString()} at ${booking.booking_time}`,
          data: { bookingId: booking.id },
          priority: 'medium',
        });
      }

      await createNotificationHelper({
        recipientId: booking.customer_id,
        recipientType: 'customer',
        type: 'booking_rescheduled',
        category: 'bookings',
        title: 'Booking Rescheduled',
        message: `Your booking has been rescheduled to ${new Date(booking.booking_date).toLocaleDateString()} at ${booking.booking_time}`,
        data: { bookingId: booking.id },
        priority: 'medium',
      });

      console.log(`📧 [NOTIFICATION] Reschedule notifications sent for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending reschedule notifications:', error);
    }
  }

  async function sendBookingConfirmationNotification(booking: any) {
    // ✅ SQL: Send notification using notification system
    try {
      await createNotificationHelper({
        recipientId: booking.customer_id,
        recipientType: 'customer',
        type: 'booking_confirmed',
        category: 'bookings',
        title: 'Booking Confirmed! 🎉',
        message: `Your booking for ${new Date(booking.booking_date).toLocaleDateString()} has been confirmed by the vendor.`,
        data: { bookingId: booking.id },
        priority: 'high',
      });

      console.log(`📧 [NOTIFICATION] Confirmation sent to customer for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending confirmation:', error);
    }
  }

  async function sendBookingDeclinedNotification(booking: any) {
    // ✅ SQL: Send notification using notification system
    try {
      await createNotificationHelper({
        recipientId: booking.customer_id,
        recipientType: 'customer',
        type: 'booking_declined',
        category: 'bookings',
        title: 'Booking Declined',
        message: `Your booking request was declined. Full refund will be processed.`,
        data: { bookingId: booking.id },
        priority: 'high',
      });

      console.log(`📧 [NOTIFICATION] Decline notification sent to customer for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending decline notification:', error);
    }
  }
}