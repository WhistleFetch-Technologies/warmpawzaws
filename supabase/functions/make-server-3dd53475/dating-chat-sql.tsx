/**
 * ============================================================================
 * DATING CHAT SERVICE - SQL-ONLY VERSION
 * ============================================================================
 * 
 * Chat functionality for matched users
 * Screen 7: Chat Window
 * 
 * Features:
 * - Text, image, emoji support
 * - Real-time messaging (SQL fallback or AWS Chime)
 * - Message history
 * - Read receipts
 * 
 * Date: 2025-01-23
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDatingRepository } from "../../lib/repositories/dating.ts";
import { getDbClient } from "../../lib/db.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";

export function registerDatingChatSQL(app: Hono) {
  console.log('✅ Registering Dating Chat Service (SQL-only)...');

  const client = getDbClient();
  const datingRepo = getDatingRepository();
  const BASE = '/make-server-3dd53475';

  /**
   * POST /dating/chat/send-message
   * Send a chat message
   */
  app.post(`${BASE}/dating/chat/send-message`, async (c) => {
    try {
      const { matchId, senderId, messageType, content, mediaUrl } = await c.req.json();

      if (!matchId || !senderId || !content) {
        return sendError(c, 'Missing required fields: matchId, senderId, content', 400);
      }

      // ✅ SQL: Verify match and chat is unlocked
      const match = await datingRepo.findMatchByMatchId(matchId);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      if (!match.chat_unlocked) {
        return sendError(c, 'Chat is locked. Subscription required.', 403);
      }

      // Verify sender is part of match
      if (match.customer1_id !== senderId && match.customer2_id !== senderId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Save message
      const { data: message, error } = await client
        .from('dating_chat_messages')
        .insert({
          match_id: match.id,
          sender_id: senderId,
          message_type: messageType || 'text',
          content,
          media_url: mediaUrl || null,
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving message:', error);
        return sendError(c, `Failed to send message: ${error.message}`, 500);
      }

      // Send notification to recipient
      const recipientId = match.customer1_id === senderId ? match.customer2_id : match.customer1_id;
      const customersRepo = getCustomersRepository();
      const sender = await customersRepo.findById(senderId);
      
      const { getNotificationsRepository } = await import('../../lib/repositories/notifications.ts');
      const notificationsRepo = getNotificationsRepository();
      await notificationsRepo.create({
        recipient_id: recipientId,
        recipient_type: 'customer',
        notification_type: 'dating_message',
        title: `New message from ${sender?.full_name || 'Match'}`,
        message: content.length > 50 ? content.substring(0, 50) + '...' : content,
        data: { matchId, messageId: message.id },
      });

      return sendSuccess(c, { message }, 'Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /dating/chat/messages/:matchId
   * Get chat messages for a match
   */
  app.get(`${BASE}/dating/chat/messages/:matchId`, async (c) => {
    try {
      const { matchId } = c.req.param();
      const customerId = c.req.query('customerId');
      const limit = parseInt(c.req.query('limit') || '50');

      if (!customerId) {
        return sendError(c, 'customerId query parameter required', 400);
      }

      // ✅ SQL: Verify match and access
      const match = await datingRepo.findMatchByMatchId(matchId);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      if (match.customer1_id !== customerId && match.customer2_id !== customerId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Get messages
      const { data: messages, error } = await client
        .from('dating_chat_messages')
        .select('*')
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        return sendError(c, `Failed to fetch messages: ${error.message}`, 500);
      }

      // Mark messages as read
      if (messages && messages.length > 0) {
        const unreadMessageIds = messages
          .filter((m: any) => !m.is_read && m.sender_id !== customerId)
          .map((m: any) => m.id);

        if (unreadMessageIds.length > 0) {
          await client
            .from('dating_chat_messages')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .in('id', unreadMessageIds);
        }
      }

      return sendSuccess(c, { 
        messages: (messages || []).reverse(), // Reverse to show oldest first
        count: messages?.length || 0 
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /dating/chat/mark-read
   * Mark messages as read
   */
  app.post(`${BASE}/dating/chat/mark-read`, async (c) => {
    try {
      const { matchId, customerId, messageIds } = await c.req.json();

      if (!matchId || !customerId) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Verify match
      const match = await datingRepo.findMatchByMatchId(matchId);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // ✅ SQL: Mark messages as read
      let query = client
        .from('dating_chat_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('match_id', match.id)
        .neq('sender_id', customerId); // Only mark messages not sent by this user

      if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
        query = query.in('id', messageIds);
      }

      const { error } = await query;

      if (error) {
        return sendError(c, `Failed to mark messages as read: ${error.message}`, 500);
      }

      return sendSuccess(c, { message: 'Messages marked as read' });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Dating Chat Service (SQL-only) registered successfully');
}

