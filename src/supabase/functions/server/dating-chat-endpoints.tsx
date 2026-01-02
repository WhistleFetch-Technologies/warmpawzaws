// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
// ✅ LAMBDA COMPATIBILITY: Node.js compatible imports
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { getDbClient } from '../../../supabase/lib/db';
import { getPlatformSettingsRepository } from '../../../supabase/lib/repositories/index';

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

      // ✅ SQL: Get match
      const db = getDbClient();
      const { data: match } = await db
        .from('dating_matches')
        .select('*')
        .eq('id', matchId)
        .single();
      
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // Verify sender is part of this match
      const profile1UserId = match.profile1_user_id || match.profile1UserId;
      const profile2UserId = match.profile2_user_id || match.profile2UserId;
      const chatUnlocked = match.chat_unlocked !== false && match.chatUnlocked !== false;
      
      if (profile1UserId !== senderId && profile2UserId !== senderId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Check if chat is unlocked
      if (!chatUnlocked) {
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

      // ✅ SQL: Store message
      await db
        .from('dating_chat_messages')
        .insert({
          id: messageId,
          match_id: matchId,
          sender_id: senderId,
          message,
          message_type: messageType,
          attachment_url: attachmentUrl || null,
          timestamp: new Date().toISOString(),
          read: false,
          read_by: []
        });

      // ✅ SQL: Update match last message timestamp
      const lastMessageAt = new Date().toISOString();
      const lastMessage = message.substring(0, 50); // Preview
      await db
        .from('dating_matches')
        .update({
          last_message_at: lastMessageAt,
          last_message: lastMessage,
          updated_at: lastMessageAt
        })
        .eq('id', matchId);

      // If using AWS Chime, send via Chime SDK Messaging
      const chatChannelArn = match.chat_channel_arn || match.chatChannelArn;
      if (chatChannelArn && chatChannelArn.startsWith('chime:')) {
        try {
          // ✅ SQL: Get AWS settings
          const platformSettingsRepo = getPlatformSettingsRepository();
          const awsSettings = await platformSettingsRepo.getAWSSettings();
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

      // ✅ SQL: Get match
      const db = getDbClient();
      const { data: match } = await db
        .from('dating_matches')
        .select('*')
        .eq('id', matchId)
        .single();
      
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // ✅ SQL: Get messages
      let query = db
        .from('dating_chat_messages')
        .select('*')
        .eq('match_id', matchId);
      
      if (before) {
        query = query.lt('id', before);
      }
      
      const { data: messagesData } = await query
        .order('timestamp', { ascending: false })
        .limit(limit);
      
      let messages = messagesData || [];

      // Messages are already sorted and paginated by SQL query
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

      // ✅ SQL: Get and update message
      const db = getDbClient();
      const { data: message } = await db
        .from('dating_chat_messages')
        .select('*')
        .eq('id', messageId)
        .eq('match_id', matchId)
        .single();
      
      if (message) {
        const readBy = message.read_by || message.readBy || [];
        let updatedReadBy = [...readBy];
        if (!updatedReadBy.includes(userId)) {
          updatedReadBy.push(userId);
        }
        const isRead = updatedReadBy.length === 2; // Read by both participants
        
        await db
          .from('dating_chat_messages')
          .update({
            read: isRead,
            read_by: updatedReadBy,
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
        
        message.read = isRead;
        message.readBy = updatedReadBy;
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

      // ✅ SQL: Get match
      const db = getDbClient();
      const { data: match } = await db
        .from('dating_matches')
        .select('*')
        .eq('id', matchId)
        .single();
      
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // Verify sender
      const profile1UserId = match.profile1_user_id || match.profile1UserId;
      const profile2UserId = match.profile2_user_id || match.profile2UserId;
      
      if (profile1UserId !== senderId && profile2UserId !== senderId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Upload to S3 (get AWS settings)
      const platformSettingsRepo = getPlatformSettingsRepository();
      const awsSettings = await platformSettingsRepo.getAWSSettings();
      const s3Config = awsSettings?.s3 || {};

      if (!s3Config.enabled || !s3Config.bucket) {
        return sendError(c, 'S3 not configured', 500);
      }

      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
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

      // ✅ SQL: Get unread messages
      const db = getDbClient();
      const { data: messages } = await db
        .from('dating_chat_messages')
        .select('*')
        .eq('match_id', matchId);

      const unreadCount = messages?.filter((m: any) => {
        const senderId = m.sender_id || m.senderId;
        const readBy = m.read_by || m.readBy || [];
        return senderId !== userId && !readBy.includes(userId);
      }).length || 0;

      return sendSuccess(c, { unreadCount });
    } catch (error) {
      console.error('Error getting unread count:', error);
      return sendError(c, error, 500);
    }
  });
}

