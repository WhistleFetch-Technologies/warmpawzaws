import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

/**
 * POST /make-server-3dd53475/followup/create
 * Create a follow-up booking with discounted rate
 */
app.post('/make-server-3dd53475/followup/create', async (c) => {
  try {
    const body = await c.req.json();
    const {
      originalBookingId,
      customerPhone,
      vendorId,
      vendorPhone,
      serviceId,
      selectedDate,
      selectedTime,
      petId,
      address,
      serviceStyle
    } = body;

    console.log(`🔄 [FOLLOWUP] Creating follow-up booking from original: ${originalBookingId}`);

    // Verify original booking exists and was completed
    const originalBooking = await kv.get(`booking:${originalBookingId}`);
    if (!originalBooking) {
      return c.json({ error: 'Original booking not found' }, 404);
    }

    if (originalBooking.status !== 'completed') {
      return c.json({ error: 'Original booking must be completed' }, 400);
    }

    // Check if within 30-day follow-up window
    if (originalBooking.otpVerifiedAt) {
      const completedAt = new Date(originalBooking.otpVerifiedAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 7) {
        return c.json({ error: 'Follow-up window expired (7 days after completion)' }, 403);
      }
    }

    // Get service details
    const service = await kv.get(`service:${serviceId}`);
    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    // Validate slot availability
    const slotKey = `vendor:${vendorId}:bookings:${selectedDate}:${selectedTime}`;
    const existingBookings = await kv.get(slotKey) || [];
    
    // Check maximum bookings per slot (default 1)
    const maxBookingsPerSlot = 1; // Can be made configurable
    if (existingBookings.length >= maxBookingsPerSlot) {
      return c.json({ 
        error: 'Time slot is fully booked',
        available: false 
      }, 409);
    }

    // Check vendor vacation mode
    const vacationMode = await kv.get(`vendor:${vendorId}:vacationMode`);
    if (vacationMode && vacationMode.isActive) {
      const vacationStart = new Date(vacationMode.startDate);
      const vacationEnd = new Date(vacationMode.endDate);
      const bookingDate = new Date(selectedDate);
      
      if (bookingDate >= vacationStart && bookingDate <= vacationEnd) {
        return c.json({ 
          error: 'Vendor is on vacation for selected date',
          available: false 
        }, 409);
      }
    }

    // Calculate follow-up discount (free if chat-based, 30% off if at-center)
    const isChatFollowup = serviceStyle === 'tele';
    const discountPercent = 100; // All follow-ups are FREE within 7 days
    const originalPrice = typeof service.price === 'number' ? service.price : service.price?.basePrice || 0;
    const discountedPrice = 0; // FREE for all follow-ups

    // Create follow-up booking
    const followupBookingId = `booking_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const followupBooking = {
      id: followupBookingId,
      originalBookingId: originalBookingId,
      isFollowup: true,
      followupType: isChatFollowup ? 'chat' : 'at_center',
      
      // Booking details
      customerPhone: customerPhone.replace(/[^0-9]/g, ''),
      customerName: originalBooking.customerName,
      vendorId: vendorId,
      vendorPhone: vendorPhone.replace(/[^0-9]/g, ''),
      vendorName: originalBooking.vendorName,
      vendorType: originalBooking.vendorType,
      
      // Service details
      serviceId: serviceId,
      serviceName: service.serviceName || service.name,
      serviceType: service.categoryName,
      serviceStyle: serviceStyle,
      
      // Pet details
      petId: petId,
      petName: originalBooking.petName,
      
      // Scheduling
      selectedDate: selectedDate,
      selectedTime: selectedTime,
      address: address || originalBooking.address,
      
      // Pricing with follow-up discount
      originalPrice: originalPrice,
      discountPercent: discountPercent,
      discountedPrice: discountedPrice,
      finalPrice: discountedPrice,
      
      // Status
      status: 'pending',
      paymentStatus: isChatFollowup ? 'not_required' : 'pending',
      createdAt: new Date().toISOString(),
      
      // Follow-up metadata
      followupMetadata: {
        originalCompletionDate: originalBooking.otpVerifiedAt,
        daysSinceOriginal: Math.floor((Date.now() - new Date(originalBooking.otpVerifiedAt).getTime()) / (1000 * 60 * 60 * 24)),
        originalPrescriptionId: originalBooking.prescriptionId
      }
    };

    // Save follow-up booking
    await kv.set(`booking:${followupBookingId}`, followupBooking);

    // Add to slot bookings
    existingBookings.push(followupBookingId);
    await kv.set(slotKey, existingBookings);

    // Add to customer bookings list
    const customerBookings = await kv.get(`customer:bookings:${customerPhone.replace(/[^0-9]/g, '')}`) || [];
    customerBookings.push(followupBookingId);
    await kv.set(`customer:bookings:${customerPhone.replace(/[^0-9]/g, '')}`, customerBookings);

    // Add to vendor bookings list
    const vendorBookings = await kv.get(`vendor:${vendorId}:bookings`) || [];
    vendorBookings.push(followupBookingId);
    await kv.set(`vendor:${vendorId}:bookings`, vendorBookings);

    // Link to original booking
    await kv.set(`booking:${originalBookingId}:followup`, followupBookingId);

    // Create notification for vendor
    const notificationId = `notification_${Date.now()}`;
    const notification = {
      id: notificationId,
      vendorId: vendorId,
      type: 'followup_booking',
      title: '🔄 Follow-up Appointment',
      message: `${originalBooking.customerName} has booked a follow-up for ${originalBooking.petName}`,
      bookingId: followupBookingId,
      originalBookingId: originalBookingId,
      isFollowup: true,
      read: false,
      createdAt: new Date().toISOString()
    };
    await kv.set(`notification:${notificationId}`, notification);
    
    const vendorNotifications = await kv.get(`vendor:${vendorId}:notifications`) || [];
    vendorNotifications.unshift(notificationId);
    await kv.set(`vendor:${vendorId}:notifications`, vendorNotifications);

    console.log(`✅ [FOLLOWUP] Follow-up booking created: ${followupBookingId}`);
    console.log(`💰 [FOLLOWUP] Price: ₹${originalPrice} → ₹${discountedPrice} (${discountPercent}% off)`);

    return c.json({
      success: true,
      bookingId: followupBookingId,
      booking: followupBooking,
      message: isChatFollowup 
        ? 'Chat follow-up booked (Free)' 
        : `Follow-up booked at ${discountPercent}% discount`
    });

  } catch (error) {
    console.error('❌ [FOLLOWUP] Error creating follow-up:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/followup/check/:bookingId
 * Check if follow-up is available for a booking
 */
app.get('/make-server-3dd53475/followup/check/:bookingId', async (c) => {
  try {
    const { bookingId } = c.req.param();

    console.log(`🔍 [FOLLOWUP-CHECK] Checking follow-up eligibility for: ${bookingId}`);

    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Check if already has follow-up
    const existingFollowup = await kv.get(`booking:${bookingId}:followup`);
    if (existingFollowup) {
      return c.json({
        eligible: false,
        reason: 'Follow-up already booked',
        followupBookingId: existingFollowup
      });
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return c.json({
        eligible: false,
        reason: 'Booking must be completed first'
      });
    }

    // Check 30-day window
    if (booking.otpVerifiedAt) {
      const completedAt = new Date(booking.otpVerifiedAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = 7 - daysDiff;

      if (daysDiff > 7) {
        return c.json({
          eligible: false,
          reason: 'Follow-up window expired',
          completedDaysAgo: daysDiff
        });
      }

      return c.json({
        eligible: true,
        daysRemaining: daysRemaining,
        completedDaysAgo: daysDiff,
        discounts: {
          chatFollowup: '100% off (Free)',
          atCenterFollowup: '100% off (Free for clinic follow-up)'
        }
      });
    }

    return c.json({
      eligible: false,
      reason: 'Completion date not found'
    });

  } catch (error) {
    console.error('❌ [FOLLOWUP-CHECK] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/followup/chat/send
 * Send message in follow-up chat with prescription attachment
 */
app.post('/make-server-3dd53475/followup/chat/send', async (c) => {
  try {
    const body = await c.req.json();
    const {
      bookingId,
      senderPhone,
      senderName,
      senderType,
      message,
      messageType,
      prescriptionId,
      attachmentUrl
    } = body;

    console.log(`💬 [FOLLOWUP-CHAT] Sending message for booking: ${bookingId}`);
    console.log(`💬 [FOLLOWUP-CHAT] Sender: ${senderName} (${senderType}), Message: "${message}"`);

    // Get booking details to find recipient
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      console.error(`❌ [FOLLOWUP-CHAT] Booking not found: ${bookingId}`);
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Use existing chat endpoint but with prescription attachment support
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newMessage = {
      id: messageId,
      bookingId: bookingId,
      senderPhone: senderPhone,
      senderName: senderName,
      senderType: senderType,
      message: message,
      messageType: messageType || 'text',
      prescriptionId: prescriptionId || null,
      attachmentUrl: attachmentUrl || null,
      timestamp: new Date().toISOString(),
      read: false
    };

    const messagesKey = `chat:booking:${bookingId}:messages`;
    const messages = await kv.get(messagesKey) || [];
    messages.push(newMessage);
    await kv.set(messagesKey, messages);

    // If prescription attached, link it
    if (prescriptionId) {
      await kv.set(`prescription:${prescriptionId}:chat:${bookingId}`, true);
    }

    // ✅ CREATE NOTIFICATION FOR RECIPIENT
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const notification = {
      type: 'chat_message',
      title: `New message from ${senderName}`,
      message: message.length > 50 ? message.substring(0, 50) + '...' : message,
      bookingId: bookingId,
      messageId: messageId,
      senderType: senderType,
      createdAt: new Date().toISOString(),
      read: false
    };

    // Store notification object
    await kv.set(`notification:${notificationId}`, notification);

    // Add notification ID to recipient's notification list
    if (senderType === 'customer') {
      // Customer sent message → Notify vendor
      const vendorId = booking.vendorId;
      console.log(`📬 [FOLLOWUP-CHAT] Creating notification for vendor: ${vendorId}`);
      
      const vendorNotifications = await kv.get(`vendor:${vendorId}:notifications`) || [];
      vendorNotifications.unshift(notificationId); // Add to beginning for latest-first
      await kv.set(`vendor:${vendorId}:notifications`, vendorNotifications);
    } else {
      // Vendor sent message → Notify customer
      const customerPhone = booking.customerPhone.replace(/[^0-9]/g, '');
      console.log(`📬 [FOLLOWUP-CHAT] Creating notification for customer: ${customerPhone}`);
      
      const customerNotifications = await kv.get(`customer:${customerPhone}:notifications`) || [];
      customerNotifications.unshift(notificationId); // Add to beginning for latest-first
      await kv.set(`customer:${customerPhone}:notifications`, customerNotifications);
    }

    console.log(`✅ [FOLLOWUP-CHAT] Message sent with ${prescriptionId ? 'prescription' : 'no attachments'}`);
    console.log(`✅ [FOLLOWUP-CHAT] Notification created: ${notificationId}`);

    return c.json({
      success: true,
      messageId,
      message: newMessage,
      notificationId
    });

  } catch (error) {
    console.error('❌ [FOLLOWUP-CHAT] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/followup/chat/:bookingId/message
 * Send message in follow-up chat (alternative endpoint for frontend compatibility)
 */
app.post('/make-server-3dd53475/followup/chat/:bookingId/message', async (c) => {
  try {
    const { bookingId } = c.req.param();
    const body = await c.req.json();
    const {
      message,
      senderType,
      senderPhone,
      vendorId
    } = body;

    console.log(`💬 [FOLLOWUP-CHAT-ALT] Sending message for booking: ${bookingId}`);
    console.log(`💬 [FOLLOWUP-CHAT-ALT] Sender type: ${senderType}, Message: "${message}"`);

    // Get booking details
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      console.error(`❌ [FOLLOWUP-CHAT-ALT] Booking not found: ${bookingId}`);
      return c.json({ error: 'Booking not found' }, 404);
    }

    // Create message
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newMessage = {
      id: messageId,
      bookingId: bookingId,
      senderPhone: senderPhone,
      senderName: senderType === 'customer' ? booking.customerName : booking.vendorName,
      senderType: senderType,
      message: message,
      messageType: 'text',
      timestamp: new Date().toISOString(),
      read: false
    };

    const messagesKey = `chat:booking:${bookingId}:messages`;
    const messages = await kv.get(messagesKey) || [];
    messages.push(newMessage);
    await kv.set(messagesKey, messages);

    // ✅ CREATE NOTIFICATION FOR RECIPIENT
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const senderName = senderType === 'customer' ? booking.customerName : booking.vendorName;
    
    const notification = {
      type: 'chat_message',
      title: `New message from ${senderName}`,
      message: message.length > 50 ? message.substring(0, 50) + '...' : message,
      bookingId: bookingId,
      messageId: messageId,
      senderType: senderType,
      createdAt: new Date().toISOString(),
      read: false
    };

    // Store notification object
    await kv.set(`notification:${notificationId}`, notification);

    // Add notification ID to recipient's notification list
    if (senderType === 'customer') {
      // Customer sent message → Notify vendor
      const targetVendorId = vendorId || booking.vendorId;
      console.log(`📬 [FOLLOWUP-CHAT-ALT] Creating notification for vendor: ${targetVendorId}`);
      
      const vendorNotifications = await kv.get(`vendor:${targetVendorId}:notifications`) || [];
      vendorNotifications.unshift(notificationId);
      await kv.set(`vendor:${targetVendorId}:notifications`, vendorNotifications);
    } else {
      // Vendor sent message → Notify customer
      const customerPhone = booking.customerPhone.replace(/[^0-9]/g, '');
      console.log(`📬 [FOLLOWUP-CHAT-ALT] Creating notification for customer: ${customerPhone}`);
      
      const customerNotifications = await kv.get(`customer:${customerPhone}:notifications`) || [];
      customerNotifications.unshift(notificationId);
      await kv.set(`customer:${customerPhone}:notifications`, customerNotifications);
    }

    console.log(`✅ [FOLLOWUP-CHAT-ALT] Message sent successfully`);
    console.log(`✅ [FOLLOWUP-CHAT-ALT] Notification created: ${notificationId}`);

    return c.json({
      success: true,
      messageId,
      message: newMessage,
      notificationId
    });

  } catch (error) {
    console.error('❌ [FOLLOWUP-CHAT-ALT] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/followup/chat/:bookingId
 * Get all messages for a follow-up chat
 */
app.get('/make-server-3dd53475/followup/chat/:bookingId', async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    console.log(`📖 [FOLLOWUP-CHAT-GET] Fetching messages for booking: ${bookingId}`);
    
    const messagesKey = `chat:booking:${bookingId}:messages`;
    const messages = await kv.get(messagesKey) || [];
    
    console.log(`📖 [FOLLOWUP-CHAT-GET] Found ${messages.length} messages`);
    
    return c.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('❌ [FOLLOWUP-CHAT-GET] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/vendor/:vendorId/slots/:date
 * Get available slots with validation (vacation, booked, past time)
 */
app.get('/make-server-3dd53475/vendor/:vendorId/slots/:date', async (c) => {
  try {
    const { vendorId, date } = c.req.param();
    const serviceStyle = c.req.query('serviceStyle') || 'at_center';

    console.log(`📅 [SLOTS] Fetching slots for vendor ${vendorId} on ${date}`);

    // Check vacation mode first
    const vacationMode = await kv.get(`vendor:${vendorId}:vacationMode`);
    if (vacationMode && vacationMode.isActive) {
      const vacationStart = new Date(vacationMode.startDate);
      const vacationEnd = new Date(vacationMode.endDate);
      const requestedDate = new Date(date);
      
      if (requestedDate >= vacationStart && requestedDate <= vacationEnd) {
        console.log(`🏖️ [SLOTS] Vendor on vacation from ${vacationMode.startDate} to ${vacationMode.endDate}`);
        return c.json({
          success: true,
          slots: [],
          onVacation: true,
          vacationMessage: vacationMode.message || 'Vendor is on vacation'
        });
      }
    }

    // Get vendor availability
    const availabilityData = await kv.get(`vendor:${vendorId}:availability:v2`);
    if (!availabilityData) {
      return c.json({
        success: true,
        slots: [],
        message: 'No availability configured'
      });
    }

    const availability = availabilityData.availability || availabilityData;
    
    // Find day configuration
    const requestedDate = new Date(date);
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][requestedDate.getDay()];
    const dayConfig = availability.find((d: any) => d.dayOfWeek === dayOfWeek);

    if (!dayConfig || !dayConfig.timeWindows || dayConfig.timeWindows.length === 0) {
      return c.json({
        success: true,
        slots: [],
        message: 'Vendor not available on this day'
      });
    }

    // Generate slots from time windows
    const allSlots = [];
    for (const window of dayConfig.timeWindows) {
      if (!window.isEnabled) continue;

      const [startHour, startMin] = window.startTime.split(':').map(Number);
      const [endHour, endMin] = window.endTime.split(':').map(Number);

      const slotDuration = 30; // Default 30 minutes
      let currentHour = startHour;
      let currentMin = startMin;

      while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
        const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
        
        // Check if slot is in the past (show only slots 30+ min from now)
        const now = new Date();
        const slotDateTime = new Date(date);
        slotDateTime.setHours(currentHour, currentMin, 0, 0);
        
        const minBookingTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 min from now
        
        if (slotDateTime >= minBookingTime) {
          // Check if slot is already booked
          const slotKey = `vendor:${vendorId}:bookings:${date}:${timeStr}`;
          const existingBookings = await kv.get(slotKey) || [];
          const isBooked = existingBookings.length >= 1; // Max 1 booking per slot

          allSlots.push({
            time: timeStr,
            available: !isBooked,
            bookedCount: existingBookings.length,
            isPast: false
          });
        }

        // Increment time
        currentMin += slotDuration;
        if (currentMin >= 60) {
          currentMin -= 60;
          currentHour += 1;
        }
      }
    }

    console.log(`✅ [SLOTS] Found ${allSlots.length} slots (${allSlots.filter(s => s.available).length} available)`);

    return c.json({
      success: true,
      slots: allSlots,
      date: date,
      onVacation: false
    });

  } catch (error) {
    console.error('❌ [SLOTS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;