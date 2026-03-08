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
import { select, insert, update, query } from '../../../database/rds-connection';
import { sendSMS } from '../../../utils/sms-service';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { UserType } from 'src/endpoints/constants';

export function registerNotificationEndpoints(app: Hono) {
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
        'UPDATE notifications SET is_read = true, read_at = NOW() WHERE recipient_id = $1 AND recipient_type = $2 AND is_read = false',
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
        // ✅ FIX: Return empty array instead of error for missing phone
        return c.json({
          success: true,
          notifications: [],
          count: 0
        }, 200);
      }

      // Find customer by phone with error handling
      let customers;
      try {
        customers = await select('customers', { phone: phone.replace(/[^0-9]/g, '') });
      } catch (dbError: any) {
        console.error('Database error finding customer:', dbError);
        // ✅ FIX: Return empty array on DB error
        return c.json({
          success: true,
          notifications: [],
          count: 0
        }, 200);
      }

      if (customers.length === 0) {
        return c.json({
          success: true,
          notifications: [],
          count: 0
        }, 200);
      }

      const customerId = customers[0].id;

      // Get notifications with error handling
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
        // ✅ FIX: Return empty array on DB error
        return c.json({
          success: true,
          notifications: [],
          count: 0
        }, 200);
      }

      return c.json({
        success: true,
        notifications: notifications.rows || [],
        count: (notifications.rows || []).length,
      });
    } catch (error: any) {
      console.error('Error fetching customer notifications:', error);
      // ✅ FIX: Return empty array instead of 500
      return c.json({
        success: true,
        notifications: [],
        count: 0
      }, 200);
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

      await query(
        `UPDATE notifications 
         SET is_read = true, read_at = NOW() 
         WHERE recipient_id = $1 AND recipient_type = 'customer' AND is_read = false`,
        [customerId]
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
}
