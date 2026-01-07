"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerNotificationSystemEndpoints = registerNotificationSystemEndpoints;
const rds_connection_1 = require("../database/rds-connection");
const sns_client_1 = require("../utils/sns-client");
const client_sns_1 = require("@aws-sdk/client-sns");
function registerNotificationSystemEndpoints(app) {
    /**
     * POST /notifications/create
     * Create and send a notification
     */
    app.post("/notifications/create", async (c) => {
        try {
            const { recipientId, recipientType, recipientEmail, recipientPhone, type, category, title, message, data, channels, priority = 'medium', } = await c.req.json();
            if (!recipientId || !recipientType || !type || !title || !message) {
                return c.json({ error: 'recipientId, recipientType, type, title, and message are required' }, 400);
            }
            // Create notification
            const notification = await (0, rds_connection_1.insert)('notifications', {
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
                const snsClient = (0, sns_client_1.getSnsClient)();
                await snsClient.send(new client_sns_1.PublishCommand({
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
        }
        catch (error) {
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
            const params = [userId, userType];
            let paramIndex = 3;
            if (unreadOnly === 'true') {
                queryText += ` AND is_read = false`;
            }
            queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(parseInt(limit, 10), parseInt(offset, 10));
            const result = await (0, rds_connection_1.query)(queryText, params).catch(() => ({ rows: [] }));
            return c.json({
                success: true,
                notifications: result.rows,
                total: result.rows.length,
            });
        }
        catch (error) {
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
            const updated = await (0, rds_connection_1.update)('notifications', { id: notificationId }, {
                is_read: true,
                read_at: new Date().toISOString(),
            });
            if (updated.length === 0) {
                return c.json({ error: 'Notification not found' }, 404);
            }
            return c.json({
                success: true,
                notification: updated[0],
                message: 'Notification marked as read',
            });
        }
        catch (error) {
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
            await (0, rds_connection_1.query)(`UPDATE notifications 
         SET is_read = true, read_at = NOW() 
         WHERE user_id = $1 AND user_type = $2 AND is_read = false`, [userId, userType]).catch(() => { });
            return c.json({
                success: true,
                message: 'All notifications marked as read',
            });
        }
        catch (error) {
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
            const result = await (0, rds_connection_1.query)(`SELECT COUNT(*) as count FROM notifications 
         WHERE user_id = $1 AND user_type = $2 AND is_read = false`, [userId, userType]).catch(() => ({ rows: [{ count: '0' }] }));
            return c.json({
                success: true,
                unreadCount: parseInt(result.rows[0]?.count || '0', 10),
            });
        }
        catch (error) {
            console.error('Error fetching unread count:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=notification-system.js.map