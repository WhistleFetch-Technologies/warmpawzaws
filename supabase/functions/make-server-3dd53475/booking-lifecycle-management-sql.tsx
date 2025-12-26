/**
 * ============================================================================
 * BOOKING LIFECYCLE MANAGEMENT - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL
 * KV Operations Removed: 41
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { generateId } from './database-schema.tsx';
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getDbClient } from "../../lib/db.ts";

/**
 * SQL-ONLY Booking Lifecycle Management
 * 
 * ❌ NO KV USAGE - All operations use SQL repositories
 */
export function registerBookingLifecycleManagement(app: Hono) {
  const BASE = '/make-server-3dd53475';
  const bookingsRepo = getBookingsRepository();
  const vendorsRepo = getVendorsRepository();
  const notificationsRepo = getNotificationsRepository();
  const db = getDbClient();

  // Helper: Get booking by ID (handles both UUID and string booking_id)
  async function getBookingById(bookingId: string) {
    // Try UUID first
    let booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      // Try string booking_id
      booking = await bookingsRepo.findByBookingId(bookingId);
    }
    return booking;
  }

  // Helper: Get platform settings
  async function getPlatformSettings(key: string): Promise<any> {
    try {
      const { data } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', key)
        .maybeSingle();
      return data?.setting_value || {};
    } catch (error) {
      console.error(`[SETTINGS] Error fetching platform setting ${key}:`, error);
      return {};
    }
  }

  // Helper: Get vendor settings (from platform_settings or default)
  async function getVendorSettings(vendorId: string): Promise<any> {
    try {
      const { data } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `vendor:${vendorId}:settings`)
        .maybeSingle();
      return data?.setting_value || {};
    } catch (error) {
      return {};
    }
  }

  // Helper: Get staff schedules
  async function getStaffSchedules(vendorId: string, staffId?: string): Promise<any[]> {
    try {
      let query = db
        .from('staff_schedules')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true);
      
      if (staffId) {
        query = query.eq('staff_id', staffId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[SCHEDULE] Error fetching staff schedules:', error);
      return [];
    }
  }

  // =============================================
  // GET REFUND ELIGIBILITY
  // =============================================
  app.get(`${BASE}/bookings/:bookingId/refund-eligibility`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      const booking = await getBookingById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Get vendor's refund policy
      const vendor = await vendorsRepo.findById(booking.vendor_id || '');
      const vendorSettings = await getVendorSettings(booking.vendor_id || '');
      
      // Get platform refund settings
      const platformSettings = await getPlatformSettings('platform:settings:refund_policies');

      // Calculate time until booking
      const now = new Date();
      const scheduledDate = booking.scheduled_date || booking.booking_date || '';
      const scheduledTime = booking.scheduled_time || booking.booking_time || '00:00';
      const bookingDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Determine refund percentage based on cancellation time
      let refundPercentage = 0;
      let cancellationFee = 0;
      const totalAmount = booking.total_amount || booking.base_price || 0;

      if (booking.status === 'in_progress' || booking.status === 'completed') {
        refundPercentage = 0;
        cancellationFee = totalAmount;
      } else if (hoursUntil >= 24) {
        // More than 24 hours: Full refund
        refundPercentage = 100;
        cancellationFee = 0;
      } else if (hoursUntil >= 12) {
        // 12-24 hours: 75% refund
        refundPercentage = 75;
        cancellationFee = totalAmount * 0.25;
      } else if (hoursUntil >= 6) {
        // 6-12 hours: 50% refund
        refundPercentage = 50;
        cancellationFee = totalAmount * 0.50;
      } else if (hoursUntil >= 2) {
        // 2-6 hours: 25% refund
        refundPercentage = 25;
        cancellationFee = totalAmount * 0.75;
      } else {
        // Less than 2 hours: No refund
        refundPercentage = 0;
        cancellationFee = totalAmount;
      }

      const refundAmount = (totalAmount * refundPercentage) / 100;

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

      const booking = await getBookingById(bookingId);
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
      const scheduledDate = booking.scheduled_date || booking.booking_date || '';
      const scheduledTime = booking.scheduled_time || booking.booking_time || '00:00';
      const bookingDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      const hoursUntil = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      let refundPercentage = 0;
      if (hoursUntil >= 24) refundPercentage = 100;
      else if (hoursUntil >= 12) refundPercentage = 75;
      else if (hoursUntil >= 6) refundPercentage = 50;
      else if (hoursUntil >= 2) refundPercentage = 25;

      const totalAmount = booking.total_amount || booking.base_price || 0;
      const refundAmount = (totalAmount * refundPercentage) / 100;
      const cancellationFee = totalAmount - refundAmount;

      // Prepare refund data (stored in notes or separate refunds table)
      const refundData = {
        eligible: refundPercentage > 0,
        percentage: refundPercentage,
        amount: refundAmount,
        cancellationFee,
        status: refundAmount > 0 ? 'pending' : 'not_applicable',
        processedAt: null
      };

      // Update booking
      const updatedBooking = await bookingsRepo.update(booking.id, {
        status: 'cancelled',
        cancellation_reason: reason || '',
        cancelled_at: new Date().toISOString(),
        notes: JSON.stringify({
          ...(booking.notes ? JSON.parse(booking.notes) : {}),
          refund: refundData,
          cancelledBy: userType
        })
      });

      // If refund eligible, initiate refund process
      if (refundAmount > 0) {
        console.log(`💰 [REFUND] Processing refund of ₹${refundAmount} for booking ${bookingId}`);
        
        // Get refund method preference (wallet or original payment method)
        let refundToWallet = true; // Default to wallet
        
        if (refundToWallet) {
          // ✅ Credit to wallet
          try {
            const walletCreditResponse = await fetch(
              `https://${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-3dd53475/wallet/${booking.customer_id}/credit`,
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
              refundData.method = 'wallet';
              refundData.walletTransactionId = walletData.transaction?.id;
              refundData.status = 'completed';
              refundData.processedAt = new Date().toISOString();
              console.log(`✅ [REFUND] Credited ₹${refundAmount} to wallet for customer ${booking.customer_id}`);
            } else {
              console.error('[REFUND] Failed to credit wallet, falling back to Razorpay');
              refundToWallet = false;
            }
          } catch (error) {
            console.error('[REFUND] Error crediting wallet:', error);
            refundToWallet = false;
          }
        }
        
        // If wallet credit failed or not preferred, use Razorpay refund
        if (!refundToWallet && booking.payment_id) {
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
              const refundDataFromApi = await refundResponse.json();
              refundData.razorpayRefundId = refundDataFromApi.refundId;
              refundData.method = 'razorpay';
              refundData.status = 'processing';
              console.log(`✅ [REFUND] Razorpay refund initiated: ${refundDataFromApi.refundId}`);
            } else {
              console.error('[REFUND] Failed to initiate Razorpay refund');
              refundData.status = 'failed';
            }
          } catch (error) {
            console.error('[REFUND] Error calling refund API:', error);
            refundData.status = 'failed';
          }
        }
      }

      // Send notifications
      await sendCancellationNotifications(updatedBooking, userType);

      return c.json({
        success: true,
        booking: updatedBooking,
        refund: refundData,
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

      const booking = await getBookingById(bookingId);
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

      // Store original schedule in notes
      const existingNotes = booking.notes ? JSON.parse(booking.notes) : {};
      const rescheduleHistory = existingNotes.rescheduleHistory || [];
      const scheduledDate = booking.scheduled_date || booking.booking_date || '';
      const scheduledTime = booking.scheduled_time || booking.booking_time || '';

      rescheduleHistory.push({
        oldDate: scheduledDate,
        oldTime: scheduledTime,
        newDate,
        newTime,
        reason: reason || '',
        rescheduledAt: new Date().toISOString()
      });

      // Update booking
      const updatedBooking = await bookingsRepo.update(booking.id, {
        status: 'rescheduled',
        scheduled_date: newDate,
        scheduled_time: newTime,
        notes: JSON.stringify({
          ...existingNotes,
          rescheduleHistory
        })
      });

      // Send notifications
      await sendRescheduleNotifications(updatedBooking);

      return c.json({
        success: true,
        booking: updatedBooking,
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

      const booking = await getBookingById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      if (booking.status !== 'pending' && booking.status !== 'confirmed') {
        return c.json({ error: 'Booking already processed' }, 400);
      }

      // Update booking
      const updateData: any = {
        status: 'confirmed',
        notes: JSON.stringify({
          ...(booking.notes ? JSON.parse(booking.notes) : {}),
          vendorNotes: notes || '',
          acceptedAt: new Date().toISOString()
        })
      };

      if (staffId) {
        updateData.staff_id = staffId;
      }

      const updatedBooking = await bookingsRepo.update(booking.id, updateData);

      // Send confirmation notification to customer
      await sendBookingConfirmationNotification(updatedBooking);

      return c.json({
        success: true,
        booking: updatedBooking,
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

      const booking = await getBookingById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.vendor_id !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      const totalAmount = booking.total_amount || booking.base_price || 0;

      // Full refund on vendor decline
      const refundData = {
        eligible: true,
        percentage: 100,
        amount: totalAmount,
        cancellationFee: 0,
        status: 'pending',
        processedAt: null
      };

      // Update booking
      const updatedBooking = await bookingsRepo.update(booking.id, {
        status: 'declined',
        cancellation_reason: reason || '',
        cancelled_at: new Date().toISOString(),
        notes: JSON.stringify({
          ...(booking.notes ? JSON.parse(booking.notes) : {}),
          declineReason: reason || '',
          suggestedAlternative: suggestAlternative || null,
          declinedAt: new Date().toISOString(),
          refund: refundData
        })
      });

      // Initiate refund
      console.log(`💰 [REFUND] Vendor declined - Full refund of ₹${refundData.amount}`);

      // Send notification to customer
      await sendBookingDeclinedNotification(updatedBooking);

      return c.json({
        success: true,
        booking: updatedBooking,
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

      const booking = await getBookingById(bookingId);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Get staff schedule
      const schedules = await getStaffSchedules(booking.vendor_id || '', booking.staff_id || '');
      const staffSchedule = schedules.find((s: any) => 
        s.staff_id === booking.staff_id && s.is_active
      );

      if (!staffSchedule) {
        return c.json({ error: 'Staff schedule not found' }, 404);
      }

      // Get all bookings for this staff on the date
      const vendorBookings = await bookingsRepo.findByVendor(booking.vendor_id || '', {
        date: date || '',
        status: undefined // Get all non-cancelled
      });

      const dateBookings = vendorBookings.filter(b => {
        const bookingDate = b.scheduled_date || b.booking_date || '';
        return bookingDate === date && 
               b.staff_id === booking.staff_id && 
               b.status !== 'cancelled';
      });

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
    const vendorBookings = await bookingsRepo.findByVendor(vendorId, {
      date,
      status: undefined
    });
    
    for (const booking of vendorBookings) {
      if (
        booking.staff_id === staffId &&
        (booking.scheduled_date || booking.booking_date) === date &&
        booking.status !== 'cancelled'
      ) {
        // Check if times overlap
        const bookingTime = booking.scheduled_time || booking.booking_time || '';
        if (bookingTime === time) {
          return false;
        }
      }
    }
    
    return true;
  }

  function generateAvailableSlots(schedule: any, existingBookings: any[], duration: number) {
    const slots = [];
    const startTime = schedule.start_time || schedule.startTime || '09:00';
    const endTime = schedule.end_time || schedule.endTime || '18:00';
    
    // Simple slot generation (can be enhanced)
    const [startHour] = startTime.split(':').map(Number);
    const [endHour] = endTime.split(':').map(Number);
    
    for (let hour = startHour; hour < endHour; hour++) {
      const slot = `${hour.toString().padStart(2, '0')}:00`;
      
      // Check if slot is occupied
      const isOccupied = existingBookings.some(b => {
        const bookingTime = b.scheduled_time || b.booking_time || '';
        return bookingTime === slot;
      });
      
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
    try {
      const scheduledDate = booking.scheduled_date || booking.booking_date || '';
      const totalAmount = booking.total_amount || booking.base_price || 0;
      const notes = booking.notes ? JSON.parse(booking.notes) : {};
      const refund = notes.refund || {};

      // Customer notification
      await notificationsRepo.create({
        user_id: booking.customer_id,
        notification_type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: cancelledBy === 'customer' 
          ? `Your booking has been cancelled. ${refund.eligible ? `Refund of ₹${refund.amount} will be processed.` : ''}`
          : `Your booking was cancelled by the vendor. Full refund of ₹${totalAmount} will be processed.`,
        data: {
          bookingId: booking.id,
          cancelledBy
        }
      });

      // Vendor notification
      await notificationsRepo.create({
        user_id: booking.vendor_id || '',
        notification_type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: cancelledBy === 'customer'
          ? `Customer cancelled booking for ${new Date(scheduledDate).toLocaleDateString()}`
          : 'You cancelled this booking',
        data: {
          bookingId: booking.id,
          cancelledBy
        }
      });

      console.log(`📧 [NOTIFICATION] Cancellation notifications sent for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending cancellation notifications:', error);
    }
  }

  async function sendRescheduleNotifications(booking: any) {
    try {
      const scheduledDate = booking.scheduled_date || booking.booking_date || '';
      const scheduledTime = booking.scheduled_time || booking.booking_time || '';

      // Vendor notification
      await notificationsRepo.create({
        user_id: booking.vendor_id || '',
        notification_type: 'booking_rescheduled',
        title: 'Booking Rescheduled',
        message: `Customer rescheduled to ${new Date(scheduledDate).toLocaleDateString()} at ${scheduledTime}`,
        data: {
          bookingId: booking.id
        }
      });

      // Customer notification
      await notificationsRepo.create({
        user_id: booking.customer_id,
        notification_type: 'booking_rescheduled',
        title: 'Booking Rescheduled',
        message: `Your booking has been rescheduled to ${new Date(scheduledDate).toLocaleDateString()} at ${scheduledTime}`,
        data: {
          bookingId: booking.id
        }
      });

      console.log(`📧 [NOTIFICATION] Reschedule notifications sent for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending reschedule notifications:', error);
    }
  }

  async function sendBookingConfirmationNotification(booking: any) {
    try {
      const scheduledDate = booking.scheduled_date || booking.booking_date || '';

      await notificationsRepo.create({
        user_id: booking.customer_id,
        notification_type: 'booking_confirmed',
        title: 'Booking Confirmed! 🎉',
        message: `Your booking for ${new Date(scheduledDate).toLocaleDateString()} has been confirmed by the vendor.`,
        data: {
          bookingId: booking.id
        }
      });

      console.log(`📧 [NOTIFICATION] Confirmation sent to customer for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending confirmation:', error);
    }
  }

  async function sendBookingDeclinedNotification(booking: any) {
    try {
      const notes = booking.notes ? JSON.parse(booking.notes) : {};
      const refund = notes.refund || {};
      const declineReason = notes.declineReason || '';

      await notificationsRepo.create({
        user_id: booking.customer_id,
        notification_type: 'booking_declined',
        title: 'Booking Declined',
        message: `Your booking request was declined. ${declineReason} Full refund of ₹${refund.amount} will be processed.`,
        data: {
          bookingId: booking.id
        }
      });

      console.log(`📧 [NOTIFICATION] Decline notification sent to customer for booking ${booking.id}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error sending decline notification:', error);
    }
  }
}

