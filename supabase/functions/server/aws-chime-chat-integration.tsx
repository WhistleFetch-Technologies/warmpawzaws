import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

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

      // Get consultation
      const consultation = await kv.get(`consultation:${id}`);
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

      // Store message
      await kv.set(`chat:${id}:${messageId}`, chatMessage);

      // Add to conversation thread
      const threadKey = `chat:thread:${id}`;
      const thread = await kv.get(threadKey) || [];
      thread.push(messageId);
      await kv.set(threadKey, thread);

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

      // Get thread
      const threadKey = `chat:thread:${id}`;
      const thread = await kv.get(threadKey) || [];

      // Get messages
      const messageIds = thread.slice(-limit); // Get last N messages
      const messages = await Promise.all(
        messageIds.map((msgId: string) => kv.get(`chat:${id}:${msgId}`))
      );

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

      for (const msgId of messageIds) {
        const message = await kv.get(`chat:${id}:${msgId}`);
        if (message) {
          message.read = true;
          message.readAt = new Date().toISOString();
          await kv.set(`chat:${id}:${msgId}`, message);
        }
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

      const typingKey = `chat:typing:${id}:${userId}`;
      
      if (isTyping) {
        await kv.set(typingKey, {
          userId,
          userType,
          timestamp: new Date().toISOString()
        });
        
        // Auto-expire after 5 seconds
        setTimeout(async () => {
          await kv.del(typingKey);
        }, 5000);
      } else {
        await kv.del(typingKey);
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
      
      // Get all typing indicators for this consultation
      const typingData = await kv.getByPrefix(`chat:typing:${id}:`);
      
      // Filter out expired ones (older than 5 seconds)
      const now = Date.now();
      const activeTyping = typingData.filter((t: any) => {
        const timestamp = new Date(t.timestamp).getTime();
        return (now - timestamp) < 5000;
      });

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
