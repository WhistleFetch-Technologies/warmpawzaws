import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getNotificationsRepository } from '../../lib/repositories/notifications.ts';
import { getSchedulingRepository } from '../../lib/repositories/scheduling.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { withTransaction } from '../../lib/db.ts';

const client = getDbClient();

/**
 * FOLLOWUP ENDPOINTS - SQL VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * 
 * Follow-up bookings with discounts, chat messaging, and slot availability
 * 
 * Status: ✅ SQL-ONLY IMPLEMENTATION
 * KV Operations: 37 → 0
 */
export function followupEndpointsSQL(app: Hono) {

/**
 * POST /make-server-3dd53475/followup/create
 * Create a follow-up booking with discounted rate
 * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
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

    const bookingsRepo = getBookingsRepository();
    const servicesRepo = getServicesRepository();
    const schedulingRepo = getSchedulingRepository();

    // ✅ SQL: Verify original booking exists and was completed
    const originalBooking = await bookingsRepo.findById(originalBookingId);
    if (!originalBooking) {
      return c.json({ error: 'Original booking not found' }, 404);
    }

    if (originalBooking.status !== 'completed') {
      return c.json({ error: 'Original booking must be completed' }, 400);
    }

    // Check if within 7-day follow-up window
    if (originalBooking.completed_at) {
      const completedAt = new Date(originalBooking.completed_at);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 7) {
        return c.json({ error: 'Follow-up window expired (7 days after completion)' }, 403);
      }
    }

    // ✅ SQL: Get service details
    const service = await servicesRepo.findById(serviceId);
    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    // ✅ SQL: Check slot availability using SchedulingRepository
    const slotCapacity = await schedulingRepo.getSlotCapacity(
      vendorId,
      null, // staff_id
      selectedDate,
      selectedTime,
      serviceStyle || 'at_center'
    );

    const maxBookingsPerSlot = slotCapacity?.max_capacity || 1;
    if (slotCapacity && slotCapacity.current_bookings >= maxBookingsPerSlot) {
      return c.json({ 
        error: 'Time slot is fully booked',
        available: false 
      }, 409);
    }

    // ✅ SQL: Check vendor vacation mode (check vendors table or platform_settings)
    // For now, we'll check if vendor is active
    const { data: vendor } = await client
      .from('vendors')
      .select('id, is_active, vacation_mode')
      .eq('id', vendorId)
      .single();

    if (!vendor || !vendor.is_active) {
      return c.json({ 
        error: 'Vendor is not available',
        available: false 
      }, 409);
    }

    // Check vacation mode if stored in JSONB
    if (vendor.vacation_mode && typeof vendor.vacation_mode === 'object') {
      const vacationMode = vendor.vacation_mode as any;
      if (vacationMode.isActive) {
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
    }

    // ✅ ENHANCED: Support chat follow-up for ALL service styles (at_center, at_home, tele)
    // Chat follow-up is available for all appointment types within 7 days
    const isChatFollowup = serviceStyle === 'tele' || body.followupType === 'chat';
    const discountPercent = 100; // All follow-ups are FREE within 7 days
    const originalPrice = service.price || 0;
    const discountedPrice = 0; // FREE for all follow-ups

    // ✅ SQL: Get customer by phone
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(customerPhone.replace(/[^0-9]/g, ''));
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    // ✅ SQL: Create follow-up booking with original_booking_id in package_details
    const followupBooking = await withTransaction(async () => {
      const followupBookingData = {
        customer_id: customer.id,
        vendor_id: vendorId,
        service_id: serviceId,
        booking_date: selectedDate,
        booking_time: selectedTime,
        service_type: serviceStyle || 'at_center',
        address: address || originalBooking.address,
        base_price: originalPrice,
        discount_amount: originalPrice, // 100% discount
        tax_amount: 0,
        total_amount: discountedPrice,
        payment_status: isChatFollowup ? 'not_required' : 'pending',
        status: 'pending',
        package_details: {
          isFollowup: true,
          originalBookingId: originalBookingId,
          followupType: isChatFollowup ? 'chat' : serviceStyle,
          originalCompletionDate: originalBooking.completed_at,
          daysSinceOriginal: originalBooking.completed_at 
            ? Math.floor((Date.now() - new Date(originalBooking.completed_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          originalPrescriptionId: originalBooking.package_details?.prescriptionId || null
        },
        notes: `Follow-up booking from ${originalBookingId}`
      };

      return await bookingsRepo.create(followupBookingData);
    });

    // ✅ SQL: Reserve slot
    await schedulingRepo.reserveBookingSlot(
      vendorId,
      null, // staff_id
      selectedDate,
      selectedTime,
      serviceStyle || 'at_center',
      maxBookingsPerSlot
    );

    // ✅ SQL: Create notification for vendor
    const notificationsRepo = getNotificationsRepository();
    await notificationsRepo.create({
      recipient_type: 'vendor',
      recipient_id: vendorId,
      notification_type: 'followup_booking',
      title: '🔄 Follow-up Appointment',
      message: `Customer has booked a follow-up appointment`,
      data: {
        bookingId: followupBooking.id,
        originalBookingId: originalBookingId,
        isFollowup: true
      }
    });

    console.log(`✅ [FOLLOWUP] Follow-up booking created: ${followupBooking.id}`);
    console.log(`💰 [FOLLOWUP] Price: ₹${originalPrice} → ₹${discountedPrice} (${discountPercent}% off)`);

    return c.json({
      success: true,
      bookingId: followupBooking.id,
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
 * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
 */
app.get('/make-server-3dd53475/followup/check/:bookingId', async (c) => {
  try {
    const { bookingId } = c.req.param();

    console.log(`🔍 [FOLLOWUP-CHECK] Checking follow-up eligibility for: ${bookingId}`);

    const bookingsRepo = getBookingsRepository();

    // ✅ SQL: Get booking
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // ✅ SQL: Check if already has follow-up (search for bookings with original_booking_id in package_details)
    const { data: existingFollowups } = await client
      .from('bookings')
      .select('id')
      .eq('status', 'pending')
      .not('package_details', 'is', null)
      .filter('package_details->>originalBookingId', 'eq', bookingId)
      .limit(1);

    if (existingFollowups && existingFollowups.length > 0) {
      return c.json({
        eligible: false,
        reason: 'Follow-up already booked',
        followupBookingId: existingFollowups[0].id
      });
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return c.json({
        eligible: false,
        reason: 'Booking must be completed first'
      });
    }

    // Check 7-day window
    if (booking.completed_at) {
      const completedAt = new Date(booking.completed_at);
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
 * ✅ SQL-ONLY: All KV operations replaced with SQL
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

    const bookingsRepo = getBookingsRepository();
    const notificationsRepo = getNotificationsRepository();

    // ✅ SQL: Get booking details
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      console.error(`❌ [FOLLOWUP-CHAT] Booking not found: ${bookingId}`);
      return c.json({ error: 'Booking not found' }, 404);
    }

    // ✅ SQL: Save message to booking_chat_messages table (or use JSONB in bookings table)
    // For now, we'll use a simple JSONB approach in a chat_messages table
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

    // ✅ SQL: Insert message (using a generic chat_messages table or JSONB in bookings)
    // For now, we'll append to a JSONB field in bookings table
    const { data: bookingData, error: updateError } = await client
      .from('bookings')
      .select('chat_messages')
      .eq('id', bookingId)
      .single();

    if (updateError) {
      console.error('Error fetching booking for chat:', updateError);
    } else {
      const existingMessages = bookingData?.chat_messages || [];
      const updatedMessages = [...existingMessages, newMessage];
      
      await client
        .from('bookings')
        .update({ chat_messages: updatedMessages })
        .eq('id', bookingId);
    }

    // ✅ SQL: Create notification for recipient
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    if (senderType === 'customer') {
      // Customer sent message → Notify vendor
      const vendorId = booking.vendor_id;
      if (vendorId) {
        await notificationsRepo.create({
          recipient_type: 'vendor',
          recipient_id: vendorId,
          notification_type: 'chat_message',
          title: `New message from ${senderName}`,
          message: message.length > 50 ? message.substring(0, 50) + '...' : message,
          data: {
            bookingId: bookingId,
            messageId: messageId,
            senderType: senderType
          }
        });
      }
    } else {
      // Vendor sent message → Notify customer
      const customerId = booking.customer_id;
      await notificationsRepo.create({
        recipient_type: 'customer',
        recipient_id: customerId,
        notification_type: 'chat_message',
        title: `New message from ${senderName}`,
        message: message.length > 50 ? message.substring(0, 50) + '...' : message,
        data: {
          bookingId: bookingId,
          messageId: messageId,
          senderType: senderType
        }
      });
    }

    console.log(`✅ [FOLLOWUP-CHAT] Message sent with ${prescriptionId ? 'prescription' : 'no attachments'}`);

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
 * ✅ SQL-ONLY: All KV operations replaced with SQL
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

    const bookingsRepo = getBookingsRepository();
    const notificationsRepo = getNotificationsRepository();

    // ✅ SQL: Get booking details
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      console.error(`❌ [FOLLOWUP-CHAT-ALT] Booking not found: ${bookingId}`);
      return c.json({ error: 'Booking not found' }, 404);
    }

    // ✅ SQL: Create message
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const senderName = senderType === 'customer' 
      ? (await getCustomersRepository().findById(booking.customer_id))?.full_name || 'Customer'
      : (await client.from('vendors').select('business_name').eq('id', booking.vendor_id || '').single()).data?.business_name || 'Vendor';
    
    const newMessage = {
      id: messageId,
      bookingId: bookingId,
      senderPhone: senderPhone,
      senderName: senderName,
      senderType: senderType,
      message: message,
      messageType: 'text',
      timestamp: new Date().toISOString(),
      read: false
    };

    // ✅ SQL: Save message to JSONB field
    const { data: bookingData } = await client
      .from('bookings')
      .select('chat_messages')
      .eq('id', bookingId)
      .single();

    const existingMessages = bookingData?.chat_messages || [];
    const updatedMessages = [...existingMessages, newMessage];
    
    await client
      .from('bookings')
      .update({ chat_messages: updatedMessages })
      .eq('id', bookingId);

    // ✅ SQL: Create notification for recipient
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    if (senderType === 'customer') {
      // Customer sent message → Notify vendor
      const targetVendorId = vendorId || booking.vendor_id;
      if (targetVendorId) {
        await notificationsRepo.create({
          recipient_type: 'vendor',
          recipient_id: targetVendorId,
          notification_type: 'chat_message',
          title: `New message from ${senderName}`,
          message: message.length > 50 ? message.substring(0, 50) + '...' : message,
          data: {
            bookingId: bookingId,
            messageId: messageId,
            senderType: senderType
          }
        });
      }
    } else {
      // Vendor sent message → Notify customer
      await notificationsRepo.create({
        recipient_type: 'customer',
        recipient_id: booking.customer_id,
        notification_type: 'chat_message',
        title: `New message from ${senderName}`,
        message: message.length > 50 ? message.substring(0, 50) + '...' : message,
        data: {
          bookingId: bookingId,
          messageId: messageId,
          senderType: senderType
        }
      });
    }

    console.log(`✅ [FOLLOWUP-CHAT-ALT] Message sent successfully`);

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
 * ✅ SQL-ONLY: All KV operations replaced with SQL
 */
app.get('/make-server-3dd53475/followup/chat/:bookingId', async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    console.log(`📖 [FOLLOWUP-CHAT-GET] Fetching messages for booking: ${bookingId}`);
    
    // ✅ SQL: Get messages from JSONB field in bookings table
    const { data: booking, error } = await client
      .from('bookings')
      .select('chat_messages')
      .eq('id', bookingId)
      .single();
    
    if (error) {
      console.error('Error fetching booking chat:', error);
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    const messages = booking?.chat_messages || [];
    
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
 * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
 */
app.get('/make-server-3dd53475/vendor/:vendorId/slots/:date', async (c) => {
  try {
    const { vendorId, date } = c.req.param();
    const serviceStyle = c.req.query('serviceStyle') || 'at_center';

    console.log(`📅 [SLOTS] Fetching slots for vendor ${vendorId} on ${date}`);

    const schedulingRepo = getSchedulingRepository();

    // ✅ SQL: Check vacation mode
    const { data: vendor } = await client
      .from('vendors')
      .select('id, is_active, vacation_mode')
      .eq('id', vendorId)
      .single();

    if (!vendor || !vendor.is_active) {
      return c.json({
        success: true,
        slots: [],
        message: 'Vendor is not available'
      });
    }

    if (vendor.vacation_mode && typeof vendor.vacation_mode === 'object') {
      const vacationMode = vendor.vacation_mode as any;
      if (vacationMode.isActive) {
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
    }

    // ✅ SQL: Get vendor availability
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();
    const availability = await schedulingRepo.getVendorAvailability(vendorId, dayOfWeek);

    if (availability.length === 0) {
      return c.json({
        success: true,
        slots: [],
        message: 'No availability configured'
      });
    }

    // Filter by service style
    const relevantAvailability = availability.filter(avail => avail.service_style === serviceStyle);
    
    if (relevantAvailability.length === 0) {
      return c.json({
        success: true,
        slots: [],
        message: 'Vendor not available on this day for this service style'
      });
    }

    // Generate slots from time windows
    const allSlots = [];
    const now = new Date();
    const minBookingTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 min from now

    for (const avail of relevantAvailability) {
      if (!avail.is_enabled) continue;

      const [startHour, startMin] = avail.time_window_start.split(':').map(Number);
      const [endHour, endMin] = avail.time_window_end.split(':').map(Number);

      const slotDuration = avail.slot_duration_minutes || 30;
      let currentHour = startHour;
      let currentMin = startMin;

      while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
        const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
        
        // Check if slot is in the past
        const slotDateTime = new Date(date);
        slotDateTime.setHours(currentHour, currentMin, 0, 0);
        
        if (slotDateTime >= minBookingTime) {
          // ✅ SQL: Check if slot is already booked
          const slotCapacity = await schedulingRepo.getSlotCapacity(
            vendorId,
            null, // staff_id
            date,
            timeStr,
            serviceStyle
          );

          const isBooked = slotCapacity && slotCapacity.current_bookings >= (slotCapacity.max_capacity || 1);

          allSlots.push({
            time: timeStr,
            available: !isBooked,
            bookedCount: slotCapacity?.current_bookings || 0,
            maxCapacity: slotCapacity?.max_capacity || 1,
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
}

