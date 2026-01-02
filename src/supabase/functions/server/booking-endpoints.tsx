import { Hono } from "hono";
import { createNotificationHelper } from "./notification-system";
// ✅ SQL MIGRATION: Replace KV with SQL repositories
import { getBookingsRepository } from "../../../supabase/lib/repositories/bookings";
import { getVendorsRepository } from "../../../supabase/lib/repositories/vendors";
import { getCustomersRepository } from "../../../supabase/lib/repositories/customers";
import { getStaffRepository } from "../../../supabase/lib/repositories/staff";
import { getPetsRepository } from "../../../supabase/lib/repositories/pets";

export function bookingEndpoints(app: Hono) {
  
  // ✅ FIX: Use existing notification system (no duplicate code) - MIGRATED TO SQL
  // Helper: Trigger Notification using existing infrastructure
  async function triggerNotification(notification: any) {
    try {
      // Use existing createNotificationHelper which handles AWS SNS integration
      await createNotificationHelper({
        ...notification,
        channels: notification.channels || { email: true, sms: true, inApp: true, push: false }
      });
      
      console.log(`📨 Notification sent via existing system for ${notification.recipientType}:${notification.recipientId}`);
    } catch (e) {
      console.error('Failed to trigger notification:', e);
    }
  }

  // ============================================
  // CUSTOMER BOOKING ENDPOINTS
  // ============================================
  
  /**
   * Create a new booking
   * POST /make-server-3dd53475/bookings/create
   */
  app.post("/make-server-3dd53475/bookings/create", async (c) => {
    try {
      const {
        customerId,
        vendorId,
        petId,
        serviceId,
        serviceName,
        serviceType,
        bookingDate,
        bookingTime,
        duration,
        price,
        customerName,
        customerPhone,
        customerAddress,
        petName,
        petBreed,
        petAge,
        numberOfPax,
        specialInstructions,
        paymentMethod,
        // Phase 2: Resort & Boarding Fields
        checkInDate,
        checkOutDate,
        bookingType, // 'appointment', 'stay', 'reservation'
        // Phase 2: Cafe Fields
        tableId,
        partyPackageId
      } = await c.req.json();

      // Validate required fields
      if (!customerId || !vendorId || !serviceId) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Phase 2: Validation for Stays (Resort/Boarding)
      let calculatedDuration = duration || 60;
      let stayNights = 0;

      if (checkInDate && checkOutDate) {
        const start = new Date(checkInDate);
        const end = new Date(checkOutDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        stayNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (stayNights < 1) stayNights = 1; // Minimum 1 night
      }

      // Generate booking ID
      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // ✅ INTEGRATION: Auto-assign staff for solo providers
      let assignedStaffId = null;
      let autoAssigned = false;
      
      // ✅ SQL: Get vendor to check if solo provider
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      
      // Note: Solo provider check should be based on vendor role_id or capability
      // For now, check if vendor has staff and auto-assign first staff member
      const staffRepo = getStaffRepository();
      const staffList = await staffRepo.findByVendorId(vendorId);
      if (staffList && staffList.length > 0) {
        assignedStaffId = staffList[0].id;
        autoAssigned = true;
        console.log(`   ✅ Auto-assigned to staff: ${assignedStaffId}`);
      }

      // ✅ SQL: Create booking using repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.create({
        customer_id: customerId,
        vendor_id: vendorId,
        staff_id: assignedStaffId || undefined,
        service_id: serviceId,
        booking_date: bookingDate || checkInDate || new Date().toISOString().split('T')[0],
        booking_time: bookingTime || '12:00',
        service_type: serviceType,
        address: customerAddress || undefined,
        base_price: price || 0,
        total_amount: price || 0,
        notes: specialInstructions || undefined,
      });

      // TRIGGER NOTIFICATIONS
      // 1. Notify Vendor
      await triggerNotification({
        recipientId: vendorId,
        recipientType: 'vendor',
        type: 'booking_created',
        category: 'bookings',
        title: 'New Booking Request',
        message: `New booking request from ${customerName} for ${serviceName} on ${booking.booking_date} at ${booking.booking_time}`,
        data: { bookingId: booking.id, serviceName, customerName, bookingDate: booking.booking_date, bookingTime: booking.booking_time },
        priority: 'high'
      });

      // 2. Notify Customer
      await triggerNotification({
        recipientId: customerId,
        recipientType: 'customer',
        type: 'booking_created',
        category: 'bookings',
        title: 'Booking Requested',
        message: `Your booking for ${serviceName} is pending confirmation.`,
        data: { bookingId: booking.id, serviceName, vendorId },
        priority: 'medium'
      });

      console.log(`✅ Booking created: ${booking.id}`);
      return c.json({ success: true, bookingId: booking.id, booking });
    } catch (error) {
      console.error('Error creating booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get booking details
   * GET /make-server-3dd53475/bookings/:bookingId
   */
  app.get("/make-server-3dd53475/bookings/:bookingId", async (c) => {
    try {
      const { bookingId } = c.req.param();
      
      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      return c.json({ booking });
    } catch (error) {
      console.error('Error getting booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get customer's bookings
   * GET /make-server-3dd53475/bookings/customer/:customerId
   */
  app.get("/make-server-3dd53475/bookings/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();
      const status = c.req.query('status'); // optional filter
      
      // ✅ SQL: Get bookings by customer from repository
      const bookingsRepo = getBookingsRepository();
      const bookings = await bookingsRepo.findByCustomer(customerId, {
        status: status || undefined,
      });
      
      return c.json({ bookings, total: bookings.length });
    } catch (error) {
      console.error('Error getting customer bookings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get vendor's bookings
   * GET /make-server-3dd53475/bookings/vendor/:vendorId
   */
  app.get("/make-server-3dd53475/bookings/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status'); // optional filter
      
      // ✅ SQL: Get bookings by vendor from repository
      const bookingsRepo = getBookingsRepository();
      const bookings = await bookingsRepo.findByVendor(vendorId, {
        status: status || undefined,
      });
      
      return c.json({ bookings, total: bookings.length });
    } catch (error) {
      console.error('Error getting vendor bookings:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Update booking status (Vendor)
   * POST /make-server-3dd53475/bookings/:bookingId/status
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/status", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { status, note, updatedBy } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Valid status transitions
      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }

      // ✅ SQL: Update booking status
      const updateData: any = {
        status,
        notes: note ? (booking.notes ? `${booking.notes}\n${note}` : note) : booking.notes,
      };
      
      // Phase 2: Auto-Start GPS if status is in_progress
      if (status === 'in_progress') {
         // Check if this service requires tracking
         // ✅ SQL: Get vendor to check tracking role
         const vendorsRepo = getVendorsRepository();
         const vendor = booking.vendor_id ? await vendorsRepo.findById(booking.vendor_id) : null;
         
         // Note: GPS tracking should be handled via GPS tracking service/repository
         // For now, just log that tracking should start
         if (vendor) {
           console.log(`📍 GPS tracking should start for booking ${bookingId} (vendor: ${booking.vendor_id})`);
         }
      }

      // Special handling for completed bookings
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        
        // ✅ SQL: Vendor stats should be updated via analytics/reporting service
        // Note: Vendor booking counts are calculated from bookings table, not stored separately

        // ✅ LOYALTY INTEGRATION: Award points for completed booking
        try {
          console.log(`[LOYALTY] Triggering points for completed booking ${bookingId}`);
          
          // Determine action key based on service type
          let actionKey = 'book_grooming'; // default
          const serviceType = booking.service_type?.toLowerCase() || '';
          
          if (serviceType.includes('vet') || serviceType.includes('consultation')) {
            actionKey = 'book_vet';
          } else if (serviceType.includes('food') || serviceType.includes('nutrition')) {
            actionKey = 'buy_food';
          } else if (serviceType.includes('groom')) {
            actionKey = 'book_grooming';
          }

          // Award loyalty points
          const loyaltyResponse = await fetch(
            `http://localhost:54321/functions/v1/make-server-3dd53475/loyalty/process-action`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: booking.customer_id,
                userType: 'customer',
                actionKey,
                amount: booking.total_amount || 0,
                metadata: { bookingId, serviceType: booking.service_type }
              })
            }
          ).catch(err => {
            console.error('[LOYALTY] Failed to award points:', err);
            return null;
          });

          if (loyaltyResponse?.ok) {
            const data = await loyaltyResponse.json();
            console.log(`✅ [LOYALTY] Awarded ${data.pointsAwarded} points to customer ${booking.customer_id}`);
          }
        } catch (loyaltyErr) {
          console.error('[LOYALTY] Error processing loyalty points:', loyaltyErr);
          // Non-blocking: Continue with booking completion even if loyalty fails
        }
      }

      // ✅ SQL: Update booking
      const updatedBooking = await bookingsRepo.update(bookingId, updateData);

      // Notify Customer of status change
      if (status !== 'pending') { // Don't notify on initial pending state if avoiding duplicates
        await triggerNotification({
          recipientId: booking.customer_id,
          recipientType: 'customer',
          type: 'booking_status_change', // Generic type, handled by frontend/notification system
          category: 'bookings',
          title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `Your booking is now ${status}. ${note || ''}`,
          data: { bookingId, status, note },
          priority: 'medium'
        });
      }

      console.log(`✅ Booking ${bookingId} status updated to ${status}`);
      return c.json({ success: true, booking: updatedBooking });
    } catch (error) {
      console.error('Error updating booking status:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Cancel booking
   * POST /make-server-3dd53475/bookings/:bookingId/cancel
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/cancel", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { reason, cancelledBy, refundAmount } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return c.json({ error: 'Cannot cancel this booking' }, 400);
      }

      // ✅ SQL: Cancel booking
      const cancelledBooking = await bookingsRepo.cancel(bookingId, reason);

      // Notify other party
      const recipientType = cancelledBy === booking.customer_id ? 'vendor' : 'customer';
      const recipientId = cancelledBy === booking.customer_id ? (booking.vendor_id || '') : booking.customer_id;
      
      await triggerNotification({
        recipientId,
        recipientType,
        type: 'booking_cancelled',
        category: 'bookings',
        title: 'Booking Cancelled',
        message: `Booking has been cancelled. Reason: ${reason}`,
        data: { bookingId, reason },
        priority: 'high'
      });

      console.log(`✅ Booking ${bookingId} cancelled`);
      return c.json({ success: true, booking: cancelledBooking });
    } catch (error) {
      console.error('Error cancelling booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Reschedule booking
   * POST /make-server-3dd53475/bookings/:bookingId/reschedule
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/reschedule", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { newDate, newTime, reason } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return c.json({ error: 'Cannot reschedule this booking' }, 400);
      }

      // ✅ SQL: Reschedule booking
      const rescheduledBooking = await bookingsRepo.reschedule(bookingId, newDate, newTime);

      console.log(`✅ Booking ${bookingId} rescheduled`);
      return c.json({ success: true, booking: rescheduledBooking });
    } catch (error) {
      console.error('Error rescheduling booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get booking statistics for vendor
   * GET /make-server-3dd53475/bookings/vendor/:vendorId/stats
   */
  app.get("/make-server-3dd53475/bookings/vendor/:vendorId/stats", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get all bookings for vendor
      const bookingsRepo = getBookingsRepository();
      const bookings = await bookingsRepo.findByVendor(vendorId);
      
      let pending = 0, confirmed = 0, completed = 0, cancelled = 0;
      let totalRevenue = 0;
      
      for (const booking of bookings) {
        switch (booking.status) {
          case 'pending': pending++; break;
          case 'confirmed': confirmed++; break;
          case 'completed': 
            completed++; 
            totalRevenue += booking.total_amount || 0;
            break;
          case 'cancelled': cancelled++; break;
        }
      }
      
      return c.json({ 
        stats: {
          total: bookings.length,
          pending,
          confirmed,
          completed,
          cancelled,
          totalRevenue
        }
      });
    } catch (error) {
      console.error('Error getting booking stats:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Accept booking (Vendor confirms)
   * POST /make-server-3dd53475/bookings/:bookingId/accept
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/accept", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, note } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status !== 'pending') {
        return c.json({ error: 'Booking is not in pending status' }, 400);
      }

      // ✅ SQL: Confirm booking
      const confirmedBooking = await bookingsRepo.confirm(bookingId);

      // ✅ NOTIFICATION: Booking Accepted - Use existing notification system
      try {
        const customersRepo = getCustomersRepository();
        const vendorsRepo = getVendorsRepository();
        const customer = booking.customer_id ? await customersRepo.findById(booking.customer_id) : null;
        const vendor = vendorId ? await vendorsRepo.findById(vendorId) : null;
        const startOTP = booking.otp_start_code || null;

        await createNotificationHelper({
          recipientId: booking.customer_id,
          recipientType: 'customer',
          type: 'booking_confirmed',
          category: 'bookings',
          title: 'Booking Confirmed!',
          message: `Your booking on ${confirmedBooking.booking_date} at ${confirmedBooking.booking_time} has been confirmed!${startOTP ? ` Start OTP: ${startOTP}` : ''}`,
          recipientEmail: customer?.email || undefined,
          recipientPhone: customer?.phone,
          channels: { email: true, sms: true, inApp: true, push: false },
          data: { bookingId, bookingDate: confirmedBooking.booking_date, bookingTime: confirmedBooking.booking_time, vendorName: vendor?.business_name, startOTP },
          priority: 'high'
        });

        console.log(`📱 [NOTIFICATION] Booking accepted notification sent to customer`);
      } catch (notifError) {
        console.error(`⚠️ [NOTIFICATION] Failed to send booking accepted notification:`, notifError);
        // Don't fail the request if notification fails
      }

      console.log(`✅ Booking ${bookingId} accepted by vendor`);
      return c.json({ success: true, booking: confirmedBooking });
    } catch (error) {
      console.error('Error accepting booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Reject booking (Vendor declines)
   * POST /make-server-3dd53475/bookings/:bookingId/reject
   */
  app.post("/make-server-3dd53475/bookings/:bookingId/reject", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, reason } = await c.req.json();

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status !== 'pending') {
        return c.json({ error: 'Booking is not in pending status' }, 400);
      }

      // ✅ SQL: Cancel booking with reason
      const cancelledBooking = await bookingsRepo.cancel(bookingId, reason || 'Rejected by vendor');

      // Notify Customer
      await triggerNotification({
        recipientId: booking.customer_id,
        recipientType: 'customer',
        type: 'booking_cancelled',
        category: 'bookings',
        title: 'Booking Declined',
        message: `Your booking was declined. Reason: ${reason}`,
        data: { bookingId, reason },
        priority: 'high'
      });

      console.log(`✅ Booking ${bookingId} rejected by vendor`);
      return c.json({ success: true, booking: cancelledBooking });
    } catch (error) {
      console.error('Error rejecting booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Booking endpoints registered');
}