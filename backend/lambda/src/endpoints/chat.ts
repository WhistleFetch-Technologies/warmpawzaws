/**
 * ============================================================================
 * CHAT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles chat/messaging:
 * - Get conversation for booking
 * - Send messages
 * - Mark messages as read
 * 
 * Note: Requires chat_messages table (create migration if needed)
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { getSnsClient } from '../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { getDiscoveryRules } from '../lib/rule-engine';

export function registerChatEndpoints(app: Hono) {
  /**
   * GET /chat/conversations
   * Vendor booking inbox for the customer (query: customerId and/or phone): non-cancelled bookings
   * with a provider, with or without messages yet. Phone matching is normalized (digits only, last-10).
   */
  app.get("/chat/conversations", async (c) => {
    try {
      const customerPhone = c.req.query('phone') || c.req.header('X-Customer-Phone');
      const customerId = c.req.query('customerId');

      console.log(`💬 [CHAT] Fetching conversations for customer: ${customerId || customerPhone}`);

      const idParam = customerId && isValidUUID(String(customerId).trim()) ? String(customerId).trim() : null;
      const phoneDigits = customerPhone
        ? String(customerPhone).replace(/\D/g, '') || null
        : null;

      // Vendor booking inbox: provider-assigned rows only (no support-only bookings).
      // Lists threads with or without messages so customers can open chat before the first send.
      const conversationsResult = await query(`
        SELECT
          b.id as id,
          'vendor' as participant_type,
          b.vendor_id::text as participant_id,
          COALESCE(v.business_name, v.owner_name, 'Provider') as participant_name,
          v.photo_url as participant_avatar,
          cm.message as last_message,
          cm.created_at as last_message_time,
          COALESCE(unread.count, 0)::int as unread_count,
          b.id as booking_id,
          COALESCE(vs.service_name, b.service_type, 'Service') as booking_service,
          false as is_online
        FROM bookings b
        LEFT JOIN customers cust ON cust.id = b.customer_id
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN vendor_services vs ON b.service_id = vs.id
        LEFT JOIN LATERAL (
          SELECT message, created_at
          FROM chat_messages
          WHERE booking_id = b.id
          ORDER BY created_at DESC
          LIMIT 1
        ) cm ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int as count
          FROM chat_messages
          WHERE booking_id = b.id
            AND is_read = false
            AND sender_type != 'customer'
        ) unread ON true
        WHERE b.vendor_id IS NOT NULL
          AND lower(trim(COALESCE(b.status::text, ''))) NOT IN ('cancelled', 'no_show')
          AND (
            ($1::uuid IS NOT NULL AND b.customer_id = $1::uuid)
            OR (
              $1::uuid IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM customers c_self
                WHERE c_self.id = $1::uuid
                  AND EXISTS (
                    SELECT 1 FROM chat_messages msg_c
                    WHERE msg_c.booking_id = b.id
                      AND lower(coalesce(trim(msg_c.sender_type::text), '')) = 'customer'
                      AND (
                        regexp_replace(COALESCE(msg_c.sender_phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(c_self.phone, ''), '[^0-9]', '', 'g')
                        OR right(regexp_replace(COALESCE(msg_c.sender_phone, ''), '[^0-9]', '', 'g'), 10) = right(regexp_replace(COALESCE(c_self.phone, ''), '[^0-9]', '', 'g'), 10)
                      )
                  )
              )
            )
            OR (
              $2::text IS NOT NULL AND length($2::text) >= 8
              AND (
                regexp_replace(COALESCE(b.customer_phone, ''), '[^0-9]', '', 'g') = $2
                OR right(regexp_replace(COALESCE(b.customer_phone, ''), '[^0-9]', '', 'g'), 10) = right($2, 10)
                OR regexp_replace(COALESCE(cust.phone, ''), '[^0-9]', '', 'g') = $2
                OR right(regexp_replace(COALESCE(cust.phone, ''), '[^0-9]', '', 'g'), 10) = right($2, 10)
                OR EXISTS (
                  SELECT 1 FROM chat_messages cm0
                  WHERE cm0.booking_id = b.id
                    AND lower(coalesce(trim(cm0.sender_type::text), '')) = 'customer'
                    AND (
                      regexp_replace(COALESCE(cm0.sender_phone, ''), '[^0-9]', '', 'g') = $2
                      OR right(regexp_replace(COALESCE(cm0.sender_phone, ''), '[^0-9]', '', 'g'), 10) = right($2, 10)
                    )
                )
                OR EXISTS (
                  SELECT 1 FROM chat_messages cm1
                  WHERE cm1.booking_id = b.id
                    AND (
                      regexp_replace(COALESCE(cm1.sender_phone, ''), '[^0-9]', '', 'g') = $2
                      OR right(regexp_replace(COALESCE(cm1.sender_phone, ''), '[^0-9]', '', 'g'), 10) = right($2, 10)
                    )
                )
              )
            )
          )
        ORDER BY COALESCE(cm.created_at, b.booking_date::timestamptz, b.created_at::timestamptz) DESC NULLS LAST
        LIMIT 50
      `, [idParam, phoneDigits]).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        conversations: conversationsResult.rows || [],
      });
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      return c.json({ success: true, conversations: [] });
    }
  });

  /**
   * GET /chat/vendor/:vendorId/unread-count
   * Total count of unread chat messages from customers across all vendor bookings.
   */
  app.get("/chat/vendor/:vendorId/unread-count", async (c) => {
    try {
      const { vendorId } = c.req.param();
      if (!vendorId || !isValidUUID(vendorId)) {
        return c.json({ success: true, totalUnread: 0 });
      }
      const result = await query(
        `SELECT COUNT(*)::int as total
         FROM chat_messages cm
         INNER JOIN bookings b ON b.id = cm.booking_id AND b.vendor_id = $1
         WHERE cm.is_read = false AND cm.sender_type = 'customer'`,
        [vendorId]
      ).catch(() => ({ rows: [{ total: 0 }] }));
      const totalUnread = result.rows?.[0]?.total ?? 0;
      return c.json({ success: true, totalUnread });
    } catch (error: any) {
      console.error('Error fetching vendor chat unread count:', error);
      return c.json({ success: true, totalUnread: 0 });
    }
  });

  /**
   * GET /chat/vendor/:vendorId/conversations
   * Get all chat conversations for a vendor (bookings that have messages).
   * Returns last message, unread count, booking details, and package utilization when applicable.
   */
  app.get("/chat/vendor/:vendorId/conversations", async (c) => {
    try {
      const { vendorId } = c.req.param();
      if (!vendorId || !isValidUUID(vendorId)) {
        return c.json({ success: true, conversations: [] });
      }
      const conversationsResult = await query(`
        SELECT
          b.id as booking_id,
          b.booking_date,
          b.booking_time,
          b.status as booking_status,
          b.service_type,
          b.package_purchase_id,
          COALESCE(vs.service_name, b.service_type::text, 'Service') as service_name,
          c.full_name as customer_name,
          c.phone as customer_phone,
          last_msg.message as last_message,
          last_msg.created_at as last_message_at,
          COALESCE(unread_cnt.cnt, 0)::int as unread_count,
          pp.package_name as package_name,
          pp.total_sessions as package_total_sessions,
          pp.remaining_sessions as package_remaining_sessions,
          pp.unlimited_usage as package_unlimited,
          pp.expires_at as package_expires_at
        FROM bookings b
        INNER JOIN (SELECT DISTINCT booking_id FROM chat_messages) has_msg ON has_msg.booking_id = b.id
        LEFT JOIN LATERAL (
          SELECT message, created_at FROM chat_messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1
        ) last_msg ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int as cnt FROM chat_messages
          WHERE booking_id = b.id AND is_read = false AND sender_type = 'customer'
        ) unread_cnt ON true
        LEFT JOIN vendor_services vs ON b.service_id = vs.id
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN package_purchases pp ON b.package_purchase_id = pp.id
        WHERE b.vendor_id = $1
        ORDER BY last_msg.created_at DESC NULLS LAST
        LIMIT 100
      `, [vendorId]).catch((e: any) => {
        console.error('Vendor conversations query error:', e);
        return { rows: [] };
      });

      const rows = conversationsResult.rows || [];
      const conversations = rows.map((r: any) => ({
        bookingId: r.booking_id,
        bookingDate: r.booking_date,
        bookingTime: r.booking_time,
        bookingStatus: r.booking_status,
        serviceType: r.service_type,
        serviceName: r.service_name,
        customerName: r.customer_name || 'Customer',
        customerPhone: r.customer_phone,
        lastMessage: r.last_message || '',
        lastMessageAt: r.last_message_at,
        unreadCount: r.unread_count ?? 0,
        packageUtilization: (r.package_purchase_id && (r.package_total_sessions != null || r.package_unlimited)) ? {
          packageName: r.package_name,
          totalSessions: r.package_total_sessions,
          remainingSessions: r.package_remaining_sessions,
          usedSessions: (r.package_total_sessions != null && r.package_remaining_sessions != null)
            ? r.package_total_sessions - r.package_remaining_sessions : null,
          isUnlimited: r.package_unlimited,
          expiresAt: r.package_expires_at,
        } : null,
      }));

      return c.json({ success: true, conversations });
    } catch (error: any) {
      console.error('Error fetching vendor conversations:', error);
      return c.json({ success: true, conversations: [] });
    }
  });

  /**
   * GET /chat/customer/:customerId/conversations
   * Inbox for the customer app: vendor bookings for this customer (with or without messages yet).
   */
  app.get("/chat/customer/:customerId/conversations", async (c) => {
    try {
      const { customerId } = c.req.param();
      if (!customerId || !isValidUUID(customerId)) {
        return c.json({ success: true, conversations: [] });
      }
      const conversationsResult = await query(
        `SELECT
          b.id as id,
          b.id as booking_id,
          'vendor' as participant_type,
          b.vendor_id::text as participant_id,
          COALESCE(v.business_name, v.owner_name, 'Provider') as participant_name,
          v.photo_url as participant_avatar,
          last_msg.message as last_message,
          last_msg.created_at as last_message_time,
          COALESCE(unread_cnt.cnt, 0)::int as unread_count,
          COALESCE(vs.service_name, b.service_type, 'Service') as booking_service,
          false as is_online
         FROM bookings b
         INNER JOIN (SELECT id, phone FROM customers WHERE id = $1::uuid LIMIT 1) me ON (true)
         LEFT JOIN LATERAL (
           SELECT message, created_at FROM chat_messages WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1
         ) last_msg ON true
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int as cnt FROM chat_messages
           WHERE booking_id = b.id AND is_read = false AND sender_type != 'customer'
         ) unread_cnt ON true
         LEFT JOIN vendors v ON b.vendor_id = v.id
         LEFT JOIN vendor_services vs ON b.service_id = vs.id
         WHERE b.vendor_id IS NOT NULL
           AND lower(trim(COALESCE(b.status::text, ''))) NOT IN ('cancelled', 'no_show')
           AND (
           b.customer_id = me.id
           OR (
             length(regexp_replace(COALESCE(me.phone, ''), '[^0-9]', '', 'g')) >= 8
             AND (
               regexp_replace(COALESCE(b.customer_phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(me.phone, ''), '[^0-9]', '', 'g')
               OR right(regexp_replace(COALESCE(b.customer_phone, ''), '[^0-9]', '', 'g'), 10) = right(regexp_replace(COALESCE(me.phone, ''), '[^0-9]', '', 'g'), 10)
             )
           )
           OR EXISTS (
             SELECT 1 FROM chat_messages m2
             WHERE m2.booking_id = b.id
               AND lower(trim(m2.sender_type::text)) = 'customer'
               AND (
                 regexp_replace(COALESCE(m2.sender_phone, ''), '[^0-9]', '', 'g') = regexp_replace(COALESCE(me.phone, ''), '[^0-9]', '', 'g')
                 OR right(regexp_replace(COALESCE(m2.sender_phone, ''), '[^0-9]', '', 'g'), 10) = right(regexp_replace(COALESCE(me.phone, ''), '[^0-9]', '', 'g'), 10)
               )
           )
         )
         ORDER BY COALESCE(last_msg.created_at, b.booking_date::timestamptz, b.created_at::timestamptz) DESC NULLS LAST
         LIMIT 100`,
        [customerId]
      ).catch((e: any) => {
        console.error('Customer conversations query error:', e);
        return { rows: [] };
      });
      return c.json({
        success: true,
        conversations: conversationsResult.rows || [],
      });
    } catch (error: any) {
      console.error('Error fetching customer conversations:', error);
      return c.json({ success: true, conversations: [] });
    }
  });

  /**
   * GET /chat/conversations/:conversationId/messages
   * Get messages for a specific conversation (booking)
   */
  app.get("/chat/conversations/:conversationId/messages", async (c) => {
    try {
      const { conversationId } = c.req.param();

      const messages = await query(`
        SELECT 
          id,
          booking_id as conversation_id,
          sender_type,
          sender_phone as sender_id,
          message as content,
          message_type as content_type,
          COALESCE(file_id, '') as attachment_url,
          COALESCE(file_name, '') as attachment_name,
          created_at,
          read_at
        FROM chat_messages
        WHERE booking_id = $1
        ORDER BY created_at ASC
      `, [conversationId]).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        messages: messages.rows || [],
      });
    } catch (error: any) {
      console.error('Error fetching conversation messages:', error);
      return c.json({ success: true, messages: [] });
    }
  });

  /**
   * POST /chat/conversations/:conversationId/messages
   * Send a message to a conversation
   */
  app.post("/chat/conversations/:conversationId/messages", async (c) => {
    try {
      const { conversationId } = c.req.param();
      const { content, content_type, sender_phone, sender_type } = await c.req.json();

      if (!content) {
        return c.json({ error: 'content is required' }, 400);
      }

      const customerPhone = sender_phone || c.req.header('X-Customer-Phone');

      const newMessage = await insert('chat_messages', {
        booking_id: conversationId,
        sender_phone: customerPhone || 'unknown',
        sender_type: sender_type || 'customer',
        message: content,
        message_type: content_type || 'text',
        is_read: false,
      }).catch(() => [{
        id: `msg_${Date.now()}`,
        booking_id: conversationId,
        message: content,
        created_at: new Date().toISOString(),
      }]);

      return c.json({
        success: true,
        message: newMessage[0],
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /chat/conversations/:conversationId/read
   * Mark all messages in conversation as read
   */
  app.post("/chat/conversations/:conversationId/read", async (c) => {
    try {
      const { conversationId } = c.req.param();

      await query(`
        UPDATE chat_messages 
        SET is_read = true, read_at = NOW()
        WHERE booking_id = $1 AND is_read = false AND sender_type != 'customer'
      `, [conversationId]).catch(() => {});

      return c.json({ success: true });
    } catch (error: any) {
      console.error('Error marking as read:', error);
      return c.json({ success: true });
    }
  });

  /**
   * GET /chat/:bookingId/messages
   * Get chat messages for a booking (frontend expected format)
   */
  app.get("/chat/:bookingId/messages", async (c) => {
    try {
      const { bookingId } = c.req.param();

      console.log(`💬 [CHAT] Fetching messages for booking: ${bookingId}`);

      // Validate UUID
      if (!isValidUUID(bookingId)) {
        return c.json({ success: true, messages: [], total: 0 });
      }

      // Get messages
      const messages = await query(
        `SELECT id, booking_id as "bookingId", sender_phone as "senderId", 
                sender_type as "senderType", message as content, 
                created_at as timestamp, is_read as "isRead"
         FROM chat_messages
         WHERE booking_id = $1
         ORDER BY created_at ASC`,
        [bookingId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        messages: messages.rows || [],
        total: messages.rows?.length || 0,
      });
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      return c.json({ success: true, messages: [], total: 0 });
    }
  });

  /**
   * POST /chat/:bookingId/send
   * Send a chat message (frontend expected format)
   */
  app.post("/chat/:bookingId/send", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { message, senderType, senderId } = await c.req.json();

      console.log(`💬 [CHAT] Sending message to booking: ${bookingId}`);

      if (!message) {
        return c.json({ error: 'message is required' }, 400);
      }

      // Validate UUID
      if (!isValidUUID(bookingId)) {
        return c.json({ error: 'Invalid booking ID' }, 400);
      }

      // Verify booking exists
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Create message
      const newMessage = await insert('chat_messages', {
        booking_id: bookingId,
        sender_phone: senderId || 'unknown',
        sender_type: senderType || 'vendor',
        message: message,
        message_type: 'text',
        is_read: false,
      }).catch((err) => {
        console.error('Error inserting message:', err);
        // Return mock message if table doesn't exist
        return [{
          id: `msg_${Date.now()}`,
          booking_id: bookingId,
          sender_phone: senderId,
          sender_type: senderType,
          message: message,
          created_at: new Date().toISOString(),
        }];
      });

      return c.json({
        success: true,
        message: newMessage[0],
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /chat/booking/:bookingId/conversation
   * Get chat conversation for a booking
   */
  app.get("/chat/booking/:bookingId/conversation", async (c) => {
    try {
      const { bookingId } = c.req.param();

      // Handle test IDs - return empty conversation
      if (bookingId === 'test-booking-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
        return c.json({
          success: true,
          bookingId,
          messages: [],
          total: 0,
        });
      }

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // ✅ Rule engine: Chat availability (chat_available_days_post_appointment per role)
      let isChatAvailable = true;
      if (booking.status === 'cancelled') {
        isChatAvailable = false;
      } else if (booking.status === 'completed' && booking.updated_at) {
        let roleName = 'all';
        if (booking.vendor_id) {
          const vendorResult = await select('vendors', { id: booking.vendor_id });
          if (vendorResult.length > 0 && vendorResult[0].role_id) {
            const roleResult = await query('SELECT name FROM roles WHERE id = $1', [vendorResult[0].role_id]);
            if (roleResult.rows.length > 0) roleName = roleResult.rows[0].name || 'all';
          }
        }
        const rules = await getDiscoveryRules(roleName, 'chat');
        const chatDays = rules.chat_available_days_post_appointment ?? 7;
        const completedDate = new Date(booking.updated_at);
        const daysSinceCompletion = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
        isChatAvailable = daysSinceCompletion <= chatDays;
      }

      // Get messages (assuming chat_messages table exists)
      const messages = await query(
        `SELECT * FROM chat_messages
         WHERE booking_id = $1
         ORDER BY created_at ASC`,
        [bookingId]
      ).catch(() => ({ rows: [] })); // Graceful fallback if table doesn't exist

      // ✅ CRITICAL FIX: Generate presigned URLs for file/image messages
      // file_id stores the S3 key, but frontend needs a file_url to display the file
      const enrichedMessages = await Promise.all(
        (messages.rows || []).map(async (msg: any) => {
          if (msg.file_id && (msg.message_type === 'file' || msg.message_type === 'image' || msg.message_type === 'video')) {
            try {
              const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
              const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
              const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
              const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
              
              const signedUrl = await getSignedUrl(
                s3Client,
                new GetObjectCommand({ Bucket: BUCKET_NAME, Key: msg.file_id }),
                { expiresIn: 604800 } // 7 days
              );
              return { ...msg, file_url: signedUrl };
            } catch (err: any) {
              console.warn(`[CHAT] Failed to generate presigned URL for file_id=${msg.file_id}: ${err?.message}`);
              return msg;
            }
          }
          return msg;
        })
      );

      // Get customer and vendor details
      const customer = booking.customer_id
        ? await select('customers', { id: booking.customer_id })
        : [];
      const vendor = booking.vendor_id
        ? await select('vendors', { id: booking.vendor_id })
        : [];

      return c.json({
        success: true,
        messages: enrichedMessages,
        chatAvailable: isChatAvailable, // ✅ CRITICAL FIX: Include chat availability
        booking: {
          id: booking.id,
          status: booking.status || 'pending',
          completed_at: booking.completed_at || booking.updated_at || null,
          completedAt: booking.completed_at || booking.updated_at || null,
          service_type: booking.service_type || null,
          booking_date: booking.booking_date || null,
          booking_time: booking.booking_time || null,
          customerName: customer[0]?.full_name || customer[0]?.name || null,
          customerPhone: customer[0]?.phone || null,
          vendorName: vendor[0]?.business_name || vendor[0]?.name || null,
          vendorPhone: vendor[0]?.phone || null,
        },
      });
    } catch (error: any) {
      console.error('Error fetching conversation:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /chat/booking/:bookingId/message
   * Send a message in booking chat
   */
  app.post("/chat/booking/:bookingId/message", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { senderPhone, senderName, senderType, message, messageType, fileId, fileName } = await c.req.json();

      if (!senderPhone || !message) {
        return c.json({ error: 'senderPhone and message are required' }, 400);
      }

      // Verify booking exists
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Create message (assuming chat_messages table exists)
      const newMessage = await insert('chat_messages', {
        booking_id: bookingId,
        sender_phone: senderPhone,
        sender_name: senderName || null,
        sender_type: senderType || 'customer',
        message: message,
        message_type: messageType || 'text',
        file_id: fileId || null,
        file_name: fileName || null,
        is_read: false,
      }).catch(() => {
        // Fallback: return mock message if table doesn't exist
        return [{
          id: `msg_${Date.now()}`,
          booking_id: bookingId,
          sender_phone: senderPhone,
          message: message,
          created_at: new Date().toISOString(),
        }];
      });

      // In-app notification for vendor when customer sends a message
      const effectiveSenderType = (senderType || 'customer').toLowerCase();
      if (effectiveSenderType === 'customer' && booking.vendor_id) {
        try {
          await insert('notifications', {
            recipient_id: booking.vendor_id,
            recipient_type: 'vendor',
            notification_type: 'chat_message',
            title: 'New chat message',
            message: `${senderName || senderPhone}: ${(message || '').substring(0, 80)}${(message || '').length > 80 ? '…' : ''}`,
            channels: { email: false, sms: false, inApp: true, push: false },
            is_read: false,
          });
        } catch (notifErr) {
          console.warn('Failed to create vendor notification for chat message:', notifErr);
        }
      }

      // Notify recipient via SNS
      const recipientPhone = senderType === 'customer'
        ? (await select('vendors', { id: booking.vendor_id }))[0]?.phone
        : (await select('customers', { id: booking.customer_id }))[0]?.phone;

      if (recipientPhone) {
        const snsClient = getSnsClient();
        await snsClient.send(new PublishCommand({
          PhoneNumber: recipientPhone,
          Message: `New message from ${senderName || senderPhone}: ${message.substring(0, 100)}`,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
          },
        })).catch(err => console.error('SNS notification failed:', err));
      }

      return c.json({
        success: true,
        message: newMessage[0],
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /chat/messages/:messageId/read
   * Mark message as read
   */
  app.put("/chat/messages/:messageId/read", async (c) => {
    try {
      const { messageId } = c.req.param();

      await update('chat_messages',
        { id: messageId },
        {
          is_read: true,
          read_at: new Date().toISOString(),
        }
      ).catch(() => {
        // Graceful fallback if table doesn't exist
        return [];
      });

      return c.json({
        success: true,
        message: 'Message marked as read',
      });
    } catch (error: any) {
      console.error('Error marking message as read:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /chat/mark-read/:bookingId
   * Mark all messages for a booking as read (e.g. when vendor opens chat).
   * Frontend: VendorBookingCard calls this with { vendorId }.
   */
  app.post("/chat/mark-read/:bookingId", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const body = await c.req.json().catch(() => ({})) as { vendorId?: string };
      if (!isValidUUID(bookingId)) {
        return c.json({ success: true, message: 'No messages to mark' });
      }
      await query(
        `UPDATE chat_messages SET is_read = true, read_at = COALESCE(read_at, NOW()) WHERE booking_id = $1 AND is_read = false`,
        [bookingId]
      ).catch(() => ({ rowCount: 0 }));
      return c.json({ success: true, message: 'Messages marked as read' });
    } catch (error: any) {
      console.error('Error marking booking chat as read:', error);
      return c.json({ success: true, message: 'Messages marked as read' });
    }
  });

  /**
   * POST /chat/send
   * Send a chat message (unified endpoint - handles both booking-based and direct messaging)
   */
  app.post("/chat/send", async (c) => {
    try {
      const body = await c.req.json();
      const { bookingId, senderPhone, senderName, senderType, receiverPhone, receiverName, receiverType, message, messageType, fileId, fileName } = body;

      if (!bookingId || !senderPhone || !message) {
        return c.json({ error: 'bookingId, senderPhone, and message are required' }, 400);
      }

      // Verify booking exists
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Create message
      const newMessage = await insert('chat_messages', {
        booking_id: bookingId,
        sender_phone: senderPhone,
        sender_name: senderName || null,
        sender_type: senderType || 'customer',
        message: message,
        message_type: messageType || 'text',
        is_read: false,
      }).catch(() => {
        return [{
          id: `msg_${Date.now()}`,
          booking_id: bookingId,
          sender_phone: senderPhone,
          message: message,
          created_at: new Date().toISOString(),
        }];
      });

      // Notify recipient via SNS if phone provided
      if (receiverPhone) {
        const snsClient = getSnsClient();
        await snsClient.send(new PublishCommand({
          PhoneNumber: receiverPhone,
          Message: `New message from ${senderName || senderPhone}: ${message.substring(0, 100)}`,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
          },
        })).catch(err => console.error('SNS notification failed:', err));
      }

      return c.json({
        success: true,
        message: newMessage[0],
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /chat/send
   * Send a chat message (alias for /chat/booking/:bookingId/message)
   */
  app.post("/chat/send", async (c) => {
    try {
      const { bookingId, senderPhone, senderName, senderType, message, messageType, fileId, fileName } = await c.req.json();

      if (!bookingId || !senderPhone || !message) {
        return c.json({ error: 'bookingId, senderPhone, and message are required' }, 400);
      }

      // Verify booking exists
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Create message
      const newMessage = await insert('chat_messages', {
        booking_id: bookingId,
        sender_phone: senderPhone,
        sender_name: senderName || null,
        sender_type: senderType || 'customer',
        message: message,
        message_type: messageType || 'text',
        file_id: fileId || null,
        file_name: fileName || null,
        is_read: false,
      }).catch(() => {
        return [{
          id: `msg_${Date.now()}`,
          booking_id: bookingId,
          sender_phone: senderPhone,
          message: message,
          created_at: new Date().toISOString(),
        }];
      });

      // Notify recipient
      const recipientPhone = senderType === 'customer'
        ? (await select('vendors', { id: booking.vendor_id }))[0]?.phone
        : (await select('customers', { id: booking.customer_id }))[0]?.phone;

      if (recipientPhone) {
        const snsClient = getSnsClient();
        if (snsClient) {
          await snsClient.send(new PublishCommand({
            TopicArn: process.env.CHAT_NOTIFICATIONS_TOPIC_ARN,
            Message: JSON.stringify({
              type: 'chat_message',
              bookingId,
              senderPhone,
              recipientPhone,
              message,
            }),
          })).catch(console.error);
        }
      }

      return c.json({
        success: true,
        message: newMessage[0],
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/bookings/:bookingId/messages
   * Get all messages for a booking
   */
  app.get("/customer/bookings/:bookingId/messages", async (c) => {
    try {
      const { bookingId } = c.req.param();

      const messages = await query(
        `SELECT * FROM chat_messages
         WHERE booking_id = $1
         ORDER BY created_at ASC`,
        [bookingId]
      ).catch(() => ({ rows: [] }));

      // ✅ FIX: Generate presigned URLs for file messages (same as /conversation endpoint)
      const enrichedMessages = await Promise.all(
        (messages.rows || []).map(async (msg: any) => {
          if (msg.file_id && (msg.message_type === 'file' || msg.message_type === 'image' || msg.message_type === 'video')) {
            try {
              const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
              const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
              const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
              const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
              
              const signedUrl = await getSignedUrl(
                s3Client,
                new GetObjectCommand({ Bucket: BUCKET_NAME, Key: msg.file_id }),
                { expiresIn: 604800 }
              );
              return { ...msg, file_url: signedUrl };
            } catch (err: any) {
              console.warn(`[CHAT] Failed to generate presigned URL for file_id=${msg.file_id}: ${err?.message}`);
              return msg;
            }
          }
          return msg;
        })
      );

      return c.json({
        success: true,
        messages: enrichedMessages,
      });
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/bookings/:bookingId/messages/unread
   * Get unread messages for a booking
   */
  app.get("/customer/bookings/:bookingId/messages/unread", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const senderPhone = c.req.query('senderPhone');

      let queryText = `SELECT * FROM chat_messages
                       WHERE booking_id = $1 AND is_read = false`;
      const params: any[] = [bookingId];

      if (senderPhone) {
        queryText += ` AND sender_phone != $2`;
        params.push(senderPhone);
      }

      queryText += ` ORDER BY created_at ASC`;

      const messages = await query(queryText, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        messages: messages.rows || [],
      });
    } catch (error: any) {
      console.error('Error fetching unread messages:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /chat/upload-file
   * Upload a file for chat message
   */
  app.post("/chat/upload-file", async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const bookingId = formData.get('bookingId') as string;
      const senderPhone = formData.get('senderPhone') as string;
      const senderName = formData.get('senderName') as string;
      const senderType = formData.get('senderType') as string;
      const caption = formData.get('caption') as string;

      if (!file || !bookingId || !senderPhone) {
        return c.json({ error: 'file, bookingId, and senderPhone are required' }, 400);
      }

      // Upload to S3 (using storage endpoint logic)
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      // Use consistent S3_UPLOADS_BUCKET env var (set by CDK lambda-stack)
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || process.env.CHAT_FILES_BUCKET || 'warmpawz-dev-uploads';
      
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileKey = `chat/${bookingId}/${timestamp}_${file.name}`;

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: uint8Array,
        ContentType: file.type,
      }));

      // Generate presigned URL
      const signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
        }),
        { expiresIn: 604800 } // 7 days (max for presigned URLs)
      );

      // Create chat message with file
      // ✅ CRITICAL FIX: Retry without file_type/file_size if columns don't exist
      const messageText = caption || `Sent a ${file.type.startsWith('image/') ? 'photo' : file.type.startsWith('video/') ? 'video' : 'document'}`;
      const messageTypeVal = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
      
      let newMessage: any[];
      try {
        newMessage = await insert('chat_messages', {
          booking_id: bookingId,
          sender_phone: senderPhone,
          sender_name: senderName || null,
          sender_type: senderType || 'customer',
          message: messageText,
          message_type: messageTypeVal,
          file_id: fileKey,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          is_read: false,
        });
      } catch (insertErr1: any) {
        console.warn('[CHAT] Insert with file_type/file_size failed, retrying without:', insertErr1?.message);
        try {
          // Retry without file_type and file_size (columns may not exist)
          newMessage = await insert('chat_messages', {
            booking_id: bookingId,
            sender_phone: senderPhone,
            sender_name: senderName || null,
            sender_type: senderType || 'customer',
            message: messageText,
            message_type: messageTypeVal,
            file_id: fileKey,
            file_name: file.name,
            is_read: false,
          });
        } catch (insertErr2: any) {
          console.warn('[CHAT] Insert without file_type/file_size also failed, retrying minimal:', insertErr2?.message);
          try {
            // Minimal insert - just the essential fields
            newMessage = await insert('chat_messages', {
              booking_id: bookingId,
              sender_phone: senderPhone,
              sender_type: senderType || 'customer',
              message: messageText,
              message_type: messageTypeVal,
              file_id: fileKey,
              is_read: false,
            });
          } catch (insertErr3: any) {
            console.error('[CHAT] All insert attempts failed:', insertErr3?.message);
            newMessage = [{
              id: `msg_${Date.now()}`,
              booking_id: bookingId,
              file_id: fileKey,
              file_name: file.name,
            }];
          }
        }
      }

      return c.json({
        success: true,
        message: newMessage[0],
        fileUrl: signedUrl,
        fileId: fileKey,
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /chat/file/*
   * Get presigned URL for chat file download
   * Supports both single-segment fileIds and multi-segment S3 keys (e.g., chat/bookingId/filename.pdf)
   * Uses wildcard route to handle fileIds with slashes
   */
  app.get("/chat/file/*", async (c) => {
    try {
      // Extract file key from full path (handles both single and multi-segment fileIds)
      const fullPath = c.req.path;
      let fileId = fullPath.replace('/chat/file/', '');
      
      // Decode URL-encoded fileId (handles %2F for slashes)
      fileId = decodeURIComponent(fileId);

      if (!fileId) {
        return c.json({ error: 'File ID is required' }, 400);
      }

      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      // Use consistent S3_UPLOADS_BUCKET env var (set by CDK lambda-stack)
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || process.env.CHAT_FILES_BUCKET || 'warmpawz-dev-uploads';

      const signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileId,
        }),
        { expiresIn: 3600 } // 1 hour
      );

      // Redirect to presigned URL
      return c.redirect(signedUrl);
    } catch (error: any) {
      console.error('Error getting file URL:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

