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
import { z } from 'zod';
import { select, insert, update, query, deleteRows } from '../database/rds-connection';
import { validateBody } from '../middleware/validation-middleware';
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
import { applyRegisterDeviceTokenHygiene } from '../utils/device-token-hygiene';

const registerDeviceSchema = z.object({
  userId: z.string().uuid(),
  userType: z.enum(['customer', 'vendor', 'staff', 'admin']),
  fcmToken: z.string().min(10).max(512),
  deviceId: z.string().min(1).max(255).optional(),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  appVersion: z.string().max(50).optional(),
});

export function registerPushNotificationEndpoints(app: Hono) {
  /**
   * POST /push/register-device
   * Register a device for push notifications
   */
  app.post("/push/register-device", validateBody(registerDeviceSchema), async (c) => {
    const { userId, userType, fcmToken, deviceId, platform, appVersion } = (c as any).get('validatedBody') as z.infer<typeof registerDeviceSchema>;

    try {
      const resolvedDeviceId = deviceId ?? fcmToken;

      const upsertResult = await query(
        `INSERT INTO device_tokens (user_id, user_type, device_id, fcm_token, platform, app_version, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (user_id, user_type, device_id) DO UPDATE SET
           fcm_token = EXCLUDED.fcm_token,
           platform = EXCLUDED.platform,
           app_version = EXCLUDED.app_version,
           is_active = true,
           updated_at = NOW()
         RETURNING id, (xmax = 0) AS inserted`,
        [userId, userType, resolvedDeviceId, fcmToken, platform, appVersion ?? null]
      );

      const isNew = upsertResult.rows[0]?.inserted === true;
      const truncatedDeviceId =
        resolvedDeviceId.length > 12 ? `${resolvedDeviceId.slice(0, 12)}...` : resolvedDeviceId;

      console.log(JSON.stringify({
        event: 'device_registered',
        userId,
        userType,
        platform,
        isNew,
        deviceId: truncatedDeviceId,
      }));

      await applyRegisterDeviceTokenHygiene({ userId, userType, platform }).catch((err) => {
        console.warn('[push] device token hygiene failed (non-fatal):', err?.message || err);
      });

      // Subscribe to relevant topics
      const topics = [
        `${userType}_${userId}`, // Personal topic
        `all_${userType}s`, // All customers or all vendors
        'announcements', // Platform announcements
      ];

      if (userType === 'customer') {
        topics.push('commerce_switch_config');
      }

      for (const topic of topics) {
        try {
          const subscribed = await subscribeToTopic(fcmToken, topic);
          if (!subscribed) {
            console.warn(JSON.stringify({
              event: 'topic_subscription_failed',
              topic,
              userId,
            }));
          }
        } catch {
          console.warn(JSON.stringify({
            event: 'topic_subscription_failed',
            topic,
            userId,
          }));
        }
      }

      return c.json({
        success: true,
        message: 'Device registered for push notifications',
      });
    } catch (error: any) {
      console.error(JSON.stringify({
        event: 'device_register_error',
        userId,
        userType,
        error: error.message,
        stack: error.stack,
      }));
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

      // Get user's fresh active FCM tokens (stale ghosts deactivated inline)
      const { loadFreshActiveFcmTokens } = await import('../utils/device-token-hygiene');
      const fcmTokens = await loadFreshActiveFcmTokens(userId, userType);

      if (fcmTokens.length === 0) {
        return c.json({
          success: false,
          message: 'No active devices found for this user',
        });
      }

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

      // Get user's fresh active FCM tokens (stale ghosts deactivated inline)
      const { loadFreshActiveFcmTokens } = await import('../utils/device-token-hygiene');
      const fcmTokens = await loadFreshActiveFcmTokens(userId, userType);

      if (fcmTokens.length === 0) {
        return c.json({
          success: false,
          message: 'No active devices found for this user',
        });
      }

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

