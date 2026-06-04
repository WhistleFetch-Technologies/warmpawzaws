/**
 * Notification delivery state machine (migration 1020).
 * Shared by API handlers, SQS processor, and admin monitoring.
 */

import { query } from '../database/rds-connection';

export type NotificationDeliveryStatus =
  | 'created'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'failed'
  | 'expired';

export type NotificationDeliveryChannel = 'push' | 'sms' | 'email' | 'in_app' | 'whatsapp';

const STATUS_TIMESTAMP: Partial<Record<NotificationDeliveryStatus, string>> = {
  queued: 'queued_at',
  sent: 'sent_at',
  delivered: 'delivered_at',
  opened: 'opened_at',
  failed: 'failed_at',
  expired: 'expired_at',
};

export interface DeliveryLogPayload {
  title?: string;
  body?: string;
  type?: string;
  [key: string]: unknown;
}

export async function validateNotificationTransition(
  notificationId: string,
  newStatus: NotificationDeliveryStatus
): Promise<{ allowed: boolean; reason: string }> {
  const result = await query(
    `SELECT allowed, reason
     FROM validate_notification_state_transition($1::uuid, $2)`,
    [notificationId, newStatus]
  );
  const row = result.rows?.[0];
  return {
    allowed: row?.allowed === true,
    reason: String(row?.reason || 'Unknown'),
  };
}

export async function transitionNotificationDelivery(
  notificationId: string,
  status: NotificationDeliveryStatus,
  extra?: { failureReason?: string; channel?: NotificationDeliveryChannel }
): Promise<void> {
  const timestampCol = STATUS_TIMESTAMP[status];
  if (!timestampCol) {
    throw new Error(`No timestamp column for delivery status: ${status}`);
  }

  const params: unknown[] = [notificationId, status];
  let failureClause = '';
  if (status === 'failed' && extra?.failureReason) {
    params.push(extra.failureReason);
    failureClause = ', failure_reason = $3';
  }

  await query(
    `UPDATE notifications
     SET delivery_status = $2::notification_delivery_status,
         ${timestampCol} = NOW()${failureClause}
     WHERE id = $1`,
    params
  );

  const logParams: unknown[] = [notificationId, status];
  let logFailureClause = '';
  if (status === 'failed' && extra?.failureReason) {
    logParams.push(extra.failureReason);
    logFailureClause = ', error_message = $3';
  }

  const channelClause = extra?.channel ? ` AND channel = $${logParams.length + 1}` : '';
  if (extra?.channel) {
    logParams.push(extra.channel);
  }

  await query(
    `UPDATE notification_delivery_log
     SET status = $2::notification_delivery_status,
         ${timestampCol} = NOW(),
         updated_at = NOW()${logFailureClause}
     WHERE notification_id = $1
       AND status NOT IN ('failed', 'expired')${channelClause}`,
    logParams
  );
}

export async function ensureDeliveryLogEntries(
  notificationId: string,
  channels: NotificationDeliveryChannel[],
  payload?: DeliveryLogPayload
): Promise<void> {
  for (const channel of channels) {
    await query(
      `INSERT INTO notification_delivery_log (notification_id, channel, status, payload)
       VALUES ($1, $2, 'created'::notification_delivery_status, $3::jsonb)
       ON CONFLICT (notification_id, channel, attempt_number) DO NOTHING`,
      [notificationId, channel, JSON.stringify(payload || {})]
    );
  }
}

export async function resolveChannelsFromRequest(channels?: {
  inApp?: boolean;
  push?: boolean;
  sms?: boolean;
  email?: boolean;
  whatsapp?: boolean;
}): Promise<NotificationDeliveryChannel[]> {
  const resolved: NotificationDeliveryChannel[] = ['in_app'];
  if (channels?.push) resolved.push('push');
  if (channels?.sms) resolved.push('sms');
  if (channels?.email) resolved.push('email');
  if (channels?.whatsapp) resolved.push('whatsapp');
  return [...new Set(resolved)];
}

/** In-app notifications are persisted immediately — advance through delivery lifecycle. */
export async function finalizeInAppDelivery(notificationId: string): Promise<void> {
  await transitionNotificationDelivery(notificationId, 'queued', { channel: 'in_app' });
  await transitionNotificationDelivery(notificationId, 'sent', { channel: 'in_app' });
  await transitionNotificationDelivery(notificationId, 'delivered', { channel: 'in_app' });
}

export async function markChannelDeliveryFailed(
  notificationId: string,
  channel: NotificationDeliveryChannel,
  errorMessage: string
): Promise<void> {
  await query(
    `UPDATE notification_delivery_log
     SET status = 'failed'::notification_delivery_status,
         failed_at = NOW(),
         updated_at = NOW(),
         error_message = $3
     WHERE notification_id = $1 AND channel = $2`,
    [notificationId, channel, errorMessage]
  );
}

export async function markNotificationsOpenedByIds(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;

  await query(
    `UPDATE notifications
     SET is_read = true,
         read_at = COALESCE(read_at, NOW()),
         delivery_status = CASE
           WHEN delivery_status NOT IN ('opened', 'failed', 'expired') THEN 'opened'::notification_delivery_status
           ELSE delivery_status
         END,
         opened_at = CASE
           WHEN delivery_status NOT IN ('opened', 'failed', 'expired') THEN NOW()
           ELSE opened_at
         END
     WHERE id = ANY($1::uuid[])`,
    [notificationIds]
  );

  await query(
    `UPDATE notification_delivery_log
     SET status = 'opened'::notification_delivery_status,
         opened_at = NOW(),
         updated_at = NOW()
     WHERE notification_id = ANY($1::uuid[])
       AND channel = 'in_app'
       AND status NOT IN ('opened', 'failed', 'expired')`,
    [notificationIds]
  );
}

export async function getDeliveryLogForNotification(notificationId: string) {
  const result = await query(
    `SELECT id, channel, attempt_number, status::text AS status, provider, provider_message_id,
            error_code, error_message, queued_at, sent_at, delivered_at, opened_at, failed_at,
            created_at, updated_at
     FROM notification_delivery_log
     WHERE notification_id = $1
     ORDER BY channel, attempt_number`,
    [notificationId]
  );
  return result.rows || [];
}

export async function getDeliveryStats() {
  const result = await query(
    `SELECT delivery_status::text AS status, COUNT(*)::int AS count
     FROM notifications
     GROUP BY delivery_status`
  );
  const stats: Record<string, number> = {
    created: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    failed: 0,
    expired: 0,
  };
  for (const row of result.rows || []) {
    stats[String(row.status)] = Number(row.count) || 0;
  }
  return stats;
}
