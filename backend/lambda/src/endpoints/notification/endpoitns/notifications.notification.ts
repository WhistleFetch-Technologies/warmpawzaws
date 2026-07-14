/**
 * ============================================================================
 * NOTIFICATIONS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles notifications:
 * - Get notifications for user
 * - Mark as read
 * - Create notifications
 * - Send SMS/push notifications via SNS
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, query } from '../../../database/rds-connection';
import { sendSMS } from '../../../utils/sms-service';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { UserType } from 'src/endpoints/constants';
import {
  DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
  fetchCustomerNotificationSettings,
  normalizeCustomerNotificationSettings,
  persistCustomerNotificationSettings,
} from '../../../utils/customer-notification-settings';
import { processDueScheduledNotifications } from '../../../utils/scheduled-notification-drain';
import {
  cronPipelineSkippedPayload,
  isNotificationCronEnabled,
} from '../../../utils/notification-pipeline-kill-switch';
import {
  ensureDeliveryLogEntries,
  finalizeInAppDelivery,
  markNotificationsOpenedByIds,
  resolveChannelsFromRequest,
} from '../../../utils/notification-delivery';

async function markAllNotificationsOpenedForRecipient(recipientId: string, recipientType: string): Promise<void> {
  const result = await query(
    `SELECT id FROM notifications
     WHERE recipient_id = $1 AND recipient_type = $2 AND is_read = false`,
    [recipientId, recipientType]
  );

  const ids = (result.rows || []).map((row: { id: string }) => row.id);
  await markNotificationsOpenedByIds(ids);
}

async function resolveCustomerIdForNotificationPhone(phone: string): Promise<string | null> {
  const raw = decodeURIComponent(String(phone)).trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.length < 10) return null;
  let customers = await select('customers', { phone: digits });
  if (customers.length > 0 && (customers[0] as any).id) return (customers[0] as any).id as string;
  if (digits.length === 10) {
    customers = await select('customers', { phone: `+91${digits}` });
    if (customers.length > 0 && (customers[0] as any).id) return (customers[0] as any).id as string;
  }
  if (raw !== digits) {
    customers = await select('customers', { phone: raw });
    if (customers.length > 0 && (customers[0] as any).id) return (customers[0] as any).id as string;
  }
  return null;
}

export function registerNotificationEndpoints(app: Hono) {
  /**
   * GET /notifications/unread-count?userId=&userType=
   * Thin COUNT(*) on recipient_* (badge). Prefer this over shipping full rows.
   */
  app.get("/notifications/unread-count", async (c) => {
    try {
      const userId = c.req.query('userId');
      const userType = c.req.query('userType') || 'customer';
      if (!userId) {
        return c.json({ error: 'userId is required' }, 400);
      }

      let effectiveUserId = userId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (!isUuid && userType === UserType.CUSTOMER) {
        const resolved = await resolveCustomerIdForNotificationPhone(userId);
        if (resolved) effectiveUserId = resolved;
      }

      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveUserId)) {
        return c.json({ success: true, unreadCount: 0 });
      }

      const unreadCountResult = await query(
        `SELECT COUNT(*) as count
         FROM notifications
         WHERE recipient_id = $1
           AND recipient_type = $2
           AND is_read = false`,
        [effectiveUserId, userType]
      );
      const unreadCount = parseInt(unreadCountResult.rows[0]?.count || '0', 10);
      return c.json({ success: true, unreadCount });
    } catch (error: any) {
      console.error('Error fetching unread count:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /notifications
   * Get unread notifications for a user
   * 
   * Always returns only unread notifications (is_read = false)
   * Query params:
   * - userId: Required - User ID or phone number (for customers)
   * - userType: Optional - 'customer' | 'vendor' | 'admin' (default: 'customer')
   * - limit: Optional - Number of notifications to return (default: 50)
   * - offset: Optional - Pagination offset (default: 0)
   */
  app.get("/notifications", async (c) => {
    try {
      // Extract and validate query parameters
      const userId = c.req.query('userId');
      const userType = c.req.query('userType') || 'customer';
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      if (!userId) {
        return c.json({ error: 'userId is required' }, 400);
      }

      // Resolve customer by phone when userId is not a UUID
      // Normalize phone to digits-only so "+91 98765 43210" and "919876543210" both match DB
      let effectiveUserId = userId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      
      if (!isUuid && userType === UserType.CUSTOMER && userId !== 'test-vendor-id') {
        try {
          const rawPhone = decodeURIComponent(String(userId)).trim();
          const digitsOnly = rawPhone.replace(/\D/g, '');
          
          const customers = await select('customers', { phone: digitsOnly });
          if (customers.length > 0 && (customers[0] as any).id) {
            effectiveUserId = (customers[0] as any).id;
          } else if (digitsOnly !== rawPhone) {
            const alt = await select('customers', { phone: rawPhone });
            if (alt.length > 0 && (alt[0] as any).id) {
              effectiveUserId = (alt[0] as any).id;
            }
          }
        } catch (_) {
          // Fall through to empty result
        }
      }

      // Handle test IDs or unresolved non-UUID - return empty notifications
      if (userId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveUserId)) {
        return c.json({
          success: true,
          notifications: [],
          total: 0,
          unreadCount: 0,
        });
      }

      // fetch only unread notifications (is_read = false)
      const notificationQuery = `
        SELECT * FROM notifications
        WHERE recipient_id = $1 
          AND recipient_type = $2
          AND is_read = false
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const notifications = await query(notificationQuery, [
        effectiveUserId,
        userType,
        limit,
        offset
      ]);

      // Count total unread notifications for this user
      const unreadCountResult = await query(
        `SELECT COUNT(*) as count 
         FROM notifications 
         WHERE recipient_id = $1 
           AND recipient_type = $2 
           AND is_read = false`,
        [effectiveUserId, userType]
      );

      const unreadCount = parseInt(unreadCountResult.rows[0]?.count || '0', 10);

      return c.json({
        success: true,
        notifications: notifications.rows || [],
        total: (notifications.rows || []).length,
        unreadCount,
      });
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /notifications
   * Create a notification
   */
  app.post("/notifications", async (c) => {
    try {
      const notificationData = await c.req.json();
      const {
        userId,
        userType,
        notificationType,
        title,
        message,
        data,
        sendSms,
        sendPush,
      } = notificationData;

      if (!userId || !userType || !notificationType || !title || !message) {
        return c.json({ error: 'userId, userType, notificationType, title, and message are required' }, 400);
      }

      const channelConfig = {
        email: false,
        sms: sendSms || false,
        inApp: true,
        push: sendPush || false,
      };

      // Create notification in database
      const notification = await insert('notifications', {
        recipient_id: userId, // Schema uses recipient_id, not user_id
        recipient_type: userType, // Schema uses recipient_type, not user_type
        notification_type: notificationType,
        title: title,
        message: message,
        channels: channelConfig,
        is_read: false,
        delivery_status: 'created',
      });

      const notificationId = notification[0]?.id as string | undefined;
      if (notificationId) {
        const deliveryChannels = await resolveChannelsFromRequest(channelConfig);
        await ensureDeliveryLogEntries(notificationId, deliveryChannels, {
          title,
          body: message,
          type: notificationType,
        });
        await finalizeInAppDelivery(notificationId);
      }

      // Send SMS if requested
      if (sendSms) {
        try {
          const isUatMode = process.env.UAT_MODE === 'true';
          if (!isUatMode) {
            console.warn('[SMS] Skipping free-form SMS from /notifications in production (DLT compliance).');
          } else {
            // Get user phone number
            let phone: string | null = null;
            if (userType === 'customer') {
              const customers = await select('customers', { id: userId });
              phone = customers[0]?.phone || null;
            } else if (userType === 'vendor') {
              const vendors = await select('vendors', { id: userId });
              phone = vendors[0]?.phone || null;
            }

            if (phone) {
              await sendSMS({
                to: phone,
                message: `${title}\n\n${message}`,
                type: 'transactional',
              });
            }
          }
        } catch (smsError) {
          console.error('Error sending SMS notification:', smsError);
          // Don't fail the request if SMS fails
        }
      }

      // Send push notification if requested via SNS
      if (sendPush) {
        try {
          const { publishNotification } = require('../utils/aws-clients');

          // Determine target type from userId
          let targetType: 'vendor' | 'customer' | 'admin' = userType as 'vendor' | 'customer' | 'admin';
          if (userId.startsWith('vendor_') || userId.startsWith('ven_')) {
            targetType = 'vendor';
          } else if (userId.startsWith('admin_') || userId.startsWith('adm_')) {
            targetType = 'admin';
          }

          await publishNotification(targetType, userId, {
            title: title,
            body: message,
            data: {
              notification_id: notification[0].id,
              type: notificationType,
              booking_id: data?.booking_id,
              payment_id: data?.payment_id,
            },
            type: notificationType,
          });

          console.log(`✅ Push notification sent via SNS to ${targetType}:${userId}`);
        } catch (error: any) {
          console.error('Error sending push notification via SNS:', error);
          // Don't fail the request if push notification fails
        }
      }

      return c.json({
        success: true,
        notification: notification[0],
        message: 'Notification created successfully',
      });
    } catch (error: any) {
      console.error('Error creating notification:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /notifications/:notificationId/read
   * Mark notification as read
   */
  app.put("/notifications/:notificationId/read", async (c) => {
    try {
      const { notificationId } = c.req.param();

      const existing = await query('SELECT id FROM notifications WHERE id = $1', [notificationId]);
      if ((existing.rows || []).length === 0) {
        return c.json({ error: 'Notification not found' }, 404);
      }

      await markNotificationsOpenedByIds([notificationId]);

      const updated = await query('SELECT * FROM notifications WHERE id = $1', [notificationId]);
      return c.json({
        success: true,
        notification: updated.rows[0],
        message: 'Notification marked as read',
      });
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /notifications/read-all
   * Mark all notifications as read for a user
   */
  app.put("/notifications/read-all", async (c) => {
    try {
      const { userId, userType } = await c.req.json();

      if (!userId || !userType) {
        return c.json({ error: 'userId and userType are required' }, 400);
      }

      await markAllNotificationsOpenedForRecipient(userId, userType);

      return c.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/notifications
   * Compatibility endpoint - Get notifications by phone (customer)
   * FIX: Improved error handling to return empty arrays instead of 500 errors
   */
  app.get("/customer/notifications", async (c) => {
    try {
      const phone = c.req.query('phone');
      const limit = parseInt(c.req.query('limit') || '50', 10);

      if (!phone) {
        return c.json({
          success: true,
          notifications: [],
          count: 0,
          settings: { ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS },
        }, 200);
      }

      let customerId: string | null = null;
      try {
        customerId = await resolveCustomerIdForNotificationPhone(phone);
      } catch (dbError: any) {
        console.error('Database error finding customer:', dbError);
        return c.json({
          success: true,
          notifications: [],
          count: 0,
          settings: { ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS },
        }, 200);
      }

      if (!customerId) {
        return c.json({
          success: true,
          notifications: [],
          count: 0,
          settings: { ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS },
        }, 200);
      }

      const settings = await fetchCustomerNotificationSettings(customerId);

      let notifications;
      try {
        notifications = await query(
          `SELECT * FROM notifications
           WHERE recipient_id = $1 AND recipient_type = 'customer'
           ORDER BY created_at DESC
           LIMIT $2`,
          [customerId, limit]
        );
      } catch (dbError: any) {
        console.error('Database error fetching notifications:', dbError);
        return c.json({
          success: true,
          notifications: [],
          count: 0,
          settings,
        }, 200);
      }

      return c.json({
        success: true,
        notifications: notifications.rows || [],
        count: (notifications.rows || []).length,
        settings,
      });
    } catch (error: any) {
      console.error('Error fetching customer notifications:', error);
      return c.json({
        success: true,
        notifications: [],
        count: 0,
        settings: { ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS },
      }, 200);
    }
  });

  /**
   * POST /customer/notifications?phone=
   * Save notification channel toggles (customer-web profile). Uses POST so API Gateway proxies match GET /customer/notifications.
   */
  app.post("/customer/notifications", async (c) => {
    try {
      const phone = c.req.query('phone');
      if (!phone?.trim()) {
        return c.json({ error: 'phone query parameter is required' }, 400);
      }

      const body = await c.req.json().catch(() => ({}));
      const customerId = await resolveCustomerIdForNotificationPhone(phone);

      if (!customerId) {
        const merged = normalizeCustomerNotificationSettings({
          ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
          ...(typeof body === 'object' && body ? body : {}),
        });
        return c.json({ success: true, settings: merged, persisted: false });
      }

      try {
        const merged = await persistCustomerNotificationSettings(customerId, body);
        return c.json({ success: true, settings: merged, persisted: true });
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('column "preferences"')) {
          const merged = normalizeCustomerNotificationSettings({
            ...DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS,
            ...(typeof body === 'object' && body ? body : {}),
          });
          return c.json({ success: true, settings: merged, persisted: false });
        }
        throw err;
      }
    } catch (error: any) {
      console.error('Error saving customer notification settings:', error);
      return c.json({ error: error?.message || 'Failed to save notification settings' }, 500);
    }
  });

  /**
   * POST /notifications/mark-read
   * Compatibility endpoint - Mark notification as read
   */
  app.post("/notifications/mark-read", async (c) => {
    try {
      const { notificationId } = await c.req.json();

      if (!notificationId) {
        return c.json({ error: 'notificationId is required' }, 400);
      }

      const existing = await query('SELECT id FROM notifications WHERE id = $1', [notificationId]);
      if ((existing.rows || []).length === 0) {
        return c.json({ error: 'Notification not found' }, 404);
      }

      await markNotificationsOpenedByIds([notificationId]);

      const updated = await query('SELECT * FROM notifications WHERE id = $1', [notificationId]);
      return c.json({
        success: true,
        notification: updated.rows[0],
      });
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /notifications/mark-all-read
   * Compatibility endpoint - Mark all notifications as read by phone
   */
  app.post("/notifications/mark-all-read", async (c) => {
    try {
      const { phone } = await c.req.json();

      if (!phone) {
        return c.json({ error: 'phone is required' }, 400);
      }

      // Find customer by phone
      const customers = await select('customers', { phone: phone.replace(/[^0-9]/g, '') });
      if (customers.length === 0) {
        return c.json({ success: true, message: 'No notifications to mark' });
      }

      const customerId = customers[0].id;

      await markAllNotificationsOpenedForRecipient(customerId, 'customer');

      return c.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /notifications/:id
   * Delete a notification
   */
  app.delete("/notifications/:id", async (c) => {
    try {
      const { id } = c.req.param();

      const result = await query(
        'DELETE FROM notifications WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return c.json({ error: 'Notification not found' }, 404);
      }

      return c.json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /notifications/process-scheduled
   * EventBridge cron: drain scheduled_notifications rows due for delivery.
   */
  app.post('/notifications/process-scheduled', async (c) => {
    if (!isNotificationCronEnabled()) {
      return c.json(cronPipelineSkippedPayload());
    }
    try {
      const result = await processDueScheduledNotifications();
      console.log(JSON.stringify({ metric: 'scheduled_notifications_cron', ...result }));
      return c.json({ success: true, ...result });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Scheduled notification cron failed';
      return c.json({ success: false, error: msg }, 500);
    }
  });
}
