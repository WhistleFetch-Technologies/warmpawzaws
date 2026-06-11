/**
 * Drains scheduled notification queues (DB rows) via unified dispatcher.
 */

import { query, update } from '../database/rds-connection';
import { dispatchNotification } from './notification-dispatch';
import { executeCampaignDelivery } from './notification-campaign-processor';
import { loadCampaignTargeting } from './notification-campaign-targeting';

const BATCH_LIMIT = 100;

export async function processDueScheduledNotifications(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  const due = await query(
    `SELECT id, recipient_id, recipient_type, title, body, data, priority, related_id
     FROM scheduled_notifications
     WHERE status = 'pending' AND scheduled_at <= NOW()
     ORDER BY scheduled_at ASC
     LIMIT $1`,
    [BATCH_LIMIT]
  );

  const rows = due.rows || [];
  for (const row of rows) {
    const id = String(row.id);
    try {
      const data =
        row.data && typeof row.data === 'object'
          ? (row.data as Record<string, unknown>)
          : row.data
            ? JSON.parse(String(row.data))
            : {};

      const notificationType = String(data.eventType || data.type || 'scheduled_notification');
      const result = await dispatchNotification({
        recipientId: String(row.recipient_id),
        recipientType: row.recipient_type as 'customer' | 'vendor' | 'admin' | 'staff',
        notificationType,
        title: String(row.title),
        message: String(row.body),
        channels: { inApp: true, push: true },
        priority: row.priority === 'high' ? 'high' : 'normal',
        data: {
          ...data,
          relatedId: row.related_id,
          dedupeKey: String(data.dedupeKey || `scheduled-${id}`),
        },
      });

      if (result.inboxOk) {
        sent += 1;
        await update('scheduled_notifications', { id }, {
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
      } else {
        failed += 1;
        errors.push(`scheduled ${id}: inbox insert failed`);
        await update('scheduled_notifications', { id }, {
          status: 'failed',
        }).catch(() => undefined);
      }
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`scheduled ${id}: ${msg}`);
      await update('scheduled_notifications', { id }, {
        status: 'failed',
      }).catch(() => undefined);
    }
  }

  return { processed: rows.length, sent, failed, errors };
}

export async function processDueScheduledCampaigns(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  const due = await query(
    `SELECT id FROM notification_campaigns
     WHERE status = 'SCHEDULED'
       AND scheduled_at_utc IS NOT NULL
       AND scheduled_at_utc <= NOW()
     ORDER BY scheduled_at_utc ASC
     LIMIT $1`,
    [BATCH_LIMIT]
  );

  const rows = due.rows || [];
  for (const row of rows) {
    const campaignId = String(row.id);
    try {
      const campaignResult = await query('SELECT * FROM notification_campaigns WHERE id = $1', [campaignId]);
      const campaign = campaignResult.rows?.[0];
      if (!campaign) continue;

      const targeting = await loadCampaignTargeting(campaignId);
      const delivery = await executeCampaignDelivery(campaign, targeting, null);

      if (delivery.status === 'SENT' || delivery.sentRecipients > 0) {
        sent += 1;
      } else {
        failed += 1;
        errors.push(`campaign ${campaignId}: ${delivery.errors.join('; ') || 'delivery failed'}`);
      }
    } catch (err) {
      failed += 1;
      errors.push(`campaign ${campaignId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { processed: rows.length, sent, failed, errors };
}

export async function purgeOldNotificationDeliveryLogs(retentionDays = 90): Promise<number> {
  const result = await query(
    `DELETE FROM notification_delivery_log
     WHERE created_at < NOW() - ($1::int || ' days')::interval`,
    [retentionDays]
  );
  return result.rowCount ?? 0;
}
