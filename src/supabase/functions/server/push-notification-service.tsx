/**
 * Push Notification Service
 * Supports FCM (Firebase Cloud Messaging) for mobile apps
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

// FCM configuration
const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY') || '';
const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

/**
 * Send push notification via FCM
 */
export async function sendPushNotification(
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  if (!FCM_SERVER_KEY) {
    console.warn('⚠️ [PUSH] FCM_SERVER_KEY not configured');
    return false;
  }

  if (!deviceToken) {
    console.warn('⚠️ [PUSH] Device token not provided');
    return false;
  }

  try {
    const response = await fetch(FCM_URL, {
      method: 'POST',
      headers: {
        'Authorization': `key=${FCM_SERVER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: deviceToken,
        notification: {
          title,
          body,
          sound: 'default',
          badge: '1',
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        priority: 'high',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ [PUSH] FCM error:`, error);
      return false;
    }

    const result = await response.json();
    console.log(`✅ [PUSH] Notification sent:`, result);
    return result.success === 1;
  } catch (error) {
    console.error('❌ [PUSH] Error sending notification:', error);
    return false;
  }
}

/**
 * Send push notification to user
 */
export async function sendNotificationToUser(
  userId: string,
  userType: 'customer' | 'vendor' | 'staff',
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<boolean> {
  try {
    // Get user's device tokens
    const tokensKey = `${userType}:${userId}:device_tokens`;
    const tokens = await kv.get(tokensKey) || [];

    if (tokens.length === 0) {
      console.log(`⚠️ [PUSH] No device tokens for ${userType}:${userId}`);
      return false;
    }

    // Send to all devices
    const results = await Promise.all(
      tokens.map((token: string) =>
        sendPushNotification(token, title, body, data)
      )
    );

    // Store notification in history
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      userId,
      userType,
      title,
      body,
      data,
      sentAt: new Date().toISOString(),
      read: false,
    };

    const notificationsKey = `${userType}:${userId}:notifications`;
    const notifications = await kv.get(notificationsKey) || [];
    notifications.unshift(notification);
    await kv.set(notificationsKey, notifications.slice(0, 100)); // Keep last 100

    return results.some(r => r);
  } catch (error) {
    console.error(`❌ [PUSH] Error sending to user ${userId}:`, error);
    return false;
  }
}

/**
 * Register device token
 */
export async function registerDeviceToken(
  userId: string,
  userType: 'customer' | 'vendor' | 'staff',
  deviceToken: string,
  deviceInfo?: {
    platform?: string;
    appVersion?: string;
  }
): Promise<void> {
  try {
    const tokensKey = `${userType}:${userId}:device_tokens`;
    const tokens = await kv.get(tokensKey) || [];

    // Add token if not exists
    if (!tokens.includes(deviceToken)) {
      tokens.push(deviceToken);
      await kv.set(tokensKey, tokens);
      console.log(`✅ [PUSH] Device token registered for ${userType}:${userId}`);
    }

    // Store device info
    if (deviceInfo) {
      await kv.set(`${userType}:${userId}:device:${deviceToken}`, {
        ...deviceInfo,
        registeredAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error(`❌ [PUSH] Error registering device token:`, error);
    throw error;
  }
}

/**
 * Unregister device token
 */
export async function unregisterDeviceToken(
  userId: string,
  userType: 'customer' | 'vendor' | 'staff',
  deviceToken: string
): Promise<void> {
  try {
    const tokensKey = `${userType}:${userId}:device_tokens`;
    const tokens = await kv.get(tokensKey) || [];

    const filtered = tokens.filter((t: string) => t !== deviceToken);
    await kv.set(tokensKey, filtered);
    console.log(`✅ [PUSH] Device token unregistered for ${userType}:${userId}`);
  } catch (error) {
    console.error(`❌ [PUSH] Error unregistering device token:`, error);
    throw error;
  }
}

/**
 * Register push notification endpoints
 */
export function registerPushNotificationEndpoints(app: Hono) {
  /**
   * Register device token
   * POST /make-server-3dd53475/push/register
   */
  app.post('/make-server-3dd53475/push/register', async (c) => {
    try {
      const { userId, userType, deviceToken, deviceInfo } = await c.req.json();

      if (!userId || !userType || !deviceToken) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      await registerDeviceToken(userId, userType, deviceToken, deviceInfo);

      return c.json({
        success: true,
        message: 'Device token registered',
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Unregister device token
   * POST /make-server-3dd53475/push/unregister
   */
  app.post('/make-server-3dd53475/push/unregister', async (c) => {
    try {
      const { userId, userType, deviceToken } = await c.req.json();

      if (!userId || !userType || !deviceToken) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      await unregisterDeviceToken(userId, userType, deviceToken);

      return c.json({
        success: true,
        message: 'Device token unregistered',
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get notification history
   * GET /make-server-3dd53475/push/notifications/:userId
   */
  app.get('/make-server-3dd53475/push/notifications/:userId', async (c) => {
    try {
      const { userId } = c.req.param();
      const userType = c.req.query('userType') || 'customer';

      const notificationsKey = `${userType}:${userId}:notifications`;
      const notifications = await kv.get(notificationsKey) || [];

      return c.json({
        success: true,
        notifications,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Mark notification as read
   * POST /make-server-3dd53475/push/notifications/:notificationId/read
   */
  app.post('/make-server-3dd53475/push/notifications/:notificationId/read', async (c) => {
    try {
      const { notificationId } = c.req.param();
      const { userId, userType } = await c.req.json();

      const notificationsKey = `${userType}:${userId}:notifications`;
      const notifications = await kv.get(notificationsKey) || [];

      const notification = notifications.find((n: any) => n.id === notificationId);
      if (notification) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
        await kv.set(notificationsKey, notifications);
      }

      return c.json({
        success: true,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}

