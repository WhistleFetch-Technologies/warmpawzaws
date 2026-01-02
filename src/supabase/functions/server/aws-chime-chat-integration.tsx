// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { getDbClient } from '../../../supabase/lib/db';

/**
 * AWS Chime Chat Integration
 * 
 * Real-time chat for video consultations using AWS Chime SDK Messaging
 * 
 * Features:
 * - Send/receive messages during consultations
 * - Message history
 * - Read receipts
 * - Typing indicators
 * - File attachments (planned)
 * 
 * Note: This is a simplified implementation using KV store.
 * For production with AWS Chime SDK Messaging, additional AWS SDK setup required.
 */

export function registerAWSChimeChatEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * POST /video/consultation/:id/chat/send
   * Send a chat message
   */
  app.post(`${BASE_PATH}/video/consultation/:id/chat/send`, async (c) => {
    try {
      const { id } = c.req.param();
      const { senderId, senderName, senderType, message } = await c.req.json();

      // Validate auth
      const authHeader = c.req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
      }

      // ✅ SQL: Get consultation (stored as booking with consultation type)
      const db = getDbClient();
      const { data: consultation } = await db
        .from('bookings')
        .select('*')
        .eq('id', id)
        .eq('service_type', 'tele_consultation')
        .single();
      
      if (!consultation) {
        return c.json({ success: false, error: 'Consultation not found' }, 404);
      }

      // Create message
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const chatMessage = {
        id: messageId,
        consultationId: id,
        senderId,
        senderName,
        senderType, // 'customer' or 'vendor'
        message,
        timestamp: new Date().toISOString(),
        read: false
      };

      // ✅ SQL: Store message
      await db
        .from('chat_messages')
        .insert({
          id: messageId,
          consultation_id: id,
          sender_id: senderId,
          sender_name: senderName,
          sender_type: senderType,
          message,
          timestamp: new Date().toISOString(),
          read: false,
          created_at: new Date().toISOString()
        });

      console.log(`💬 [Chat] Message sent in consultation ${id}`);

      return c.json({
        success: true,
        message: chatMessage
      });
    } catch (error) {
      console.error('❌ [Chat] Error sending message:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * GET /video/consultation/:id/chat/messages
   * Get chat message history
   */
  app.get(`${BASE_PATH}/video/consultation/:id/chat/messages`, async (c) => {
    try {
      const { id } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50');

      // ✅ SQL: Get messages
      const { data: messages } = await db
        .from('chat_messages')
        .select('*')
        .eq('consultation_id', id)
        .order('timestamp', { ascending: false })
        .limit(limit);

      return c.json({
        success: true,
        messages: messages.filter(m => m !== null)
      });
    } catch (error) {
      console.error('❌ [Chat] Error getting messages:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * POST /video/consultation/:id/chat/read
   * Mark messages as read
   */
  app.post(`${BASE_PATH}/video/consultation/:id/chat/read`, async (c) => {
    try {
      const { id } = c.req.param();
      const { messageIds } = await c.req.json();

      // ✅ SQL: Mark messages as read
      for (const msgId of messageIds) {
        await db
          .from('chat_messages')
          .update({
            read: true,
            read_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', msgId)
          .eq('consultation_id', id);
      }

      return c.json({ success: true });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * POST /video/consultation/:id/chat/typing
   * Send typing indicator
   */
  app.post(`${BASE_PATH}/video/consultation/:id/chat/typing`, async (c) => {
    try {
      const { id } = c.req.param();
      const { userId, userType, isTyping } = await c.req.json();

      // ✅ SQL: Store typing indicator
      if (isTyping) {
        await db
          .from('chat_typing_indicators')
          .upsert({
            consultation_id: id,
            user_id: userId,
            user_type: userType,
            timestamp: new Date().toISOString(),
            expires_at: new Date(Date.now() + 5000).toISOString()
          }, {
            onConflict: 'consultation_id,user_id'
          });
        
        // Auto-expire after 5 seconds (can use DB trigger or cleanup job)
      } else {
        await db
          .from('chat_typing_indicators')
          .delete()
          .eq('consultation_id', id)
          .eq('user_id', userId);
      }

      return c.json({ success: true });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  /**
   * GET /video/consultation/:id/chat/typing
   * Get who is typing
   */
  app.get(`${BASE_PATH}/video/consultation/:id/chat/typing`, async (c) => {
    try {
      const { id } = c.req.param();
      
      // ✅ SQL: Get typing indicators
      const { data: typingData } = await db
        .from('chat_typing_indicators')
        .select('*')
        .eq('consultation_id', id)
        .gt('expires_at', new Date().toISOString());
      
      const activeTyping = typingData || [];

      return c.json({
        success: true,
        typing: activeTyping
      });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  console.log('✅ AWS Chime chat endpoints registered');
}
