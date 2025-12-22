import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * DATING CHAT ENDPOINTS
 * Real-time messaging for dating matches using AWS Chime SDK Messaging or KV fallback
 */

export function registerDatingChatEndpoints(app: Hono) {

  /**
   * POST /make-server-3dd53475/dating/chat/:matchId/message
   * Send a message in dating chat
   */
  app.post("/make-server-3dd53475/dating/chat/:matchId/message", async (c) => {
    try {
      const { matchId } = c.req.param();
      const { senderId, message, messageType = 'text', attachmentUrl } = await c.req.json();

      if (!senderId || !message) {
        return sendError(c, 'Missing required fields: senderId, message', 400);
      }

      // Get match
      const match = await kv.get(`dating_match:${matchId}`);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // Verify sender is part of this match
      if (match.profile1UserId !== senderId && match.profile2UserId !== senderId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Check if chat is unlocked
      if (!match.chatUnlocked) {
        return sendError(c, 'Chat is locked. Subscription required.', 402);
      }

      // Create message
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const chatMessage = {
        id: messageId,
        matchId,
        senderId,
        message,
        messageType,
        attachmentUrl: attachmentUrl || null,
        timestamp: new Date().toISOString(),
        read: false,
        readBy: []
      };

      // Store message
      const messagesKey = `dating_chat:${matchId}:messages`;
      const messages = await kv.get(messagesKey) || [];
      messages.push(chatMessage);
      await kv.set(messagesKey, messages);

      // Update match last message timestamp
      match.lastMessageAt = new Date().toISOString();
      match.lastMessage = message.substring(0, 50); // Preview
      await kv.set(`dating_match:${matchId}`, match);

      // If using AWS Chime, send via Chime SDK Messaging
      if (match.chatChannelArn && match.chatChannelArn.startsWith('chime:')) {
        try {
          const awsSettings = await kv.get('admin:settings:aws');
          if (awsSettings?.chime?.enabled) {
            // In production, use AWS Chime SDK Messaging API
            // For now, message is stored in KV and can be synced to Chime
            console.log(`💬 [DATING-CHAT] Message sent via Chime channel: ${match.chatChannelArn}`);
          }
        } catch (error) {
          console.error('Error sending via Chime:', error);
          // Continue with KV storage
        }
      }

      return sendSuccess(c, { message: chatMessage }, 'Message sent successfully');
    } catch (error) {
      console.error('Error sending dating chat message:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/dating/chat/:matchId/messages
   * Get chat messages for a match
   */
  app.get("/make-server-3dd53475/dating/chat/:matchId/messages", async (c) => {
    try {
      const { matchId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50');
      const before = c.req.query('before'); // Message ID to fetch messages before

      // Get match
      const match = await kv.get(`dating_match:${matchId}`);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // Get messages
      const messagesKey = `dating_chat:${matchId}:messages`;
      let messages = await kv.get(messagesKey) || [];

      // Sort by timestamp (newest first)
      messages.sort((a: any, b: any) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Pagination
      if (before) {
        const beforeIndex = messages.findIndex((m: any) => m.id === before);
        if (beforeIndex >= 0) {
          messages = messages.slice(beforeIndex + 1, beforeIndex + 1 + limit);
        } else {
          messages = messages.slice(0, limit);
        }
      } else {
        messages = messages.slice(0, limit);
      }

      // Reverse to show oldest first
      messages.reverse();

      return sendSuccess(c, { 
        messages, 
        count: messages.length,
        hasMore: messages.length === limit
      });
    } catch (error) {
      console.error('Error fetching dating chat messages:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/dating/chat/:matchId/messages/:messageId/read
   * Mark message as read
   */
  app.post("/make-server-3dd53475/dating/chat/:matchId/messages/:messageId/read", async (c) => {
    try {
      const { matchId, messageId } = c.req.param();
      const { userId } = await c.req.json();

      const messagesKey = `dating_chat:${matchId}:messages`;
      const messages = await kv.get(messagesKey) || [];
      
      const message = messages.find((m: any) => m.id === messageId);
      if (message) {
        if (!message.readBy) message.readBy = [];
        if (!message.readBy.includes(userId)) {
          message.readBy.push(userId);
        }
        message.read = message.readBy.length === 2; // Read by both participants
        
        await kv.set(messagesKey, messages);
      }

      return sendSuccess(c, { message }, 'Message marked as read');
    } catch (error) {
      console.error('Error marking message as read:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/dating/chat/:matchId/upload-media
   * Upload media (image/video) for dating chat
   */
  app.post("/make-server-3dd53475/dating/chat/:matchId/upload-media", async (c) => {
    try {
      const { matchId } = c.req.param();
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const senderId = formData.get('senderId') as string;

      if (!file || !senderId) {
        return sendError(c, 'Missing required fields: file, senderId', 400);
      }

      // Get match
      const match = await kv.get(`dating_match:${matchId}`);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // Verify sender
      if (match.profile1UserId !== senderId && match.profile2UserId !== senderId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Upload to S3
      const awsSettings = await kv.get('admin:settings:aws') || {};
      const s3Config = awsSettings.s3 || {};

      if (!s3Config.enabled || !s3Config.bucket) {
        return sendError(c, 'S3 not configured', 500);
      }

      const { S3Client, PutObjectCommand } = await import("npm:@aws-sdk/client-s3@3");
      const s3Client = new S3Client({
        region: s3Config.region || 'ap-south-1',
        credentials: {
          accessKeyId: s3Config.accessKeyId || awsSettings.credentials?.accessKeyId,
          secretAccessKey: s3Config.secretAccessKey || awsSettings.credentials?.secretAccessKey
        }
      });

      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `dating_chat_${matchId}_${timestamp}.${fileExt}`;
      const key = `dating/chat/${fileName}`;

      await s3Client.send(new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        ACL: 'public-read'
      }));

      const url = `https://${s3Config.bucket}.s3.${s3Config.region || 'ap-south-1'}.amazonaws.com/${key}`;

      return sendSuccess(c, { 
        url,
        fileName,
        size: file.size,
        type: file.type
      }, 'Media uploaded successfully');
    } catch (error) {
      console.error('Error uploading dating chat media:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/dating/chat/:matchId/unread-count
   * Get unread message count
   */
  app.get("/make-server-3dd53475/dating/chat/:matchId/unread-count", async (c) => {
    try {
      const { matchId } = c.req.param();
      const userId = c.req.query('userId');

      if (!userId) {
        return sendError(c, 'userId query parameter required', 400);
      }

      const messagesKey = `dating_chat:${matchId}:messages`;
      const messages = await kv.get(messagesKey) || [];

      const unreadCount = messages.filter((m: any) => 
        m.senderId !== userId && (!m.readBy || !m.readBy.includes(userId))
      ).length;

      return sendSuccess(c, { unreadCount });
    } catch (error) {
      console.error('Error getting unread count:', error);
      return sendError(c, error, 500);
    }
  });
}

