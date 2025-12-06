import { Hono } from 'npm:hono';
import { streamSSE } from "npm:hono/streaming";
import * as kv from './kv_store.tsx';
import { sendSuccess, sendError } from './response-utils.ts';

export function registerChatEndpoints(app: Hono) {

/**
 * GET /make-server-3dd53475/chat/booking/:bookingId/conversation
 * Get chat conversation for a booking
 */
app.get('/make-server-3dd53475/chat/booking/:bookingId/conversation', async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    console.log(`💬 [CHAT] Fetching conversation for booking: ${bookingId}`);
    
    // Get chat messages
    const messages = await kv.get(`chat:booking:${bookingId}:messages`) || [];
    
    // Get booking details for participants
    const booking = await kv.get(`booking:${bookingId}`);
    
    console.log(`✅ [CHAT] Found ${messages.length} messages for booking: ${bookingId}`);
    
    return sendSuccess(c, {
      messages,
      booking: booking ? {
        id: booking.id,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        vendorName: booking.vendorName,
        vendorPhone: booking.vendorPhone,
        petName: booking.petName
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
 */
app.get('/make-server-3dd53475/chat/booking/:bookingId/stream', async (c) => {
  const { bookingId } = c.req.param();
  
  return streamSSE(c, async (stream) => {
    let lastMessageCount = 0;
    
    // Initial fetch to set baseline
    const initialMessages = await kv.get(`chat:booking:${bookingId}:messages`) || [];
    lastMessageCount = initialMessages.length;
    
    await stream.writeSSE({
      data: JSON.stringify({ status: 'connected', bookingId }),
      event: 'connected',
    });

    // Poll for new messages
    const interval = setInterval(async () => {
      try {
        const messages = await kv.get(`chat:booking:${bookingId}:messages`) || [];
        
        if (messages.length > lastMessageCount) {
          // Get only new messages
          const newMessages = messages.slice(lastMessageCount);
          lastMessageCount = messages.length;
          
          for (const msg of newMessages) {
             await stream.writeSSE({
               data: JSON.stringify(msg),
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
 */
app.post('/make-server-3dd53475/chat/booking/:bookingId/message', async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { senderPhone, senderName, senderType, message, messageType } = await c.req.json();
    
    console.log(`📤 [CHAT-SEND] Sending message to booking: ${bookingId}`);
    
    // Verify booking exists and is completed
    const booking = await kv.get(`booking:${bookingId}`);
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
    if (booking.status === 'completed' && booking.otpVerifiedAt) {
      const completedAt = new Date(booking.otpVerifiedAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 7) {
        return sendError(c, 'Chat window has expired (7 days after completion)', 403);
      }
    }
    
    // Verify sender is part of this booking
    const isCustomer = senderPhone === booking.customerPhone;
    
    // ✅ FLEXIBLE VENDOR CHECK: Check vendorPhone OR if sender is the vendor by ID
    let isVendor = false;
    
    // Method 1: Direct phone match
    if (senderPhone === booking.vendorPhone || 
        senderPhone === booking.vendorMobile ||
        senderPhone === booking.vendorContact) {
      isVendor = true;
    }
    
    // Method 2: Check if senderPhone belongs to the vendorId
    if (!isVendor && booking.vendorId && senderType === 'vendor') {
      // Get vendor data to check phone
      const vendor = await kv.get(`vendor:${booking.vendorId}`);
      if (vendor) {
        const vendorPhones = [
          vendor.phone,
          vendor.mobile,
          vendor.contact,
          vendor.phoneNumber
        ].filter(Boolean);
        
        if (vendorPhones.some(p => p === senderPhone)) {
          isVendor = true;
          // ✅ STORE vendor phone in booking for future checks
          booking.vendorPhone = senderPhone;
          await kv.set(`booking:${bookingId}`, booking);
        }
      }
    }
    
    // Debug logging
    console.log(`🔍 [CHAT-SEND] Authorization check:`, {
      senderPhone,
      senderType,
      customerPhone: booking.customerPhone,
      vendorPhone: booking.vendorPhone,
      vendorId: booking.vendorId,
      isCustomer,
      isVendor
    });
    
    if (!isCustomer && !isVendor) {
      return sendError(c, 'Unauthorized sender', 403, {
        debug: {
          senderPhone,
          expectedCustomer: booking.customerPhone,
          expectedVendor: booking.vendorPhone || 'Not set',
          vendorId: booking.vendorId
        }
      });
    }
    
    // Create message
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newMessage = {
      id: messageId,
      bookingId: bookingId,
      senderPhone: senderPhone,
      senderName: senderName,
      senderType: senderType, // 'customer' or 'vendor'
      message: message,
      messageType: messageType || 'text', // 'text', 'image', 'file'
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Get existing messages
    const messagesKey = `chat:booking:${bookingId}:messages`;
    const messages = await kv.get(messagesKey) || [];
    messages.push(newMessage);
    
    // Save updated messages
    await kv.set(messagesKey, messages);
    console.log(`✅ [CHAT-SEND] Message saved: ${messageId}`);
    
    // Update last message timestamp
    await kv.set(`chat:booking:${bookingId}:lastActivity`, new Date().toISOString());
    
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
      console.log(`📬 [CHAT-SEND] Creating notification for vendor: ${vendorId}`);
      
      const vendorNotifications = await kv.get(`vendor:${vendorId}:notifications`) || [];
      vendorNotifications.unshift(notificationId);
      await kv.set(`vendor:${vendorId}:notifications`, vendorNotifications);
    } else {
      // Vendor sent message → Notify customer
      const customerPhone = booking.customerPhone.replace(/[^0-9]/g, '');
      console.log(`📬 [CHAT-SEND] Creating notification for customer: ${customerPhone}`);
      
      const customerNotifications = await kv.get(`customer:${customerPhone}:notifications`) || [];
      customerNotifications.unshift(notificationId);
      await kv.set(`customer:${customerPhone}:notifications`, customerNotifications);
    }

    console.log(`✅ [CHAT-SEND] Notification created: ${notificationId}`);
    
    return sendSuccess(c, {
      messageId,
      message: newMessage,
      notificationId
    });
    
  } catch (error) {
    console.error('❌ [CHAT-SEND] Error sending message:', error);
    return sendError(c, error, 500);
  }
});

/**
 * PUT /make-server-3dd53475/chat/booking/:bookingId/read
 * Mark messages as read
 */
app.put('/make-server-3dd53475/chat/booking/:bookingId/read', async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { readerPhone } = await c.req.json();
    
    console.log(`✓ [CHAT-READ] Marking messages as read for: ${readerPhone}`);
    
    const messagesKey = `chat:booking:${bookingId}:messages`;
    const messages = await kv.get(messagesKey) || [];
    
    // Mark messages as read where sender is NOT the reader
    const updatedMessages = messages.map((msg: any) => {
      if (msg.senderPhone !== readerPhone && !msg.read) {
        return { ...msg, read: true, readAt: new Date().toISOString() };
      }
      return msg;
    });
    
    await kv.set(messagesKey, updatedMessages);
    
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
 */
app.get('/make-server-3dd53475/chat/customer/:customerPhone', async (c) => {
  try {
    const { customerPhone } = c.req.param();
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    
    console.log(`📱 [CHAT-LIST] Fetching chats for customer: ${cleanPhone}`);
    
    // Get customer's bookings
    const bookingIds = await kv.get(`customer:bookings:${cleanPhone}`) || [];
    
    const activeChats = [];
    
    for (const bookingId of bookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      
      // Only include completed bookings within 7 days
      if (booking && booking.status === 'completed' && booking.otpVerifiedAt) {
        const completedAt = new Date(booking.otpVerifiedAt);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 7) {
          const messages = await kv.get(`chat:booking:${bookingId}:messages`) || [];
          const lastActivity = await kv.get(`chat:booking:${bookingId}:lastActivity`);
          
          // Count unread messages
          const unreadCount = messages.filter((msg: any) => 
            msg.senderPhone !== cleanPhone && !msg.read
          ).length;
          
          activeChats.push({
            bookingId: booking.id,
            vendorName: booking.vendorName,
            vendorPhone: booking.vendorPhone,
            petName: booking.petName,
            serviceName: booking.serviceName,
            lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
            lastActivity: lastActivity || booking.otpVerifiedAt,
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
 */
app.get('/make-server-3dd53475/chat/vendor/:vendorPhone', async (c) => {
  try {
    const { vendorPhone } = c.req.param();
    const cleanPhone = vendorPhone.replace(/[^0-9]/g, '');
    
    console.log(`👨‍⚕️ [VENDOR-CHAT-LIST] Fetching chats for vendor: ${cleanPhone}`);
    
    // Get vendor ID
    const vendorId = await kv.get(`vendor:phone:${cleanPhone}`);
    if (!vendorId) {
      return sendError(c, 'Vendor not found', 404);
    }
    
    // Get vendor's bookings
    const bookingIds = await kv.get(`vendor:${vendorId}:bookings`) || [];
    
    const activeChats = [];
    
    for (const bookingId of bookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      
      // Only include completed bookings within 7 days
      if (booking && booking.status === 'completed' && booking.otpVerifiedAt) {
        const completedAt = new Date(booking.otpVerifiedAt);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 7) {
          const messages = await kv.get(`chat:booking:${bookingId}:messages`) || [];
          const lastActivity = await kv.get(`chat:booking:${bookingId}:lastActivity`);
          
          // Count unread messages
          const unreadCount = messages.filter((msg: any) => 
            msg.senderPhone !== cleanPhone && !msg.read
          ).length;
          
          activeChats.push({
            bookingId: booking.id,
            customerName: booking.customerName,
            customerPhone: booking.customerPhone,
            petName: booking.petName,
            serviceName: booking.serviceName,
            lastMessage: messages.length > 0 ? messages[messages.length - 1] : null,
            lastActivity: lastActivity || booking.otpVerifiedAt,
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
    
    // Verify booking exists
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    // Determine file type category
    let fileCategory = 'file';
    if (file.type.startsWith('image/')) {
      fileCategory = 'image';
    } else if (file.type.startsWith('video/')) {
      fileCategory = 'video';
    } else if (file.type === 'application/pdf') {
      fileCategory = 'pdf';
    }
    
    // Convert file to base64 for storage in KV
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
    
    // Create file ID and store file data
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const fileData = {
      id: fileId,
      bookingId: bookingId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileCategory: fileCategory,
      base64Data: base64,
      uploadedBy: senderPhone,
      uploadedByName: senderName,
      uploadedAt: new Date().toISOString()
    };
    
    // Store file data
    await kv.set(`chat:file:${fileId}`, fileData);
    console.log(`✅ [CHAT-UPLOAD] File stored: ${fileId}`);
    
    // Create chat message with file attachment
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newMessage = {
      id: messageId,
      bookingId: bookingId,
      senderPhone: senderPhone,
      senderName: senderName,
      senderType: senderType,
      message: caption || `Sent a ${fileCategory}`,
      messageType: fileCategory,
      fileId: fileId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Add message to chat
    const messagesKey = `chat:booking:${bookingId}:messages`;
    const messages = await kv.get(messagesKey) || [];
    messages.push(newMessage);
    await kv.set(messagesKey, messages);
    
    // Update last activity
    await kv.set(`chat:booking:${bookingId}:lastActivity`, new Date().toISOString());
    
    console.log(`✅ [CHAT-UPLOAD] Chat message created with file: ${messageId}`);
    
    return sendSuccess(c, {
      messageId: messageId,
      fileId: fileId,
      message: newMessage
    });
    
  } catch (error) {
    console.error('❌ [CHAT-UPLOAD] Error uploading file:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/chat/file/:fileId
 * Download/view a chat file
 */
app.get('/make-server-3dd53475/chat/file/:fileId', async (c) => {
  try {
    const { fileId } = c.req.param();
    
    console.log(`📥 [CHAT-DOWNLOAD] Fetching file: ${fileId}`);
    
    const fileData = await kv.get(`chat:file:${fileId}`);
    if (!fileData) {
      return sendError(c, 'File not found', 404);
    }
    
    // Convert base64 back to binary
    const binaryString = atob(fileData.base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log(`✅ [CHAT-DOWNLOAD] Serving file: ${fileData.fileName}`);
    
    // Return file with appropriate content type
    return new Response(bytes, {
      headers: {
        'Content-Type': fileData.fileType,
        'Content-Disposition': `inline; filename="${fileData.fileName}"`,
        'Content-Length': fileData.fileSize.toString()
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
 */
app.get('/make-server-3dd53475/chat/messages/:bookingId', async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    console.log(`💬 [CHAT] Fetching messages for booking: ${bookingId}`);
    
    const messages = await kv.get(`chat:booking:${bookingId}:messages`) || [];
    
    console.log(`✅ [CHAT] Found ${messages.length} messages`);
    
    return sendSuccess(c, { messages });
    
  } catch (error) {
    console.error('❌ [CHAT] Error fetching messages:', error);
    return sendError(c, error, 500);
  }
});

/**
 * POST /make-server-3dd53475/chat/send
 * Send a message (simplified endpoint for follow-up)
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
    
    // Create message
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newMessage = {
      id: messageId,
      bookingId: bookingId,
      senderPhone: senderPhone,
      senderName: senderName,
      senderType: senderType,
      message: message,
      messageType: messageType || 'text',
      timestamp: new Date().toISOString(),
      read: false
    };
    
    // Add to messages
    const messagesKey = `chat:booking:${bookingId}:messages`;
    const messages = await kv.get(messagesKey) || [];
    messages.push(newMessage);
    await kv.set(messagesKey, messages);
    
    // Update last activity
    await kv.set(`chat:booking:${bookingId}:lastActivity`, new Date().toISOString());
    
    // Create notification for receiver
    const notificationId = `notification_${Date.now()}`;
    const notification = {
      id: notificationId,
      type: 'chat_message',
      title: `New message from ${senderName}`,
      message: message.length > 50 ? message.substring(0, 50) + '...' : message,
      bookingId: bookingId,
      senderPhone: senderPhone,
      senderName: senderName,
      senderType: senderType,
      read: false,
      createdAt: new Date().toISOString()
    };
    
    // Store notification based on receiver type
    if (receiverType === 'vendor') {
      // Find vendor ID from booking
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking && booking.vendorId) {
        await kv.set(`notification:${notificationId}`, notification);
        const vendorNotifications = await kv.get(`vendor:${booking.vendorId}:notifications`) || [];
        vendorNotifications.unshift(notificationId);
        await kv.set(`vendor:${booking.vendorId}:notifications`, vendorNotifications);
        console.log(`📬 [CHAT-SEND] Notification created for vendor: ${booking.vendorId}`);
      }
    } else if (receiverType === 'customer') {
      // Store notification for customer
      await kv.set(`notification:${notificationId}`, notification);
      const cleanPhone = receiverPhone.replace(/[^0-9]/g, '');
      const customerNotifications = await kv.get(`customer:${cleanPhone}:notifications`) || [];
      customerNotifications.unshift(notificationId);
      await kv.set(`customer:${cleanPhone}:notifications`, customerNotifications);
      console.log(`📬 [CHAT-SEND] Notification created for customer: ${cleanPhone}`);
    }
    
    console.log(`✅ [CHAT-SEND] Message sent: ${messageId}`);
    
    return sendSuccess(c, {
      messageId: messageId,
      message: newMessage
    });
    
  } catch (error) {
    console.error('❌ [CHAT-SEND] Error:', error);
    return sendError(c, error, 500);
  }
});

}
