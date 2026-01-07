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
 * Migrated from: supabase/functions/server/notification-system.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { getSnsClient } from '../utils/sns-client';
import { PublishCommand } from '@aws-sdk/client-sns';

export function registerNotificationEndpoints(app: Hono) {
  /**
   * GET /notifications
   * Get notifications for a user
   */
  app.get("/notifications", async (c) => {
    try {
      const userId = c.req.query('userId');
      const userType = c.req.query('userType') || 'customer'; // customer, vendor, admin
      const isRead = c.req.query('isRead');
      const limit = parseInt(c.req.query('limit') || '50', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      if (!userId) {
        return c.json({ error: 'userId is required' }, 400);
      }

      let notificationQuery = `
        SELECT * FROM notifications
        WHERE recipient_id = $1 AND recipient_type = $2
      `;

      const params: any[] = [userId, userType];
      let paramIndex = 3;

      if (isRead !== undefined) {
        notificationQuery += ` AND is_read = $${paramIndex}`;
        params.push(isRead === 'true');
        paramIndex++;
      }

      notificationQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const notifications = await query(notificationQuery, params);

      // Count unread
      const unreadCount = await query(
        'SELECT COUNT(*) as count FROM notifications WHERE recipient_id = $1 AND recipient_type = $2 AND is_read = false',
        [userId, userType]
      );

      return c.json({
        success: true,
        notifications: notifications.rows,
        total: notifications.rows.length,
        unreadCount: parseInt(unreadCount.rows[0]?.count || '0', 10),
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

      // Create notification in database
      const notification = await insert('notifications', {
        recipient_id: userId, // Schema uses recipient_id, not user_id
        recipient_type: userType, // Schema uses recipient_type, not user_type
        notification_type: notificationType,
        title: title,
        message: message,
        channels: {
          email: sendSms || false, // Note: sendSms param name is misleading, should be sendEmail
          sms: sendSms || false,
          inApp: true,
          push: sendPush || false,
        },
        is_read: false,
      });

      // Send SMS if requested
      if (sendSms) {
        try {
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
            const snsClient = getSnsClient();
            await snsClient.send(new PublishCommand({
              PhoneNumber: phone,
              Message: `${title}\n\n${message}`,
              MessageAttributes: {
                'AWS.SNS.SMS.SMSType': {
                  DataType: 'String',
                  StringValue: 'Transactional',
                },
              },
            }));
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
          
          // Determine target type from recipient_id
          let targetType: 'vendor' | 'customer' | 'admin' = 'customer';
          if (recipientId.startsWith('vendor_') || recipientId.startsWith('ven_')) {
            targetType = 'vendor';
          } else if (recipientId.startsWith('admin_') || recipientId.startsWith('adm_')) {
            targetType = 'admin';
          }
          
          await publishNotification(targetType, recipientId, {
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
          
          console.log(`✅ Push notification sent via SNS to ${targetType}:${recipientId}`);
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

      const updated = await update('notifications',
        { id: notificationId },
        { is_read: true, read_at: new Date() }
      );

      if (updated.length === 0) {
        return c.json({ error: 'Notification not found' }, 404);
      }

      return c.json({
        success: true,
        notification: updated[0],
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

      await query(
        'UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND user_type = $2 AND is_read = false',
        [userId, userType]
      );

      return c.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

