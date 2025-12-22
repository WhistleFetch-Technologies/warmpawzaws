import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';
import { generateId } from './database-schema.tsx';

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

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Get vendor's refund policy
      const vendor = await kv.get(`vendor:${booking.vendorId}`);
      const vendorSettings = await kv.get(`vendor:${booking.vendorId}:settings`) || {};
      
      // Get platform refund settings
      const platformSettings = await kv.get('platform:settings:refund_policies') || {};

      // Calculate time until booking
      const now = new Date();
      const bookingDateTime = new Date(`${booking.scheduledDate}T${booking.scheduledTime || '00:00'}`);
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Determine refund percentage based on cancellation time
      let refundPercentage = 0;
      let cancellationFee = 0;

      if (booking.status === 'in_progress' || booking.status === 'completed') {
        refundPercentage = 0;
        cancellationFee = booking.totalAmount || booking.price;
      } else if (hoursUntil >= 24) {
        // More than 24 hours: Full refund
        refundPercentage = 100;
        cancellationFee = 0;
      } else if (hoursUntil >= 12) {
        // 12-24 hours: 75% refund
        refundPercentage = 75;
        cancellationFee = (booking.totalAmount || booking.price) * 0.25;
      } else if (hoursUntil >= 6) {
        // 6-12 hours: 50% refund
        refundPercentage = 50;
        cancellationFee = (booking.totalAmount || booking.price) * 0.50;
      } else if (hoursUntil >= 2) {
        // 2-6 hours: 25% refund
        refundPercentage = 25;
        cancellationFee = (booking.totalAmount || booking.price) * 0.75;
      } else {
        // Less than 2 hours: No refund
        refundPercentage = 0;
        cancellationFee = booking.totalAmount || booking.price;
      }

      const refundAmount = ((booking.totalAmount || booking.price) * refundPercentage) / 100;

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

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Verify access
      if (userType === 'customer' && booking.customerId !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      if (userType === 'vendor' && booking.vendorId !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Cannot cancel if already completed
      if (booking.status === 'completed') {
        return c.json({ error: 'Cannot cancel completed booking' }, 400);
      }

      // Calculate refund
      const now = new Date();
      const bookingDateTime = new Date(`${booking.scheduledDate}T${booking.scheduledTime || '00:00'}`);
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      let refundPercentage = 0;
      if (hoursUntil >= 24) refundPercentage = 100;
      else if (hoursUntil >= 12) refundPercentage = 75;
      else if (hoursUntil >= 6) refundPercentage = 50;
      else if (hoursUntil >= 2) refundPercentage = 25;

      const refundAmount = ((booking.totalAmount || booking.price) * refundPercentage) / 100;
      const cancellationFee = (booking.totalAmount || booking.price) - refundAmount;

      // Update booking
      booking.status = 'cancelled';
      booking.cancellationReason = reason || '';
      booking.cancelledBy = userType;
      booking.cancelledAt = new Date().toISOString();
      booking.refund = {
        eligible: refundPercentage > 0,
        percentage: refundPercentage,
        amount: refundAmount,
        cancellationFee,
        status: refundAmount > 0 ? 'pending' : 'not_applicable',
        processedAt: null
      };
      booking.updatedAt = new Date().toISOString();

      await kv.set(`booking:${bookingId}`, booking);

      // If refund eligible, initiate refund process
      if (refundAmount > 0) {
        console.log(`💰 [REFUND] Processing refund of ₹${refundAmount} for booking ${bookingId}`);
        
        // Get refund method preference (wallet or original payment method)
        const refundToWallet = booking.refundToWallet !== false; // Default to wallet if not specified
        
        if (refundToWallet) {
          // ✅ Credit to wallet
          try {
            const walletCreditResponse = await fetch(
              `https://${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-3dd53475/wallet/${booking.customerId}/credit`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  amount: refundAmount,
                  source: 'refund',
                  description: `Refund for cancelled booking ${bookingId}`,
                  referenceId: bookingId
                })
              }
            );

            if (walletCreditResponse.ok) {
              const walletData = await walletCreditResponse.json();
              booking.refund.method = 'wallet';
              booking.refund.walletTransactionId = walletData.transaction?.id;
              booking.refund.status = 'completed';
              booking.refund.processedAt = new Date().toISOString();
              console.log(`✅ [REFUND] Credited ₹${refundAmount} to wallet for customer ${booking.customerId}`);
            } else {
              console.error('[REFUND] Failed to credit wallet, falling back to Razorpay');
              refundToWallet = false; // Fallback to Razorpay
            }
          } catch (error) {
            console.error('[REFUND] Error crediting wallet:', error);
            refundToWallet = false; // Fallback to Razorpay
          }
        }
        
        // If wallet credit failed or not preferred, use Razorpay refund
        if (!refundToWallet && booking.razorpayPaymentId) {
          try {
            const refundResponse = await fetch(
              `https://${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-3dd53475/refunds/process`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  bookingId,
                  amount: refundAmount,
                  reason: reason || 'Booking cancellation'
                })
              }
            );

            if (refundResponse.ok) {
              const refundData = await refundResponse.json();
              booking.refund.razorpayRefundId = refundData.refundId;
              booking.refund.method = 'razorpay';
              booking.refund.status = 'processing';
              console.log(`✅ [REFUND] Razorpay refund initiated: ${refundData.refundId}`);
            } else {
              console.error('[REFUND] Failed to initiate Razorpay refund');
              booking.refund.status = 'failed';
            }
          } catch (error) {
            console.error('[REFUND] Error calling refund API:', error);
            booking.refund.status = 'failed';
          }
        }
        
        // Adjust vendor payout
        if (booking.vendorPayout) {
          const vendorRefundDeduction = (booking.vendorPayout * refundPercentage) / 100;
          booking.vendorPayout -= vendorRefundDeduction;
        }
        
        // Update commission if needed
        if (booking.platformCommission) {
          const commissionRefund = (booking.platformCommission * refundPercentage) / 100;
          booking.platformCommission -= commissionRefund;
        }
      }

      // Send notifications
      await sendCancellationNotifications(booking, userType);

      return c.json({
        success: true,
        booking,
        refund: booking.refund,
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

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Verify customer access
      if (booking.customerId !== userId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      // Cannot reschedule if in progress or completed
      if (booking.status === 'in_progress' || booking.status === 'completed') {
        return c.json({ error: 'Cannot reschedule active or completed booking' }, 400);
      }

      // Check if slot is available
      const isAvailable = await checkSlotAvailability(
        booking.vendorId,
        booking.staffId,
        newDate,
        newTime,
        booking.duration || 60
      );

      if (!isAvailable) {
        return c.json({ error: 'Selected slot is not available' }, 400);
      }

      // Store original schedule
      if (!booking.rescheduleHistory) {
        booking.rescheduleHistory = [];
      }

      booking.rescheduleHistory.push({
        oldDate: booking.scheduledDate,
        oldTime: booking.scheduledTime,
        newDate,
        newTime,
        reason: reason || '',
        rescheduledAt: new Date().toISOString()
      });

      // Update booking
      booking.scheduledDate = newDate;
      booking.scheduledTime = newTime;
      booking.status = 'rescheduled';
      booking.updatedAt = new Date().toISOString();

      await kv.set(`booking:${bookingId}`, booking);

      // Send notifications
      await sendRescheduleNotifications(booking);

      return c.json({
        success: true,
        booking,
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

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      if (booking.status !== 'pending' && booking.status !== 'confirmed') {
        return c.json({ error: 'Booking already processed' }, 400);
      }

      // Assign staff if provided
      if (staffId) {
        booking.staffId = staffId;
      }

      booking.status = 'confirmed';
      booking.vendorNotes = notes || '';
      booking.acceptedAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();

      await kv.set(`booking:${bookingId}`, booking);

      // Send confirmation notification to customer
      await sendBookingConfirmationNotification(booking);

      return c.json({
        success: true,
        booking,
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

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      booking.status = 'declined';
      booking.declineReason = reason || '';
      booking.suggestedAlternative = suggestAlternative || null;
      booking.declinedAt = new Date().toISOString();
      booking.updatedAt = new Date().toISOString();

      // Full refund on vendor decline
      booking.refund = {
        eligible: true,
        percentage: 100,
        amount: booking.totalAmount || booking.price,
        cancellationFee: 0,
        status: 'pending',
        processedAt: null
      };

      await kv.set(`booking:${bookingId}`, booking);

      // Initiate refund
      console.log(`💰 [REFUND] Vendor declined - Full refund of ₹${booking.refund.amount}`);

      // Send notification to customer
      await sendBookingDeclinedNotification(booking);

      return c.json({
        success: true,
        booking,
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

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Get staff schedule
      const schedules = await kv.get(`vendor:${booking.vendorId}:staff_schedules`) || [];
      const staffSchedule = schedules.find((s: any) => 
        s.staffId === booking.staffId && s.isActive
      );

      if (!staffSchedule) {
        return c.json({ error: 'Staff schedule not found' }, 404);
      }

      // Get all bookings for this staff on the date
      const vendorBookings = await kv.get(`vendor:${booking.vendorId}:bookings`) || [];
      const dateBookings = [];

      for (const bid of vendorBookings) {
        const b = await kv.get(`booking:${bid}`);
        if (b && b.scheduledDate === date && b.staffId === booking.staffId && b.status !== 'cancelled') {
          dateBookings.push(b);
        }
      }

      // Generate available slots
      const slots = generateAvailableSlots(
        staffSchedule,
        dateBookings,
        booking.duration || 60
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
    const vendorBookings = await kv.get(`vendor:${vendorId}:bookings`) || [];
    
    for (const bid of vendorBookings) {
      const booking = await kv.get(`booking:${bid}`);
      if (
        booking &&
        booking.staffId === staffId &&
        booking.scheduledDate === date &&
        booking.status !== 'cancelled'
      ) {
        // Check if times overlap
        if (booking.scheduledTime === time) {
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
      const isOccupied = existingBookings.some(b => b.scheduledTime === slot);
      
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
    // Create notifications for both parties
    try {
      const customerNotif = {
        id: generateId('notif'),
        userId: booking.customerId,
        userType: 'customer',
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: cancelledBy === 'customer' 
          ? `Your booking has been cancelled. ${booking.refund?.eligible ? `Refund of ₹${booking.refund.amount} will be processed.` : ''}`
          : `Your booking was cancelled by the vendor. Full refund of ₹${booking.totalAmount} will be processed.`,
        bookingId: booking.id,
        read: false,
        createdAt: new Date().toISOString()
      };

      const vendorNotif = {
        id: generateId('notif'),
        userId: booking.vendorId,
        userType: 'vendor',
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: cancelledBy === 'customer'
          ? `Customer cancelled booking for ${new Date(booking.scheduledDate).toLocaleDateString()}`
          : 'You cancelled this booking',
        bookingId: booking.id,
        read: false,
        createdAt: new Date().toISOString()
      };

      // Save notifications
      const customerNotifs = await kv.get(`notifications:${booking.customerId}`) || [];
      customerNotifs.unshift(customerNotif);
      await kv.set(`notifications:${booking.customerId}`, customerNotifs);

      const vendorNotifs = await kv.get(`notifications:${booking.vendorId}`) || [];
      vendorNotifs.unshift(vendorNotif);
      await kv.set(`notifications:${booking.vendorId}`, vendorNotifs);

      console.log(`📧 [NOTIFICATION] Cancellation notifications sent for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending cancellation notifications:', error);
    }
  }

  async function sendRescheduleNotifications(booking: any) {
    try {
      const vendorNotif = {
        id: generateId('notif'),
        userId: booking.vendorId,
        userType: 'vendor',
        type: 'booking_rescheduled',
        title: 'Booking Rescheduled',
        message: `Customer rescheduled to ${new Date(booking.scheduledDate).toLocaleDateString()} at ${booking.scheduledTime}`,
        bookingId: booking.id,
        read: false,
        createdAt: new Date().toISOString()
      };

      const vendorNotifs = await kv.get(`notifications:${booking.vendorId}`) || [];
      vendorNotifs.unshift(vendorNotif);
      await kv.set(`notifications:${booking.vendorId}`, vendorNotifs);

      const customerNotif = {
        id: generateId('notif'),
        userId: booking.customerId,
        userType: 'customer',
        type: 'booking_rescheduled',
        title: 'Booking Rescheduled',
        message: `Your booking has been rescheduled to ${new Date(booking.scheduledDate).toLocaleDateString()} at ${booking.scheduledTime}`,
        bookingId: booking.id,
        read: false,
        createdAt: new Date().toISOString()
      };

      const customerNotifs = await kv.get(`notifications:${booking.customerId}`) || [];
      customerNotifs.unshift(customerNotif);
      await kv.set(`notifications:${booking.customerId}`, customerNotifs);

      console.log(`📧 [NOTIFICATION] Reschedule notifications sent for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending reschedule notifications:', error);
    }
  }

  async function sendBookingConfirmationNotification(booking: any) {
    try {
      const notification = {
        id: generateId('notif'),
        userId: booking.customerId,
        userType: 'customer',
        type: 'booking_confirmed',
        title: 'Booking Confirmed! 🎉',
        message: `Your booking for ${new Date(booking.scheduledDate).toLocaleDateString()} has been confirmed by the vendor.`,
        bookingId: booking.id,
        read: false,
        priority: 'high',
        createdAt: new Date().toISOString()
      };

      const notifications = await kv.get(`notifications:${booking.customerId}`) || [];
      notifications.unshift(notification);
      await kv.set(`notifications:${booking.customerId}`, notifications);

      console.log(`📧 [NOTIFICATION] Confirmation sent to customer for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending confirmation:', error);
    }
  }

  async function sendBookingDeclinedNotification(booking: any) {
    try {
      const notification = {
        id: generateId('notif'),
        userId: booking.customerId,
        userType: 'customer',
        type: 'booking_declined',
        title: 'Booking Declined',
        message: `Your booking request was declined. ${booking.declineReason || ''} Full refund of ₹${booking.refund?.amount} will be processed.`,
        bookingId: booking.id,
        read: false,
        priority: 'high',
        createdAt: new Date().toISOString()
      };

      const notifications = await kv.get(`notifications:${booking.customerId}`) || [];
      notifications.unshift(notification);
      await kv.set(`notifications:${booking.customerId}`, notifications);

      console.log(`📧 [NOTIFICATION] Decline notification sent to customer for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending decline notification:', error);
    }
  }
}