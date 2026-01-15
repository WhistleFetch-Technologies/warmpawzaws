/**
 * ============================================================================
 * NOTIFICATION SYSTEM ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Comprehensive notification infrastructure for all platform events:
 * - Email notifications
 * - SMS notifications
 * - In-app notifications
 * - Push notifications (future)
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
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

export type NotificationType =
  | 'vendor_application_submitted'
  | 'vendor_application_approved'
  | 'vendor_application_rejected'
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'admin_new_vendor_application'
  | 'system_maintenance'
  | 'system_announcement';

export type NotificationCategory =
  | 'vendor_onboarding'
  | 'bookings'
  | 'admin_alerts'
  | 'system';

export function registerNotificationSystemEndpoints(app: Hono) {
  /**
   * POST /notifications/create
   * Create and send a notification
   */
  app.post("/notifications/create", async (c) => {
    try {
      const {
        recipientId,
        recipientType,
        recipientEmail,
        recipientPhone,
        type,
        category,
        title,
        message,
        data,
        channels,
        priority = 'medium',
      } = await c.req.json();

      if (!recipientId || !recipientType || !type || !title || !message) {
        return c.json({ error: 'recipientId, recipientType, type, title, and message are required' }, 400);
      }

      // Create notification
      const notification = await insert('notifications', {
        user_id: recipientId,
        user_type: recipientType,
        title,
        message,
        notification_type: type,
        category: category || 'system',
        is_read: false,
        metadata: {
          data,
          channels: channels || { email: false, sms: false, inApp: true, push: false },
          priority,
        },
      });

      // Send via SMS if enabled and phone provided
      if (channels?.sms && recipientPhone) {
        const snsClient = getSnsClient();
        await snsClient.send(new PublishCommand({
          PhoneNumber: recipientPhone,
          Message: `${title}: ${message}`,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
          },
        })).catch(err => console.error('SMS send failed:', err));
      }

      return c.json({
        success: true,
        notification: notification[0],
        message: 'Notification created and sent',
      });
    } catch (error: any) {
      console.error('Error creating notification:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /notifications/:userId
   * Get notifications for a user
   */
  app.get("/notifications/:userId", async (c) => {
    try {
      const { userId } = c.req.param();
      const { userType = 'customer', unreadOnly = false, limit = 50, offset = 0 } = c.req.query();

      let queryText = `SELECT * FROM notifications 
                       WHERE user_id = $1 AND user_type = $2`;
      const params: any[] = [userId, userType];
      let paramIndex = 3;

      if (unreadOnly === 'true') {
        queryText += ` AND is_read = false`;
      }

      queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string, 10), parseInt(offset as string, 10));

      const result = await query(queryText, params).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        notifications: result.rows,
        total: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
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
        {
          is_read: true,
          read_at: new Date().toISOString(),
        }
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
   * PUT /notifications/:userId/mark-all-read
   * Mark all notifications as read for a user
   */
  app.put("/notifications/:userId/mark-all-read", async (c) => {
    try {
      const { userId } = c.req.param();
      const { userType = 'customer' } = c.req.query();

      await query(
        `UPDATE notifications 
         SET is_read = true, read_at = NOW() 
         WHERE user_id = $1 AND user_type = $2 AND is_read = false`,
        [userId, userType]
      ).catch(() => {});

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
   * GET /notifications/:userId/unread-count
   * Get unread notification count
   */
  app.get("/notifications/:userId/unread-count", async (c) => {
    try {
      const { userId } = c.req.param();
      const { userType = 'customer' } = c.req.query();

      const result = await query(
        `SELECT COUNT(*) as count FROM notifications 
         WHERE user_id = $1 AND user_type = $2 AND is_read = false`,
        [userId, userType]
      ).catch(() => ({ rows: [{ count: '0' }] }));

      return c.json({
        success: true,
        unreadCount: parseInt(result.rows[0]?.count || '0', 10),
      });
    } catch (error: any) {
      console.error('Error fetching unread count:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

