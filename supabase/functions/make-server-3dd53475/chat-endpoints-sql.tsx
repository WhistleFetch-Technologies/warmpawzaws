/**
 * ============================================================================
 * CHAT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Chat endpoints for booking conversations:
 * - Get conversation
 * - Send messages
 * - Upload/download files
 * - Mark as read
 * - List active chats
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All chat messages stored in `chat_messages` table
 * - All chat files stored in `chat_files` table
 * - Activity tracking in `chat_activity` table
 * 
 * Date: 2024-12-22
 * Migration: Phase 2 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { streamSSE } from "npm:hono/streaming";
import { sendSuccess, sendError } from './response-utils.ts';
import { getChatMessagesRepository } from '../../lib/repositories/chat-messages.ts';
import { getChatFilesRepository } from '../../lib/repositories/chat-files.ts';
import { getChatActivityRepository } from '../../lib/repositories/chat-activity.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getNotificationsRepository } from '../../lib/repositories/notifications.ts';

export function registerChatEndpoints(app: Hono) {

/**
 * GET /make-server-3dd53475/chat/booking/:bookingId/conversation
 * Get chat conversation for a booking
 * ✅ MIGRATED TO SQL: Uses ChatMessagesRepository and BookingsRepository
 */
app.get('/make-server-3dd53475/chat/booking/:bookingId/conversation', async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    console.log(`💬 [CHAT] Fetching conversation for booking: ${bookingId}`);
    
    // ✅ SQL: Get booking details first (try both UUID and string booking_id)
    const bookingsRepo = getBookingsRepository();
    let booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      booking = await bookingsRepo.findByBookingId(bookingId);
    }
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    // ✅ SQL: Get chat messages using booking UUID
    const chatMessagesRepo = getChatMessagesRepository();
    const messages = await chatMessagesRepo.findByBooking(booking.id);
    
    // ✅ SQL: Get customer and vendor details for participants
    let customerName = null;
    let customerPhone = null;
    let vendorName = null;
    let vendorPhone = null;
    let petName = null;
    
    if (booking) {
      if (booking.customer_id) {
        const customersRepo = getCustomersRepository();
        const customer = await customersRepo.findById(booking.customer_id);
        if (customer) {
          customerName = customer.full_name || null;
          customerPhone = customer.phone || null;
        }
      }
      
      if (booking.vendor_id) {
        const vendorsRepo = getVendorsRepository();
        const vendor = await vendorsRepo.findById(booking.vendor_id);
        if (vendor) {
          vendorName = vendor.business_name || vendor.full_name || null;
          vendorPhone = vendor.phone || null;
        }
      }
      
      // Pet name would be in booking metadata or from pets table
      petName = null; // TODO: Get from pets table if needed
    }
    
    // Map SQL messages to expected format
    const mappedMessages = messages.map((msg) => ({
      id: msg.message_id,
      bookingId: msg.booking_id,
      senderPhone: msg.sender_phone,
      senderName: msg.sender_name,
      senderType: msg.sender_type,
      message: msg.message,
      messageType: msg.message_type,
      fileId: msg.file_id,
      fileName: msg.file_name,
      fileType: msg.file_type,
      fileSize: msg.file_size,
      timestamp: msg.created_at,
      read: msg.is_read,
      readAt: msg.read_at
    }));
    
    console.log(`✅ [CHAT] Found ${mappedMessages.length} messages for booking: ${bookingId}`);
    
    return sendSuccess(c, {
      messages: mappedMessages,
      booking: booking ? {
        id: booking.id,
        customerName,
        customerPhone,
        vendorName,
        vendorPhone,
        petName
      } : null
    });
    
  } catch (error) {
    console.error('❌ [CHAT] Error fetching conversation:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/chat/booking/:bookingId/stream
 * Real-time SSE stream for chat messages
 * ✅ MIGRATED TO SQL: Uses ChatMessagesRepository
 */
app.get('/make-server-3dd53475/chat/booking/:bookingId/stream', async (c) => {
  const { bookingId } = c.req.param();
  
  return streamSSE(c, async (stream) => {
    let lastMessageCount = 0;
    
    // ✅ SQL: Resolve booking first
    const bookingsRepo = getBookingsRepository();
    let booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      booking = await bookingsRepo.findByBookingId(bookingId);
    }
    if (!booking) {
      return streamSSE(c, async (stream) => {
        await stream.writeSSE({
          data: JSON.stringify({ status: 'error', message: 'Booking not found' }),
          event: 'error',
        });
      });
    }
    
    // ✅ SQL: Initial fetch to set baseline
    const chatMessagesRepo = getChatMessagesRepository();
    const initialMessages = await chatMessagesRepo.findByBooking(booking.id);
    lastMessageCount = initialMessages.length;
    
    await stream.writeSSE({
      data: JSON.stringify({ status: 'connected', bookingId }),
      event: 'connected',
    });

    // Poll for new messages
    const interval = setInterval(async () => {
      try {
        const messages = await chatMessagesRepo.findByBooking(booking.id);
        
        if (messages.length > lastMessageCount) {
          // Get only new messages
          const newMessages = messages.slice(lastMessageCount);
          lastMessageCount = messages.length;
          
          for (const msg of newMessages) {
            const mappedMsg = {
              id: msg.message_id,
              bookingId: msg.booking_id,
              senderPhone: msg.sender_phone,
              senderName: msg.sender_name,
              senderType: msg.sender_type,
              message: msg.message,
              messageType: msg.message_type,
              fileId: msg.file_id,
              fileName: msg.file_name,
              fileType: msg.file_type,
              fileSize: msg.file_size,
              timestamp: msg.created_at,
              read: msg.is_read
            };
            
            await stream.writeSSE({
              data: JSON.stringify(mappedMsg),
              event: 'new_message',
            });
          }
        }
      } catch (e) {
        console.error('SSE Chat Poll Error:', e);
      }
    }, 1000); // Poll every 1 second for chat

    stream.onAbort(() => {
      clearInterval(interval);
    });

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });
});

/**
 * POST /make-server-3dd53475/chat/booking/:bookingId/message
 * Send a message in booking chat
 * ✅ MIGRATED TO SQL: Uses ChatMessagesRepository, BookingsRepository, VendorsRepository, NotificationsRepository
 */
app.post('/make-server-3dd53475/chat/booking/:bookingId/message', async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { senderPhone, senderName, senderType, message, messageType } = await c.req.json();
    
    console.log(`📤 [CHAT-SEND] Sending message to booking: ${bookingId}`);
    
    // ✅ SQL: Verify booking exists (try both UUID and string booking_id)
    const bookingsRepo = getBookingsRepository();
    let booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      booking = await bookingsRepo.findByBookingId(bookingId);
    }
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    // ✅ ALLOW CHAT FOR ALL BOOKINGS (not just completed)
    // Chat is enabled for: confirmed, in_progress, and completed bookings
    const allowedStatuses = ['confirmed', 'in_progress', 'completed'];
    if (!allowedStatuses.includes(booking.status)) {
      return sendError(c, 'Chat not available for this booking status', 400, { status: booking.status });
    }
    
    // ✅ For completed bookings, check if within 7-day window
    if (booking.status === 'completed' && booking.completed_at) {
      const completedAt = new Date(booking.completed_at);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 7) {
        return sendError(c, 'Chat window has expired (7 days after completion)', 403);
      }
    }
    
    // ✅ SQL: Verify sender is part of this booking
    const customersRepo = getCustomersRepository();
    const vendorsRepo = getVendorsRepository();
    
    let isCustomer = false;
    let isVendor = false;
    
    // Normalize phone numbers for comparison
    const normalizePhoneForComparison = (phone: string) => {
      return phone.replace(/[^0-9]/g, '').replace(/^91/, '').replace(/^0/, '');
    };
    
    const normalizedSenderPhone = normalizePhoneForComparison(senderPhone);
    
    // Check if sender is customer
    if (booking.customer_id) {
      const customer = await customersRepo.findById(booking.customer_id);
      if (customer) {
        const normalizedCustomerPhone = normalizePhoneForComparison(customer.phone);
        if (normalizedCustomerPhone === normalizedSenderPhone) {
          isCustomer = true;
        }
      }
    }
    
    // Check if sender is vendor
    if (!isCustomer && booking.vendor_id) {
      const vendor = await vendorsRepo.findById(booking.vendor_id);
      if (vendor) {
        const vendorPhones = [
          vendor.phone,
          // Add other phone fields if they exist in vendor metadata
        ].filter(Boolean);
        
        const normalizedVendorPhones = vendorPhones.map(p => normalizePhoneForComparison(p));
        if (normalizedVendorPhones.some(p => p === normalizedSenderPhone)) {
          isVendor = true;
        }
      }
    }
    
    // ✅ ALLOW CHAT IF VENDOR_ID IS NULL (for testing/completed bookings)
    // If vendor_id is null but booking is completed, allow customer to chat
    if (!isCustomer && !isVendor && booking.vendor_id === null && booking.status === 'completed') {
      // Allow customer to send messages even if vendor_id is null
      if (booking.customer_id) {
        const customer = await customersRepo.findById(booking.customer_id);
        if (customer) {
          const normalizedCustomerPhone = normalizePhoneForComparison(customer.phone);
          if (normalizedCustomerPhone === normalizedSenderPhone) {
            isCustomer = true;
          }
        }
      }
    }
    
    // Debug logging
    console.log(`🔍 [CHAT-SEND] Authorization check:`, {
      senderPhone,
      senderType,
      customerId: booking.customer_id,
      vendorId: booking.vendor_id,
      isCustomer,
      isVendor
    });
    
    if (!isCustomer && !isVendor) {
      return sendError(c, 'Unauthorized sender', 403, {
        debug: {
          senderPhone,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id
        }
      });
    }
    
    // ✅ SQL: Create message
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const chatMessagesRepo = getChatMessagesRepository();
    
    const newMessage = await chatMessagesRepo.create({
      message_id: messageId,
      booking_id: bookingId,
      sender_phone: senderPhone,
      sender_name: senderName,
      sender_type: senderType as 'customer' | 'vendor' | 'staff',
      message: message,
      message_type: (messageType || 'text') as 'text' | 'image' | 'video' | 'pdf' | 'file',
    });
    
    console.log(`✅ [CHAT-SEND] Message saved: ${messageId}`);
    
    // ✅ SQL: Update last activity (use booking UUID)
    const chatActivityRepo = getChatActivityRepository();
    await chatActivityRepo.updateLastActivity(booking.id, messageId);
    
    // ✅ SQL: CREATE NOTIFICATION FOR RECIPIENT
    const notificationsRepo = getNotificationsRepository();
    
    // Resolve user_id for recipient
    let recipientUserId: string | null = null;
    
    if (senderType === 'customer') {
      // Customer sent message → Notify vendor
      if (booking.vendor_id) {
        const vendor = await vendorsRepo.findById(booking.vendor_id);
        if (vendor && vendor.user_id) {
          recipientUserId = vendor.user_id;
        }
      }
    } else {
      // Vendor sent message → Notify customer
      if (booking.customer_id) {
        const customer = await customersRepo.findById(booking.customer_id);
        if (customer && customer.user_id) {
          recipientUserId = customer.user_id;
        }
      }
    }
    
    if (recipientUserId) {
      await notificationsRepo.create({
        user_id: recipientUserId,
        notification_type: 'chat_message',
        title: `New message from ${senderName}`,
        message: message.length > 50 ? message.substring(0, 50) + '...' : message,
        data: {
          bookingId: bookingId,
          messageId: messageId,
          senderType: senderType
        }
      });
      console.log(`✅ [CHAT-SEND] Notification created for user: ${recipientUserId}`);
    }
    
    // Map to expected response format
    const mappedMessage = {
      id: newMessage.message_id,
      bookingId: newMessage.booking_id,
      senderPhone: newMessage.sender_phone,
      senderName: newMessage.sender_name,
      senderType: newMessage.sender_type,
      message: newMessage.message,
      messageType: newMessage.message_type,
      timestamp: newMessage.created_at,
      read: newMessage.is_read
    };
    
    return sendSuccess(c, {
      messageId,
      message: mappedMessage
    });
    
  } catch (error) {
    console.error('❌ [CHAT-SEND] Error sending message:', error);
    return sendError(c, error, 500);
  }
});

/**
 * PUT /make-server-3dd53475/chat/booking/:bookingId/read
 * Mark messages as read
 * ✅ MIGRATED TO SQL: Uses ChatMessagesRepository
 */
app.put('/make-server-3dd53475/chat/booking/:bookingId/read', async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { readerPhone } = await c.req.json();
    
    console.log(`✓ [CHAT-READ] Marking messages as read for: ${readerPhone}`);
    
    // ✅ SQL: Resolve booking first, then mark messages as read
    const bookingsRepo = getBookingsRepository();
    let booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      booking = await bookingsRepo.findByBookingId(bookingId);
    }
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    const chatMessagesRepo = getChatMessagesRepository();
    await chatMessagesRepo.markAsRead(booking.id, readerPhone);
    
    console.log(`✅ [CHAT-READ] Messages marked as read`);
    
    return sendSuccess(c, {}, 'Messages marked as read');
    
  } catch (error) {
    console.error('❌ [CHAT-READ] Error:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/chat/customer/:customerPhone
 * Get all active chats for a customer
 * ✅ MIGRATED TO SQL: Uses BookingsRepository, ChatMessagesRepository, ChatActivityRepository
 */
app.get('/make-server-3dd53475/chat/customer/:customerPhone', async (c) => {
  try {
    const { customerPhone } = c.req.param();
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    
    console.log(`📱 [CHAT-LIST] Fetching chats for customer: ${cleanPhone}`);
    
    // ✅ SQL: Get customer by phone
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    if (!customer) {
      return sendSuccess(c, { chats: [], total: 0 });
    }
    
    // ✅ SQL: Get customer's bookings
    const bookingsRepo = getBookingsRepository();
    const bookings = await bookingsRepo.findByCustomer(customer.id, { 
      status: 'completed',
      limit: 100 
    });
    
    const chatMessagesRepo = getChatMessagesRepository();
    const chatActivityRepo = getChatActivityRepository();
    const vendorsRepo = getVendorsRepository();
    
    const activeChats = [];
    
    for (const booking of bookings) {
      // Only include completed bookings within 7 days
      if (booking.status === 'completed' && booking.completed_at) {
        const completedAt = new Date(booking.completed_at);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 7) {
          // ✅ SQL: Get messages and activity
          const messages = await chatMessagesRepo.findByBooking(booking.id);
          const activity = await chatActivityRepo.findByBooking(booking.id);
          
          // Count unread messages
          const unreadCount = await chatMessagesRepo.getUnreadCount(booking.id, cleanPhone);
          
          // Get vendor details
          let vendorName = null;
          let vendorPhone = null;
          if (booking.vendor_id) {
            const vendor = await vendorsRepo.findById(booking.vendor_id);
            if (vendor) {
              vendorName = vendor.business_name || vendor.full_name || null;
              vendorPhone = vendor.phone || null;
            }
          }
          
          const lastMessage = messages.length > 0 ? {
            id: messages[messages.length - 1].message_id,
            message: messages[messages.length - 1].message,
            timestamp: messages[messages.length - 1].created_at
          } : null;
          
          activeChats.push({
            bookingId: booking.id,
            vendorName,
            vendorPhone,
            petName: null, // TODO: Get from pets table
            serviceName: booking.service_name || booking.service_type,
            lastMessage,
            lastActivity: activity?.last_activity_at || booking.completed_at,
            unreadCount,
            messageCount: messages.length,
            daysRemaining: Math.max(0, 7 - daysDiff)
          });
        }
      }
    }
    
    // Sort by last activity
    activeChats.sort((a, b) => 
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
    
    console.log(`✅ [CHAT-LIST] Found ${activeChats.length} active chats`);
    
    return sendSuccess(c, {
      chats: activeChats,
      total: activeChats.length
    });
    
  } catch (error) {
    console.error('❌ [CHAT-LIST] Error:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/chat/vendor/:vendorPhone
 * Get all active chats for a vendor
 * ✅ MIGRATED TO SQL: Uses VendorsRepository, BookingsRepository, ChatMessagesRepository, ChatActivityRepository
 */
app.get('/make-server-3dd53475/chat/vendor/:vendorPhone', async (c) => {
  try {
    const { vendorPhone } = c.req.param();
    const cleanPhone = vendorPhone.replace(/[^0-9]/g, '');
    
    console.log(`👨‍⚕️ [VENDOR-CHAT-LIST] Fetching chats for vendor: ${cleanPhone}`);
    
    // ✅ SQL: Get vendor by phone
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findByPhone(cleanPhone);
    if (!vendor) {
      return sendError(c, 'Vendor not found', 404);
    }
    
    // ✅ SQL: Get vendor's bookings
    const bookingsRepo = getBookingsRepository();
    const bookings = await bookingsRepo.findByVendor(vendor.id, { 
      status: 'completed',
      limit: 100 
    });
    
    const chatMessagesRepo = getChatMessagesRepository();
    const chatActivityRepo = getChatActivityRepository();
    const customersRepo = getCustomersRepository();
    
    const activeChats = [];
    
    for (const booking of bookings) {
      // Only include completed bookings within 7 days
      if (booking.status === 'completed' && booking.completed_at) {
        const completedAt = new Date(booking.completed_at);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 7) {
          // ✅ SQL: Get messages and activity
          const messages = await chatMessagesRepo.findByBooking(booking.id);
          const activity = await chatActivityRepo.findByBooking(booking.id);
          
          // Count unread messages
          const unreadCount = await chatMessagesRepo.getUnreadCount(booking.id, cleanPhone);
          
          // Get customer details
          let customerName = null;
          let customerPhone = null;
          if (booking.customer_id) {
            const customer = await customersRepo.findById(booking.customer_id);
            if (customer) {
              customerName = customer.full_name || null;
              customerPhone = customer.phone || null;
            }
          }
          
          const lastMessage = messages.length > 0 ? {
            id: messages[messages.length - 1].message_id,
            message: messages[messages.length - 1].message,
            timestamp: messages[messages.length - 1].created_at
          } : null;
          
          activeChats.push({
            bookingId: booking.id,
            customerName,
            customerPhone,
            petName: null, // TODO: Get from pets table
            serviceName: booking.service_name || booking.service_type,
            lastMessage,
            lastActivity: activity?.last_activity_at || booking.completed_at,
            unreadCount,
            messageCount: messages.length,
            daysRemaining: Math.max(0, 7 - daysDiff)
          });
        }
      }
    }
    
    // Sort by last activity
    activeChats.sort((a, b) => 
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
    
    console.log(`✅ [VENDOR-CHAT-LIST] Found ${activeChats.length} active chats`);
    
    return sendSuccess(c, {
      chats: activeChats,
      total: activeChats.length
    });
    
  } catch (error) {
    console.error('❌ [VENDOR-CHAT-LIST] Error:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/chat/upload-file
 * Upload a file (PDF, image, video) for chat message
 * ✅ MIGRATED TO SQL: Uses ChatFilesRepository, ChatMessagesRepository, ChatActivityRepository
 */
app.post('/make-server-3dd53475/chat/upload-file', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const bookingId = formData.get('bookingId') as string;
    const senderPhone = formData.get('senderPhone') as string;
    const senderName = formData.get('senderName') as string;
    const senderType = formData.get('senderType') as string;
    const caption = formData.get('caption') as string;
    
    if (!file) {
      return sendError(c, 'No file provided', 400);
    }
    
    console.log(`📤 [CHAT-UPLOAD] Uploading file for booking: ${bookingId}`);
    console.log(`📄 File details:`, { name: file.name, type: file.type, size: file.size });
    
    // ✅ SQL: Verify booking exists (try both UUID and string booking_id)
    const bookingsRepo = getBookingsRepository();
    let booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      booking = await bookingsRepo.findByBookingId(bookingId);
    }
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    // Determine file type category
    let fileCategory: 'image' | 'video' | 'pdf' | 'file' = 'file';
    if (file.type.startsWith('image/')) {
      fileCategory = 'image';
    } else if (file.type.startsWith('video/')) {
      fileCategory = 'video';
    } else if (file.type === 'application/pdf') {
      fileCategory = 'pdf';
    }
    
    // Convert file to base64 for storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    // ✅ FIX: Convert to base64 in chunks to avoid stack overflow for large files
    let binaryString = '';
    const chunkSize = 8192; // Process 8KB at a time
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
      binaryString += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binaryString);
    
    console.log(`📦 [CHAT-UPLOAD] File converted to base64: ${file.name} (${(base64.length / 1024).toFixed(2)} KB)`);
    
    // ✅ SQL: Create file record (use booking UUID - already resolved above)
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const chatFilesRepo = getChatFilesRepository();
    
    await chatFilesRepo.create({
      file_id: fileId,
      booking_id: booking.id,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_category: fileCategory,
      base64_data: base64, // Store base64 for now (can migrate to S3 later)
      uploaded_by: senderPhone,
      uploaded_by_name: senderName,
    });
    
    console.log(`✅ [CHAT-UPLOAD] File stored: ${fileId}`);
    
    // ✅ SQL: Create chat message with file attachment
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const chatMessagesRepo = getChatMessagesRepository();
    
    const newMessage = await chatMessagesRepo.create({
      message_id: messageId,
      booking_id: bookingId,
      sender_phone: senderPhone,
      sender_name: senderName,
      sender_type: senderType as 'customer' | 'vendor' | 'staff',
      message: caption || `Sent a ${fileCategory}`,
      message_type: fileCategory,
      file_id: fileId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
    });
    
    // ✅ SQL: Update last activity (use booking UUID)
    const chatActivityRepo = getChatActivityRepository();
    await chatActivityRepo.updateLastActivity(booking.id, messageId);
    
    console.log(`✅ [CHAT-UPLOAD] Chat message created with file: ${messageId}`);
    
    // Map to expected response format
    const mappedMessage = {
      id: newMessage.message_id,
      bookingId: newMessage.booking_id,
      senderPhone: newMessage.sender_phone,
      senderName: newMessage.sender_name,
      senderType: newMessage.sender_type,
      message: newMessage.message,
      messageType: newMessage.message_type,
      fileId: newMessage.file_id,
      fileName: newMessage.file_name,
      fileType: newMessage.file_type,
      fileSize: newMessage.file_size,
      timestamp: newMessage.created_at,
      read: newMessage.is_read
    };
    
    return sendSuccess(c, {
      messageId: messageId,
      fileId: fileId,
      message: mappedMessage
    });
    
  } catch (error) {
    console.error('❌ [CHAT-UPLOAD] Error uploading file:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/chat/file/:fileId
 * Download/view a chat file
 * ✅ MIGRATED TO SQL: Uses ChatFilesRepository
 */
app.get('/make-server-3dd53475/chat/file/:fileId', async (c) => {
  try {
    const { fileId } = c.req.param();
    
    console.log(`📥 [CHAT-DOWNLOAD] Fetching file: ${fileId}`);
    
    // ✅ SQL: Get file data
    const chatFilesRepo = getChatFilesRepository();
    const fileData = await chatFilesRepo.findByFileId(fileId);
    
    if (!fileData || !fileData.base64_data) {
      return sendError(c, 'File not found', 404);
    }
    
    // Convert base64 back to binary
    const binaryString = atob(fileData.base64_data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log(`✅ [CHAT-DOWNLOAD] Serving file: ${fileData.file_name}`);
    
    // Return file with appropriate content type
    return new Response(bytes, {
      headers: {
        'Content-Type': fileData.file_type,
        'Content-Disposition': `inline; filename="${fileData.file_name}"`,
        'Content-Length': fileData.file_size.toString()
      }
    });
    
  } catch (error) {
    console.error('❌ [CHAT-DOWNLOAD] Error:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/chat/messages/:bookingId
 * Get all messages for a booking (simplified endpoint for follow-up)
 * ✅ MIGRATED TO SQL: Uses ChatMessagesRepository
 */
app.get('/make-server-3dd53475/chat/messages/:bookingId', async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    console.log(`💬 [CHAT] Fetching messages for booking: ${bookingId}`);
    
    // ✅ SQL: Resolve booking first
    const bookingsRepo = getBookingsRepository();
    let booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      booking = await bookingsRepo.findByBookingId(bookingId);
    }
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    // ✅ SQL: Get messages (use booking UUID)
    const chatMessagesRepo = getChatMessagesRepository();
    const messages = await chatMessagesRepo.findByBooking(booking.id);
    
    // Map to expected format
    const mappedMessages = messages.map((msg) => ({
      id: msg.message_id,
      bookingId: msg.booking_id,
      senderPhone: msg.sender_phone,
      senderName: msg.sender_name,
      senderType: msg.sender_type,
      message: msg.message,
      messageType: msg.message_type,
      fileId: msg.file_id,
      fileName: msg.file_name,
      fileType: msg.file_type,
      fileSize: msg.file_size,
      timestamp: msg.created_at,
      read: msg.is_read,
      readAt: msg.read_at
    }));
    
    console.log(`✅ [CHAT] Found ${mappedMessages.length} messages`);
    
    return sendSuccess(c, { messages: mappedMessages });
    
  } catch (error) {
    console.error('❌ [CHAT] Error fetching messages:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/chat/send
 * Send a message (simplified endpoint for follow-up)
 * ✅ MIGRATED TO SQL: Uses ChatMessagesRepository, ChatActivityRepository, NotificationsRepository
 */
app.post('/make-server-3dd53475/chat/send', async (c) => {
  try {
    const body = await c.req.json();
    const {
      bookingId,
      senderPhone,
      senderName,
      senderType,
      receiverPhone,
      receiverName,
      receiverType,
      message,
      messageType
    } = body;
    
    console.log(`📤 [CHAT-SEND] Sending message for booking: ${bookingId}`);
    
    // ✅ SQL: Resolve booking first (needed for activity update and notifications)
    const bookingsRepo = getBookingsRepository();
    let booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      booking = await bookingsRepo.findByBookingId(bookingId);
    }
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    // ✅ SQL: Create message
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const chatMessagesRepo = getChatMessagesRepository();
    
    const newMessage = await chatMessagesRepo.create({
      message_id: messageId,
      booking_id: booking.id, // Use resolved booking UUID
      sender_phone: senderPhone,
      sender_name: senderName,
      sender_type: senderType as 'customer' | 'vendor' | 'staff',
      message: message,
      message_type: (messageType || 'text') as 'text' | 'image' | 'video' | 'pdf' | 'file',
    });
    
    // ✅ SQL: Update last activity (use booking UUID)
    const chatActivityRepo = getChatActivityRepository();
    await chatActivityRepo.updateLastActivity(booking.id, messageId);
    
    // ✅ SQL: Create notification for receiver
    const notificationsRepo = getNotificationsRepository();
    const customersRepo = getCustomersRepository();
    const vendorsRepo = getVendorsRepository();
    
    let recipientUserId: string | null = null;
    
    if (receiverType === 'vendor') {
      // Find vendor ID from booking (already resolved above)
      if (booking.vendor_id) {
        const vendor = await vendorsRepo.findById(booking.vendor_id);
        if (vendor && vendor.user_id) {
          recipientUserId = vendor.user_id;
        }
      }
    } else if (receiverType === 'customer') {
      // Find customer ID from booking (already resolved above)
      if (booking.customer_id) {
        const customer = await customersRepo.findById(booking.customer_id);
        if (customer && customer.user_id) {
          recipientUserId = customer.user_id;
        }
      }
    }
    
    if (recipientUserId) {
      await notificationsRepo.create({
        user_id: recipientUserId,
        notification_type: 'chat_message',
        title: `New message from ${senderName}`,
        message: message.length > 50 ? message.substring(0, 50) + '...' : message,
        data: {
          bookingId: bookingId,
          senderPhone: senderPhone,
          senderName: senderName,
          senderType: senderType
        }
      });
      console.log(`📬 [CHAT-SEND] Notification created for user: ${recipientUserId}`);
    }
    
    // Map to expected response format
    const mappedMessage = {
      id: newMessage.message_id,
      bookingId: newMessage.booking_id,
      senderPhone: newMessage.sender_phone,
      senderName: newMessage.sender_name,
      senderType: newMessage.sender_type,
      message: newMessage.message,
      messageType: newMessage.message_type,
      timestamp: newMessage.created_at,
      read: newMessage.is_read
    };
    
    console.log(`✅ [CHAT-SEND] Message sent: ${messageId}`);
    
    return sendSuccess(c, {
      messageId: messageId,
      message: mappedMessage
    });
    
  } catch (error) {
    console.error('❌ [CHAT-SEND] Error:', error);
    return sendError(c, error, 500);
  }
});

}

