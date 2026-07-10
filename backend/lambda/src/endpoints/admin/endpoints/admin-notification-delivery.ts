/**
 * Admin endpoints for notification delivery engine monitoring (migration 1020).
 */

import { Hono } from 'hono';
import { insert, query } from '../../../database/rds-connection';
import {
  ensureDeliveryLogEntries,
  finalizeInAppDelivery,
  getDeliveryLogForNotification,
  getDeliveryStats,
  resolveChannelsFromRequest,
} from '../../../utils/notification-delivery';
import { purgeOldNotificationDeliveryLogs } from '../../../utils/scheduled-notification-drain';
import {
  cronPipelineSkippedPayload,
  isNotificationCronEnabled,
} from '../../../utils/notification-pipeline-kill-switch';

export function registerAdminNotificationDeliveryEndpoints(app: Hono) {
  /**
   * GET /admin/notifications/delivery/stats
   * Aggregate counts by delivery_status.
   */
  app.get('/admin/notifications/delivery/stats', async (c) => {
    try {
      const stats = await getDeliveryStats();
      const total = Object.values(stats).reduce((sum, n) => sum + n, 0);
      return c.json({ success: true, stats, total });
    } catch (error: unknown) {
      console.error('[admin-notification-delivery] stats error:', error);
      return c.json({ success: true, stats: {}, total: 0 });
    }
  });

  /**
   * GET /admin/notifications/delivery
   * List inbox notifications with delivery lifecycle fields.
   */
  app.get('/admin/notifications/delivery', async (c) => {
    try {
      const status = c.req.query('status');
      const recipientType = c.req.query('recipientType');
      const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      const params: unknown[] = [];
      const conditions: string[] = [];

      if (status) {
        params.push(status);
        conditions.push(`n.delivery_status = $${params.length}::notification_delivery_status`);
      }
      if (recipientType) {
        params.push(recipientType);
        conditions.push(`n.recipient_type = $${params.length}`);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      params.push(limit, offset);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;

      const result = await query(
        `SELECT
           n.id,
           n.recipient_type,
           n.recipient_id,
           n.notification_type,
           n.title,
           n.message,
           n.channels,
           n.is_read,
           n.delivery_status::text AS delivery_status,
           n.queued_at,
           n.sent_at,
           n.delivered_at,
           n.opened_at,
           n.failed_at,
           n.failure_reason,
           n.created_at,
           COALESCE(log_stats.channel_count, 0)::int AS channel_count,
           COALESCE(log_stats.failed_channels, 0)::int AS failed_channels
         FROM notifications n
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS channel_count,
                  COUNT(*) FILTER (WHERE status = 'failed') AS failed_channels
           FROM notification_delivery_log
           WHERE notification_id = n.id
         ) log_stats ON true
         ${where}
         ORDER BY n.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
      );

      return c.json({
        success: true,
        notifications: result.rows || [],
        limit,
        offset,
      });
    } catch (error: unknown) {
      console.error('[admin-notification-delivery] list error:', error);
      return c.json({ success: true, notifications: [], limit: 50, offset: 0 });
    }
  });

  /**
   * GET /admin/notifications/:id/delivery-log
   * Per-channel delivery audit trail for one notification.
   */
  app.get('/admin/notifications/:id/delivery-log', async (c) => {
    try {
      const { id } = c.req.param();
      const logs = await getDeliveryLogForNotification(id);
      return c.json({ success: true, logs });
    } catch (error: unknown) {
      console.error('[admin-notification-delivery] delivery-log error:', error);
      return c.json({ success: true, logs: [] });
    }
  });

  /**
   * POST /admin/notifications/test
   * Send a test inbox notification through the delivery engine.
   */
  app.post('/admin/notifications/test', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const {
        recipientId,
        recipientType = 'customer',
        title,
        message,
        notificationType = 'admin_test',
        sendPush = false,
        sendSms = false,
      } = body;

      if (!recipientId || !title || !message) {
        return c.json({ error: 'recipientId, title, and message are required' }, 400);
      }

      const channels = {
        inApp: true,
        push: !!sendPush,
        sms: !!sendSms,
        email: false,
      };

      const inserted = await insert('notifications', {
        recipient_id: recipientId,
        recipient_type: recipientType,
        notification_type: notificationType,
        title,
        message,
        channels,
        is_read: false,
        delivery_status: 'created',
      });

      const notificationId = inserted[0]?.id as string | undefined;
      if (!notificationId) {
        return c.json({ error: 'Failed to create notification' }, 500);
      }

      const deliveryChannels = await resolveChannelsFromRequest(channels);
      await ensureDeliveryLogEntries(notificationId, deliveryChannels, {
        title,
        body: message,
        type: notificationType,
      });
      await finalizeInAppDelivery(notificationId);

      return c.json({
        success: true,
        notification: inserted[0],
        message: 'Test notification created and in-app delivery finalized',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      console.error('[admin-notification-delivery] test send error:', error);
      return c.json({ error: msg }, 500);
    }
  });

  /**
   * POST /admin/notifications/delivery-log/retention
   * EventBridge daily cron: purge delivery log rows older than retention window.
   */
  app.post('/admin/notifications/delivery-log/retention', async (c) => {
    if (!isNotificationCronEnabled()) {
      return c.json({ ...cronPipelineSkippedPayload(), deleted: 0, retentionDays: 90 });
    }
    try {
      const body = await c.req.json().catch(() => ({}));
      const retentionDays = Math.max(
        30,
        Math.min(parseInt(String((body as { retentionDays?: number }).retentionDays || 90), 10) || 90, 365)
      );
      const deleted = await purgeOldNotificationDeliveryLogs(retentionDays);
      console.log(
        JSON.stringify({ metric: 'notification_delivery_log_retention', deleted, retentionDays })
      );
      return c.json({ success: true, deleted, retentionDays });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Retention purge failed';
      return c.json({ success: false, error: msg }, 500);
    }
  });
}
