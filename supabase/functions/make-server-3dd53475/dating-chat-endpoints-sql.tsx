/**
 * ============================================================================
 * DATING CHAT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Real-time messaging for dating matches using SQL tables
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `dating_matches` and `dating_chat_messages` tables
 * - Uses `platform_settings` for AWS Chime configuration
 * 
 * Date: 2025-01-28
 * Migration: Batch 9 - 12 KV operations → 0
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';

export function registerDatingChatEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const db = getDbClient();

  /**
   * POST /make-server-3dd53475/dating/chat/:matchId/message
   * Send a message in dating chat
   */
  app.post(`${BASE_PATH}/dating/chat/:matchId/message`, async (c) => {
    try {
      const { matchId } = c.req.param();
      const { senderId, message, messageType = 'text', attachmentUrl } = await c.req.json();

      if (!senderId || !message) {
        return sendError(c, 'Missing required fields: senderId, message', 400);
      }

      // ✅ SQL: Get match
      const { data: match, error: matchError } = await db
        .from('dating_matches')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle();

      if (matchError) throw matchError;
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // Verify sender is part of this match
      if (match.customer1_id !== senderId && match.customer2_id !== senderId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Check if chat is unlocked
      if (!match.chat_unlocked) {
        return sendError(c, 'Chat is locked. Subscription required.', 402);
      }

      // ✅ SQL: Create message
      const { data: messageData, error: msgError } = await db
        .from('dating_chat_messages')
        .insert({
          match_id: match.id,
          sender_id: senderId,
          message_type: messageType,
          content: message,
          media_url: attachmentUrl || null,
          is_read: false
        })
        .select()
        .single();

      if (msgError) throw msgError;

      // ✅ SQL: Update match last message timestamp
      await db
        .from('dating_matches')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', match.id);

      // If using AWS Chime, send via Chime SDK Messaging
      if (match.chat_channel_arn && match.chat_channel_arn.startsWith('chime:')) {
        try {
          // ✅ SQL: Get AWS settings
          const { data: awsSettings } = await db
            .from('platform_settings')
            .select('setting_value')
            .eq('setting_key', 'admin:settings:aws')
            .maybeSingle();

          if (awsSettings?.setting_value?.chime?.enabled) {
            // In production, use AWS Chime SDK Messaging API
            // For now, message is stored in SQL and can be synced to Chime
            console.log(`💬 [DATING-CHAT] Message sent via Chime channel: ${match.chat_channel_arn}`);
          }
        } catch (error) {
          console.error('Error sending via Chime:', error);
          // Continue with SQL storage
        }
      }

      return sendSuccess(c, { 
        message: {
          id: messageData.id,
          matchId,
          senderId: messageData.sender_id,
          message: messageData.content,
          messageType: messageData.message_type,
          attachmentUrl: messageData.media_url,
          timestamp: messageData.created_at,
          read: messageData.is_read
        }
      }, 'Message sent successfully');
    } catch (error) {
      console.error('Error sending dating chat message:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/dating/chat/:matchId/messages
   * Get chat messages for a match
   */
  app.get(`${BASE_PATH}/dating/chat/:matchId/messages`, async (c) => {
    try {
      const { matchId } = c.req.param();
      const limit = parseInt(c.req.query('limit') || '50');
      const before = c.req.query('before'); // Message ID to fetch messages before

      // ✅ SQL: Get match
      const { data: match, error: matchError } = await db
        .from('dating_matches')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle();

      if (matchError) throw matchError;
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // ✅ SQL: Get messages
      let query = db
        .from('dating_chat_messages')
        .select('*')
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        // Get messages before the specified message ID
        const { data: beforeMsg } = await db
          .from('dating_chat_messages')
          .select('created_at')
          .eq('id', before)
          .maybeSingle();

        if (beforeMsg) {
          query = query.lt('created_at', beforeMsg.created_at);
        }
      }

      const { data: messages, error: msgError } = await query;

      if (msgError) throw msgError;

      // Reverse to show oldest first
      const sortedMessages = (messages || []).reverse();

      return sendSuccess(c, { 
        messages: sortedMessages.map((m: any) => ({
          id: m.id,
          matchId,
          senderId: m.sender_id,
          message: m.content,
          messageType: m.message_type,
          attachmentUrl: m.media_url,
          timestamp: m.created_at,
          read: m.is_read,
          readBy: m.read_at ? [m.sender_id] : [] // Simplified - in production, track read_by array
        })),
        count: sortedMessages.length,
        hasMore: sortedMessages.length === limit
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
  app.post(`${BASE_PATH}/dating/chat/:matchId/messages/:messageId/read`, async (c) => {
    try {
      const { matchId, messageId } = c.req.param();
      const { userId } = await c.req.json();

      // ✅ SQL: Get match
      const { data: match, error: matchError } = await db
        .from('dating_matches')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle();

      if (matchError) throw matchError;
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // ✅ SQL: Update message read status
      const { data: message, error: msgError } = await db
        .from('dating_chat_messages')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('match_id', match.id)
        .select()
        .single();

      if (msgError) throw msgError;
      if (!message) {
        return sendError(c, 'Message not found', 404);
      }

      return sendSuccess(c, { 
        message: {
          id: message.id,
          read: message.is_read,
          readAt: message.read_at
        }
      }, 'Message marked as read');
    } catch (error) {
      console.error('Error marking message as read:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/dating/chat/:matchId/upload-media
   * Upload media (image/video) for dating chat
   */
  app.post(`${BASE_PATH}/dating/chat/:matchId/upload-media`, async (c) => {
    try {
      const { matchId } = c.req.param();
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const senderId = formData.get('senderId') as string;

      if (!file || !senderId) {
        return sendError(c, 'Missing required fields: file, senderId', 400);
      }

      // ✅ SQL: Get match
      const { data: match, error: matchError } = await db
        .from('dating_matches')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle();

      if (matchError) throw matchError;
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // Verify sender
      if (match.customer1_id !== senderId && match.customer2_id !== senderId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Get AWS settings
      const { data: awsSettingsData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:aws')
        .maybeSingle();

      const awsSettings = awsSettingsData?.setting_value || {};
      const s3Config = awsSettings.s3 || {};

      if (!s3Config.enabled || !s3Config.bucket) {
        return sendError(c, 'S3 not configured', 500);
      }

      const { S3Client, PutObjectCommand } = await import('npm:@aws-sdk/client-s3@3');
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
  app.get(`${BASE_PATH}/dating/chat/:matchId/unread-count`, async (c) => {
    try {
      const { matchId } = c.req.param();
      const userId = c.req.query('userId');

      if (!userId) {
        return sendError(c, 'userId query parameter required', 400);
      }

      // ✅ SQL: Get match
      const { data: match, error: matchError } = await db
        .from('dating_matches')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle();

      if (matchError) throw matchError;
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // ✅ SQL: Get unread messages
      const { count, error: countError } = await db
        .from('dating_chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', match.id)
        .neq('sender_id', userId)
        .eq('is_read', false);

      if (countError) throw countError;

      return sendSuccess(c, { unreadCount: count || 0 });
    } catch (error) {
      console.error('Error getting unread count:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Dating Chat Endpoints registered (SQL-only)');
}
