import { Hono } from "npm:hono";

export function bookingEndpoints(app: Hono, kv: any) {
  
  // Helper: Trigger Notification
  async function triggerNotification(notification: any) {
    try {
      const notificationId = `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const fullNotification = {
        id: notificationId,
        ...notification,
        status: 'pending',
        createdAt: new Date().toISOString(),
        channels: notification.channels || { email: true, sms: true, inApp: true, push: true }
      };
      
      // Save notification
      await kv.set(`notification:${notificationId}`, fullNotification);
      
      // Add to recipient list
      const recipientNotifs = await kv.get(`notifications:${notification.recipientType}:${notification.recipientId}`) || [];
      recipientNotifs.unshift(notificationId);
      await kv.set(`notifications:${notification.recipientType}:${notification.recipientId}`, recipientNotifs);
      
      console.log(`📨 Notification queued: ${notificationId} for ${notification.recipientType}:${notification.recipientId}`);
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
      
      // Get vendor to check if solo provider
      const vendor = await kv.get(`vendor:${vendorId}`);
      
      if (vendor?.isSoloProvider) {
        console.log(`   🔄 Solo provider detected - auto-assigning staff...`);
        const staffRecords = await kv.get(`vendor:${vendorId}:staff`);
        if (staffRecords && staffRecords.length > 0) {
          assignedStaffId = staffRecords[0];
          autoAssigned = true;
          console.log(`   ✅ Auto-assigned to solo provider staff: ${assignedStaffId}`);
        }
      }
      // TODO: Add multi-staff assignment logic here for non-solo providers

      // Create booking object
      const booking = {
        id: bookingId,
        customerId,
        vendorId,
        staffId: assignedStaffId, // ✅ INTEGRATION: Staff assignment
        autoAssigned, // ✅ INTEGRATION: Track if auto-assigned
        petId: petId || null,
        serviceId,
        serviceName,
        serviceType,
        
        // Standard Appointment
        bookingDate: bookingDate || checkInDate,
        bookingTime: bookingTime || '12:00', // Default for stays
        duration: calculatedDuration,
        
        // Stay Details
        bookingType: bookingType || (checkInDate ? 'stay' : 'appointment'),
        checkInDate: checkInDate || null,
        checkOutDate: checkOutDate || null,
        nights: stayNights,
        
        price,
        status: 'pending', // pending, confirmed, in_progress, completed, cancelled
        paymentStatus: 'pending', // pending, paid, refunded
        paymentMethod: paymentMethod || 'cash',
        
        // Customer details
        customerName,
        customerPhone,
        customerAddress,
        
        // Pet details
        petName: petName || null,
        petBreed: petBreed || null,
        petAge: petAge || null,
        
        // Cafe-specific: Number of people (pax)
        numberOfPax: numberOfPax || 1,
        tableId: tableId || null,
        partyPackageId: partyPackageId || null,
        
        // Additional info
        specialInstructions: specialInstructions || '',
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // Tracking
        statusHistory: [{
          status: 'pending',
          timestamp: new Date().toISOString(),
          note: 'Booking created'
        }]
      };

      // Save booking
      await kv.set(`booking:${bookingId}`, booking);

      // Add to customer's bookings
      const customerBookingsKey = `customer:${customerId}:bookings`;
      const customerBookings = await kv.get(customerBookingsKey) || [];
      customerBookings.unshift(bookingId);
      await kv.set(customerBookingsKey, customerBookings);

      // Add to vendor's bookings
      const vendorBookingsKey = `vendor:${vendorId}:bookings`;
      const vendorBookings = await kv.get(vendorBookingsKey) || [];
      vendorBookings.unshift(bookingId);
      await kv.set(vendorBookingsKey, vendorBookings);

      // Add to pet's bookings if petId exists
      if (petId) {
        const petBookingsKey = `pet:${petId}:bookings`;
        const petBookings = await kv.get(petBookingsKey) || [];
        petBookings.unshift(bookingId);
        await kv.set(petBookingsKey, petBookings);
      }

      // TRIGGER NOTIFICATIONS
      // 1. Notify Vendor
      await triggerNotification({
        recipientId: vendorId,
        recipientType: 'vendor',
        type: 'booking_created',
        category: 'bookings',
        title: 'New Booking Request',
        message: `New booking request from ${customerName} for ${serviceName} on ${bookingDate} at ${bookingTime}`,
        data: { bookingId, serviceName, customerName, bookingDate, bookingTime },
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
        data: { bookingId, serviceName, vendorId },
        priority: 'medium'
      });

      console.log(`✅ Booking created: ${bookingId}`);
      return c.json({ success: true, bookingId, booking });
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
      
      const booking = await kv.get(`booking:${bookingId}`);
      
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
      
      const bookingIds = await kv.get(`customer:${customerId}:bookings`) || [];
      
      const bookings = [];
      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking) {
          if (!status || booking.status === status) {
            bookings.push(booking);
          }
        }
      }
      
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
      
      const bookingIds = await kv.get(`vendor:${vendorId}:bookings`) || [];
      
      const bookings = [];
      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking) {
          if (!status || booking.status === status) {
            bookings.push(booking);
          }
        }
      }
      
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

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Valid status transitions
      const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return c.json({ error: 'Invalid status' }, 400);
      }

      // Update booking
      booking.status = status;
      booking.updatedAt = new Date().toISOString();
      
      // ✅ FIX: Auto-Start GPS Tracking if status is in_progress
      if (status === 'in_progress') {
         // Check if this service requires tracking
         const vendor = await kv.get(`vendor:${booking.vendorId}`);
         const serviceStyle = booking.serviceStyle || booking.serviceType;
         
         // Tracking roles: walkers, ambulance, relocation (use GPS tracking endpoints)
         const isTrackingRole = vendor && (
             vendor.role === 'pet_walker' || 
             vendor.role === 'pet_ambulance' || 
             vendor.role === 'pet_relocation'
         );
         
         // Home services: use home service tracking (staff traveling to customer)
         const isHomeService = serviceStyle === 'at_home' || serviceStyle === 'home';
         
         if (isTrackingRole) {
             // Use GPS tracking system for walkers/ambulance/relocation
             const sessionId = bookingId; // Use bookingId as sessionId
             const sessionKey = `session:tracking:${sessionId}`;
             
             // Only create if not exists
             const existingSession = await kv.get(sessionKey);
             if (!existingSession) {
                 const trackingSession = {
                    id: sessionId,
                    walkerId: booking.staffId || booking.vendorId, // Use staff if assigned, else vendor
                    bookingId: bookingId,
                    customerId: booking.customerId,
                    status: 'in_progress',
                    startTime: new Date().toISOString(),
                    currentLocation: { lat: 0, lng: 0 }, // Waiting for first update
                    route: [],
                    distance: 0,
                    lastUpdate: new Date().toISOString()
                 };
                 await kv.set(sessionKey, trackingSession);
                 booking.trackingActive = true;
                 booking.trackingSessionId = sessionId;
                 console.log(`📍 Auto-started GPS session for booking ${bookingId} (role: ${vendor.role})`);
             }
         } else if (isHomeService && booking.staffId) {
             // For home services, tracking session is created when staff starts travel
             // via /booking/:bookingId/start-travel endpoint
             // But we ensure booking is ready for tracking
             booking.trackingReady = true;
             console.log(`📍 Home service booking ${bookingId} ready for tracking (staff: ${booking.staffId})`);
         }
      }
      
      // Add to status history
      booking.statusHistory.push({
        status,
        timestamp: new Date().toISOString(),
        note: note || `Status changed to ${status}`,
        updatedBy
      });

      // Special handling for completed bookings
      if (status === 'completed') {
        booking.completedAt = new Date().toISOString();
        
        // Update vendor stats
        const vendor = await kv.get(`vendor:${booking.vendorId}`);
        if (vendor) {
          vendor.totalBookings = (vendor.totalBookings || 0) + 1;
          vendor.completedBookings = (vendor.completedBookings || 0) + 1;
          vendor.revenue = (vendor.revenue || 0) + booking.price;
          await kv.set(`vendor:${booking.vendorId}`, vendor);
        }

        // ✅ LOYALTY INTEGRATION: Award points for completed booking
        try {
          console.log(`[LOYALTY] Triggering points for completed booking ${bookingId}`);
          
          // Determine action key based on service type
          let actionKey = 'book_grooming'; // default
          const serviceType = booking.serviceType?.toLowerCase() || '';
          
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
                userId: booking.customerId,
                userType: 'customer',
                actionKey,
                amount: booking.price || 0,
                metadata: { bookingId, serviceType: booking.serviceType }
              })
            }
          ).catch(err => {
            console.error('[LOYALTY] Failed to award points:', err);
            return null;
          });

          if (loyaltyResponse?.ok) {
            const data = await loyaltyResponse.json();
            console.log(`✅ [LOYALTY] Awarded ${data.pointsAwarded} points to customer ${booking.customerId}`);
          }
        } catch (loyaltyErr) {
          console.error('[LOYALTY] Error processing loyalty points:', loyaltyErr);
          // Non-blocking: Continue with booking completion even if loyalty fails
        }
      }

      await kv.set(`booking:${bookingId}`, booking);

      // Notify Customer of status change
      if (status !== 'pending') { // Don't notify on initial pending state if avoiding duplicates
        await triggerNotification({
          recipientId: booking.customerId,
          recipientType: 'customer',
          type: 'booking_status_change', // Generic type, handled by frontend/notification system
          category: 'bookings',
          title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `Your booking for ${booking.serviceName} is now ${status}. ${note || ''}`,
          data: { bookingId, status, note },
          priority: 'medium'
        });
      }

      console.log(`✅ Booking ${bookingId} status updated to ${status}`);
      return c.json({ success: true, booking });
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

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return c.json({ error: 'Cannot cancel this booking' }, 400);
      }

      booking.status = 'cancelled';
      booking.cancelledAt = new Date().toISOString();
      booking.cancelledBy = cancelledBy;
      booking.cancellationReason = reason;
      booking.refundAmount = refundAmount || 0;
      booking.updatedAt = new Date().toISOString();

      booking.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date().toISOString(),
        note: `Cancelled: ${reason}`,
        updatedBy: cancelledBy
      });

      await kv.set(`booking:${bookingId}`, booking);

      // Notify other party
      const recipientType = cancelledBy === booking.customerId ? 'vendor' : 'customer';
      const recipientId = cancelledBy === booking.customerId ? booking.vendorId : booking.customerId;
      
      await triggerNotification({
        recipientId,
        recipientType,
        type: 'booking_cancelled',
        category: 'bookings',
        title: 'Booking Cancelled',
        message: `Booking for ${booking.serviceName} has been cancelled. Reason: ${reason}`,
        data: { bookingId, reason },
        priority: 'high'
      });

      console.log(`✅ Booking ${bookingId} cancelled`);
      return c.json({ success: true, booking });
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

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status === 'completed' || booking.status === 'cancelled') {
        return c.json({ error: 'Cannot reschedule this booking' }, 400);
      }

      const oldDate = booking.bookingDate;
      const oldTime = booking.bookingTime;

      booking.bookingDate = newDate;
      booking.bookingTime = newTime;
      booking.rescheduledFrom = { date: oldDate, time: oldTime };
      booking.updatedAt = new Date().toISOString();

      booking.statusHistory.push({
        status: booking.status,
        timestamp: new Date().toISOString(),
        note: `Rescheduled from ${oldDate} ${oldTime} to ${newDate} ${newTime}. Reason: ${reason}`,
        action: 'rescheduled'
      });

      await kv.set(`booking:${bookingId}`, booking);

      console.log(`✅ Booking ${bookingId} rescheduled`);
      return c.json({ success: true, booking });
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
      
      const bookingIds = await kv.get(`vendor:${vendorId}:bookings`) || [];
      
      let pending = 0, confirmed = 0, completed = 0, cancelled = 0;
      let totalRevenue = 0;
      
      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking) {
          switch (booking.status) {
            case 'pending': pending++; break;
            case 'confirmed': confirmed++; break;
            case 'completed': 
              completed++; 
              totalRevenue += booking.price;
              break;
            case 'cancelled': cancelled++; break;
          }
        }
      }
      
      return c.json({ 
        stats: {
          total: bookingIds.length,
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

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status !== 'pending') {
        return c.json({ error: 'Booking is not in pending status' }, 400);
      }

      booking.status = 'confirmed';
      booking.confirmedAt = new Date().toISOString();
      booking.confirmedBy = vendorId;
      booking.updatedAt = new Date().toISOString();

      booking.statusHistory.push({
        status: 'confirmed',
        timestamp: new Date().toISOString(),
        note: note || 'Booking confirmed by vendor',
        updatedBy: vendorId
      });

      await kv.set(`booking:${bookingId}`, booking);

      // Notify Customer
      await triggerNotification({
        recipientId: booking.customerId,
        recipientType: 'customer',
        type: 'booking_confirmed',
        category: 'bookings',
        title: 'Booking Confirmed!',
        message: `Your booking for ${booking.serviceName} has been confirmed by the vendor.`,
        data: { bookingId },
        priority: 'high'
      });

      console.log(`✅ Booking ${bookingId} accepted by vendor`);
      return c.json({ success: true, booking });
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

      const booking = await kv.get(`booking:${bookingId}`);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.status !== 'pending') {
        return c.json({ error: 'Booking is not in pending status' }, 400);
      }

      booking.status = 'cancelled';
      booking.cancelledAt = new Date().toISOString();
      booking.cancelledBy = vendorId;
      booking.cancellationReason = reason || 'Rejected by vendor';
      booking.updatedAt = new Date().toISOString();

      booking.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date().toISOString(),
        note: `Rejected by vendor: ${reason}`,
        updatedBy: vendorId
      });

      await kv.set(`booking:${bookingId}`, booking);

      // Notify Customer
      await triggerNotification({
        recipientId: booking.customerId,
        recipientType: 'customer',
        type: 'booking_cancelled',
        category: 'bookings',
        title: 'Booking Declined',
        message: `Your booking for ${booking.serviceName} was declined. Reason: ${reason}`,
        data: { bookingId, reason },
        priority: 'high'
      });

      console.log(`✅ Booking ${bookingId} rejected by vendor`);
      return c.json({ success: true, booking });
    } catch (error) {
      console.error('Error rejecting booking:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Booking endpoints registered');
}