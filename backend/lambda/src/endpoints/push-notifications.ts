/**
 * ============================================================================
 * PUSH NOTIFICATION ENDPOINTS
 * ============================================================================
 * 
 * Handles push notification sending and device token management
 * 
 * Date: 2025-01-02
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query, deleteRows } from '../database/rds-connection';
import {
  sendPushToDevice,
  sendPushToMultipleDevices,
  sendPushToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  PushTemplates,
} from '../utils/firebase-client';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

export function registerPushNotificationEndpoints(app: Hono) {
  /**
   * POST /push/register-device
   * Register a device for push notifications
   */
  app.post("/push/register-device", async (c) => {
    try {
      const { userId, userType, fcmToken, deviceId, platform } = await c.req.json();

      if (!userId || !userType || !fcmToken) {
        return c.json({ error: 'userId, userType, and fcmToken are required' }, 400);
      }

      // Upsert device token
      const existing = await query(
        `SELECT id FROM device_tokens WHERE user_id = $1 AND user_type = $2 AND device_id = $3`,
        [userId, userType, deviceId || fcmToken]
      );

      if (existing.rows.length > 0) {
        await update('device_tokens',
          { id: existing.rows[0].id },
          {
            fcm_token: fcmToken,
            platform: platform || 'unknown',
            is_active: true,
            updated_at: new Date().toISOString(),
          }
        );
      } else {
        await insert('device_tokens', {
          user_id: userId,
          user_type: userType,
          device_id: deviceId || fcmToken,
          fcm_token: fcmToken,
          platform: platform || 'unknown',
          is_active: true,
        });
      }

      // Subscribe to relevant topics
      const topics = [
        `${userType}_${userId}`, // Personal topic
        `all_${userType}s`, // All customers or all vendors
        'announcements', // Platform announcements
      ];

      for (const topic of topics) {
        await subscribeToTopic(fcmToken, topic);
      }

      return c.json({
        success: true,
        message: 'Device registered for push notifications',
      });
    } catch (error: any) {
      console.error('Error registering device:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /push/unregister-device
   * Unregister a device from push notifications
   */
  app.delete("/push/unregister-device", async (c) => {
    try {
      const { userId, userType, deviceId } = await c.req.json();

      if (!userId || !userType) {
        return c.json({ error: 'userId and userType are required' }, 400);
      }

      if (deviceId) {
        await deleteRows('device_tokens', {
          user_id: userId,
          user_type: userType,
          device_id: deviceId,
        });
      } else {
        await query(
          `UPDATE device_tokens SET is_active = false WHERE user_id = $1 AND user_type = $2`,
          [userId, userType]
        );
      }

      return c.json({
        success: true,
        message: 'Device unregistered from push notifications',
      });
    } catch (error: any) {
      console.error('Error unregistering device:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /push/send
   * Send push notification to a specific user
   */
  app.post("/push/send", async (c) => {
    try {
      const { userId, userType, title, body, imageUrl, data } = await c.req.json();

      if (!userId || !userType || !title || !body) {
        return c.json({ error: 'userId, userType, title, and body are required' }, 400);
      }

      // Get user's active FCM tokens
      const tokens = await query(
        `SELECT fcm_token FROM device_tokens 
         WHERE user_id = $1 AND user_type = $2 AND is_active = true`,
        [userId, userType]
      );

      if (tokens.rows.length === 0) {
        return c.json({
          success: false,
          message: 'No active devices found for this user',
        });
      }

      const fcmTokens = tokens.rows.map((t: any) => t.fcm_token);
      const result = await sendPushToMultipleDevices(fcmTokens, {
        title,
        body,
        imageUrl,
        data,
      });

      // Log notification
      await insert('notifications', {
        recipient_type: userType,
        recipient_id: userId,
        notification_type: 'push',
        title,
        message: body,
        channels: { push: true },
        is_read: false,
      });

      return c.json(result);
      return c.json(result);
    } catch (error: any) {
      console.error('Error sending push notification:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /push/send-template
   * Send a templated push notification
   */
  app.post("/push/send-template", async (c) => {
    try {
      const { userId, userType, template, templateData } = await c.req.json();

      if (!userId || !userType || !template) {
        return c.json({ error: 'userId, userType, and template are required' }, 400);
      }

      // Get template
      const templateFn = (PushTemplates as any)[template];
      if (!templateFn) {
        return c.json({ error: `Unknown template: ${template}` }, 400);
      }

      const payload = templateFn(templateData || {});

      // Get user's active FCM tokens
      const tokens = await query(
        `SELECT fcm_token FROM device_tokens 
         WHERE user_id = $1 AND user_type = $2 AND is_active = true`,
        [userId, userType]
      );

      if (tokens.rows.length === 0) {
        return c.json({
          success: false,
          message: 'No active devices found for this user',
        });
      }

      const fcmTokens = tokens.rows.map((t: any) => t.fcm_token);
      const result = await sendPushToMultipleDevices(fcmTokens, payload);

      // Log notification
      await insert('notifications', {
        recipient_type: userType,
        recipient_id: userId,
        notification_type: 'push',
        title: payload.title,
        message: payload.body,
        channels: { push: true },
        is_read: false,
      });

      return c.json(result);
    } catch (error: any) {
      console.error('Error sending templated push:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /push/send-to-topic
   * Send push notification to a topic
   */
  app.post("/push/send-to-topic", async (c) => {
    try {
      const { topic, title, body, imageUrl, data } = await c.req.json();

      if (!topic || !title || !body) {
        return c.json({ error: 'topic, title, and body are required' }, 400);
      }

      const result = await sendPushToTopic(topic, {
        title,
        body,
        imageUrl,
        data,
      });

      return c.json(result);
    } catch (error: any) {
      console.error('Error sending topic push:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /push/broadcast
   * Send push notification to all users of a type
   */
  app.post("/push/broadcast", async (c) => {
    try {
      const { userType, title, body, imageUrl, data } = await c.req.json();

      if (!userType || !title || !body) {
        return c.json({ error: 'userType, title, and body are required' }, 400);
      }

      const topic = `all_${userType}s`;
      const result = await sendPushToTopic(topic, {
        title,
        body,
        imageUrl,
        data,
      });

      return c.json({
        ...result,
        topic,
      });
    } catch (error: any) {
      console.error('Error broadcasting push:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /push/subscribe-topic
   * Subscribe user to a topic
   */
  app.post("/push/subscribe-topic", async (c) => {
    try {
      const { userId, userType, topic } = await c.req.json();

      if (!userId || !userType || !topic) {
        return c.json({ error: 'userId, userType, and topic are required' }, 400);
      }

      // Get user's FCM tokens
      const tokens = await query(
        `SELECT fcm_token FROM device_tokens 
         WHERE user_id = $1 AND user_type = $2 AND is_active = true`,
        [userId, userType]
      );

      if (tokens.rows.length === 0) {
        return c.json({ error: 'No active devices found' }, 400);
      }

      let successCount = 0;
      for (const token of tokens.rows) {
        const success = await subscribeToTopic(token.fcm_token, topic);
        if (success) successCount++;
      }

      return c.json({
        success: true,
        message: `Subscribed ${successCount} devices to topic: ${topic}`,
      });
    } catch (error: any) {
      console.error('Error subscribing to topic:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /push/unsubscribe-topic
   * Unsubscribe user from a topic
   */
  app.post("/push/unsubscribe-topic", async (c) => {
    try {
      const { userId, userType, topic } = await c.req.json();

      if (!userId || !userType || !topic) {
        return c.json({ error: 'userId, userType, and topic are required' }, 400);
      }

      // Get user's FCM tokens
      const tokens = await query(
        `SELECT fcm_token FROM device_tokens 
         WHERE user_id = $1 AND user_type = $2 AND is_active = true`,
        [userId, userType]
      );

      let successCount = 0;
      for (const token of tokens.rows) {
        const success = await unsubscribeFromTopic(token.fcm_token, topic);
        if (success) successCount++;
      }

      return c.json({
        success: true,
        message: `Unsubscribed ${successCount} devices from topic: ${topic}`,
      });
    } catch (error: any) {
      console.error('Error unsubscribing from topic:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /push/templates
   * Get available push notification templates
   */
  app.get("/push/templates", async (c) => {
    return c.json({
      success: true,
      templates: Object.keys(PushTemplates),
    });
  });
}

