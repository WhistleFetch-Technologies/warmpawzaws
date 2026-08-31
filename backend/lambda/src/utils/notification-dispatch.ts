/**
 * Unified notification dispatcher: inbox + delivery log + Firebase Admin tray push.
 */

import { insert, query } from '../database/rds-connection';
import {
  ensureDeliveryLogEntries,
  finalizeInAppDelivery,
  markChannelDeliveryFailed,
  resolveChannelsFromRequest,
  transitionNotificationDelivery,
} from './notification-delivery';
import {
  classifyFcmError,
  deactivateDeviceTokens,
  sendPushToMultipleDevices,
  type PushNotificationPayload,
} from './firebase-client';
import { resolveNotificationDeepLink, type DeepLinkRecipientType } from './notification-deep-links';
import { fetchCustomerNotificationSettings } from './customer-notification-settings';
import {
  dispatchPipelineDisabledResult,
  isNotificationPipelineEnabled,
} from './notification-pipeline-kill-switch';
import { pushDeliveryNeedsRetry } from './notification-idempotency';

const PUSH_BATCH_SIZE = 500;
const DEDUPE_LOOKBACK_HOURS = 48;

export type DispatchRecipientType = DeepLinkRecipientType;

export interface DispatchChannels {
  inApp?: boolean;
  push?: boolean;
  sms?: boolean;
  email?: boolean;
}

export interface DispatchNotificationInput {
  recipientId: string;
  recipientType: DispatchRecipientType;
  notificationType: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels?: DispatchChannels;
  priority?: 'normal' | 'high';
  imageUrl?: string;
  deepLinkOverride?: string;
  /** Skip user preference checks (admin/system alerts). */
  forcePush?: boolean;
}

export interface DispatchNotificationResult {
  inboxOk: boolean;
  notificationId?: string;
  skippedDuplicate: boolean;
  pushSent: number;
  pushFailed: number;
  tokensDeactivated: number;
  pushSkippedReason?: string;
}

function stringifyFcmData(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}

function isBookingRelatedEvent(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return (
    t.includes('booking') ||
    t.includes('video_call') ||
    t.includes('tele_') ||
    t === 'rating_request' ||
    t === 'chat_message'
  );
}

function isPromotionalEvent(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return t === 'campaign' || t.includes('promotion');
}

async function isGlobalPushEnabled(recipientType: DispatchRecipientType): Promise<boolean> {
  const appType = recipientType === 'vendor' ? 'VENDOR' : recipientType === 'customer' ? 'CUSTOMER' : null;
  if (!appType) return true;
  const result = await query(
    `SELECT push_enabled FROM notification_channel_settings WHERE app_type = $1 LIMIT 1`,
    [appType]
  ).catch(() => ({ rows: [{ push_enabled: true }] }));
  return result.rows?.[0]?.push_enabled !== false;
}

async function isUserPushEnabled(
  recipientId: string,
  recipientType: DispatchRecipientType,
  eventType: string,
  forcePush?: boolean
): Promise<{ push: boolean; reason?: string }> {
  if (forcePush) return { push: true };

  const globalOk = await isGlobalPushEnabled(recipientType);
  if (!globalOk) return { push: false, reason: 'global_push_disabled' };

  if (recipientType === 'customer') {
    const settings = await fetchCustomerNotificationSettings(recipientId);
    if (!settings.push) return { push: false, reason: 'user_push_disabled' };
    if (isBookingRelatedEvent(eventType) && !settings.bookingUpdates) {
      return { push: false, reason: 'user_booking_updates_disabled' };
    }
    if (isPromotionalEvent(eventType) && !settings.promotions) {
      return { push: false, reason: 'user_promotions_disabled' };
    }
  }

  return { push: true };
}

async function findDuplicateNotification(
  recipientId: string,
  recipientType: string,
  notificationType: string,
  dedupeKey: string
): Promise<string | null> {
  const result = await query(
    `SELECT id FROM notifications
     WHERE recipient_id = $1::uuid
       AND recipient_type = $2
       AND notification_type = $3
       AND (data->>'dedupeKey') = $4
       AND created_at > NOW() - ($5::int || ' hours')::interval
     ORDER BY created_at DESC
     LIMIT 1`,
    [recipientId, recipientType, notificationType, dedupeKey, DEDUPE_LOOKBACK_HOURS]
  ).catch(() => ({ rows: [] }));

  return result.rows?.[0]?.id ? String(result.rows[0].id) : null;
}

async function loadActiveFcmTokens(
  userId: string,
  userType: string
): Promise<string[]> {
  const { loadFreshActiveFcmTokens } = await import('./device-token-hygiene');
  return loadFreshActiveFcmTokens(userId, userType);
}

async function sendPushWithHygiene(
  fcmTokens: string[],
  payload: PushNotificationPayload,
  notificationId: string
): Promise<{ pushSent: number; pushFailed: number; tokensDeactivated: number }> {
  if (fcmTokens.length === 0) {
    await markChannelDeliveryFailed(notificationId, 'push', 'No active device tokens');
    return { pushSent: 0, pushFailed: 1, tokensDeactivated: 0 };
  }

  let pushSent = 0;
  let pushFailed = 0;
  let tokensDeactivated = 0;
  const tokensToRetry: string[] = [];

  const deliverBatch = async (tokens: string[], isRetry: boolean) => {
    for (let i = 0; i < tokens.length; i += PUSH_BATCH_SIZE) {
      const batch = tokens.slice(i, i + PUSH_BATCH_SIZE);
      const pushResult = await sendPushToMultipleDevices(batch, payload);

      for (let j = 0; j < batch.length; j++) {
        const token = batch[j];
        const result = pushResult.results[j];
        if (result?.success) {
          pushSent += 1;
          continue;
        }

        const classification = classifyFcmError(result?.errorCode, result?.error);
        if (classification === 'permanent') {
          pushFailed += 1;
          const deactivated = await deactivateDeviceTokens([token]);
          tokensDeactivated += deactivated;
        } else if (classification === 'transient' && !isRetry) {
          tokensToRetry.push(token);
        } else {
          pushFailed += 1;
        }
      }
    }
  };

  await deliverBatch(fcmTokens, false);

  if (tokensToRetry.length > 0) {
    await new Promise((r) => setTimeout(r, 500));
    await deliverBatch(tokensToRetry, true);
  }

  if (pushFailed > 0 && pushSent === 0) {
    await markChannelDeliveryFailed(notificationId, 'push', 'All push attempts failed');
  } else if (pushSent > 0) {
    await transitionNotificationDelivery(notificationId, 'sent', { channel: 'push' }).catch(() => undefined);
  }

  return { pushSent, pushFailed, tokensDeactivated };
}

/**
 * Dispatch in-app notification and optional tray push via Firebase Admin.
 */
export async function dispatchNotification(
  input: DispatchNotificationInput
): Promise<DispatchNotificationResult> {
  if (!isNotificationPipelineEnabled()) {
    console.log(
      JSON.stringify({
        metric: 'notification_dispatch',
        status: 'pipeline_disabled',
        type: input.notificationType,
        recipientType: input.recipientType,
      })
    );
    return dispatchPipelineDisabledResult();
  }

  const started = Date.now();
  const channels = {
    inApp: input.channels?.inApp !== false,
    push: input.channels?.push !== false,
    sms: input.channels?.sms === true,
    email: input.channels?.email === true,
  };

  const dataRecord: Record<string, unknown> = { ...(input.data || {}) };
  const dedupeKey = String(
    dataRecord.dedupeKey ||
      `${input.notificationType}-${input.recipientId}-${dataRecord.relatedId || dataRecord.bookingId || dataRecord.orderId || 'none'}`
  );
  dataRecord.dedupeKey = dedupeKey;

  let notificationId: string | undefined;
  let inboxOk = false;
  let skippedDuplicate = false;

  if (channels.inApp) {
    const existingId = await findDuplicateNotification(
      input.recipientId,
      input.recipientType,
      input.notificationType,
      dedupeKey
    );
    if (existingId) {
      skippedDuplicate = true;
      notificationId = existingId;
      inboxOk = true;
      const needsPushRetry =
        channels.push && (await pushDeliveryNeedsRetry(existingId));
      if (!needsPushRetry) {
        console.log(
          JSON.stringify({
            metric: 'notification_dispatch',
            status: 'skipped_duplicate',
            type: input.notificationType,
            recipientType: input.recipientType,
            dedupeKey,
            durationMs: Date.now() - started,
          })
        );
        return {
          inboxOk: true,
          notificationId: existingId,
          skippedDuplicate: true,
          pushSent: 0,
          pushFailed: 0,
          tokensDeactivated: 0,
        };
      }
      console.log(
        JSON.stringify({
          metric: 'notification_dispatch',
          status: 'duplicate_push_retry',
          type: input.notificationType,
          recipientType: input.recipientType,
          dedupeKey,
        })
      );
    }
  }

  const bookingId = String(dataRecord.bookingId || dataRecord.booking_id || '').trim() || undefined;
  const orderId = String(dataRecord.orderId || dataRecord.order_id || '').trim() || undefined;
  const deepLink = resolveNotificationDeepLink({
    eventType: input.notificationType,
    recipientType: input.recipientType,
    bookingId,
    orderId,
    deepLinkOverride: input.deepLinkOverride,
  });

  if (!notificationId && channels.inApp) {
    try {
      const row = await insert('notifications', {
        recipient_type: input.recipientType,
        recipient_id: input.recipientId,
        notification_type: input.notificationType,
        title: input.title,
        message: input.message,
        channels: { inApp: true, push: channels.push, sms: channels.sms, email: channels.email },
        is_read: false,
        delivery_status: 'created',
        data: dataRecord,
      });
      notificationId = row[0]?.id as string | undefined;
      inboxOk = Boolean(notificationId);

      if (notificationId) {
        const deliveryChannels = await resolveChannelsFromRequest({
          inApp: true,
          push: channels.push,
          sms: channels.sms,
          email: channels.email,
        });
        await ensureDeliveryLogEntries(notificationId, deliveryChannels, {
          title: input.title,
          body: input.message,
          type: input.notificationType,
          deep_link: deepLink,
        });
        await finalizeInAppDelivery(notificationId);
      }
    } catch (err) {
      console.error('[notification-dispatch] Inbox insert failed:', err);
      inboxOk = false;
    }
  } else if (notificationId && channels.push && skippedDuplicate) {
    await ensureDeliveryLogEntries(notificationId, ['push'], {
      title: input.title,
      body: input.message,
      type: input.notificationType,
      deep_link: deepLink,
    }).catch(() => undefined);
  }

  let pushSent = 0;
  let pushFailed = 0;
  let tokensDeactivated = 0;
  let pushSkippedReason: string | undefined;

  if (channels.push && notificationId) {
    const pushPref = await isUserPushEnabled(
      input.recipientId,
      input.recipientType,
      input.notificationType,
      input.forcePush
    );

    if (!pushPref.push) {
      pushSkippedReason = pushPref.reason;
      await markChannelDeliveryFailed(
        notificationId,
        'push',
        pushPref.reason || 'Push disabled by preferences'
      );
    } else {
      const fcmTokens = await loadActiveFcmTokens(input.recipientId, input.recipientType);
      const fcmData = stringifyFcmData({
        type: input.notificationType,
        deep_link: deepLink,
        notification_id: notificationId,
        booking_id: bookingId || '',
        order_id: orderId || '',
        eventType: input.notificationType,
        ...dataRecord,
      });

      const pushPayload: PushNotificationPayload = {
        title: input.title,
        body: input.message,
        imageUrl: input.imageUrl,
        data: fcmData,
      };

      const pushResult = await sendPushWithHygiene(fcmTokens, pushPayload, notificationId);
      pushSent = pushResult.pushSent;
      pushFailed = pushResult.pushFailed;
      tokensDeactivated = pushResult.tokensDeactivated;
    }
  }

  console.log(
    JSON.stringify({
      metric: 'notification_dispatch',
      status: inboxOk ? 'ok' : 'inbox_failed',
      type: input.notificationType,
      recipientType: input.recipientType,
      pushSent,
      pushFailed,
      tokensDeactivated,
      pushSkippedReason,
      durationMs: Date.now() - started,
    })
  );

  return {
    inboxOk,
    notificationId,
    skippedDuplicate,
    pushSent,
    pushFailed,
    tokensDeactivated,
    pushSkippedReason,
  };
}

/** Campaign delivery wrapper — preserves existing campaign processor API. */
export async function dispatchCampaignNotification(params: {
  recipientId: string;
  recipientType: 'customer' | 'vendor';
  campaignId: string;
  title: string;
  message: string;
  deepLink?: string | null;
  imageUrl?: string | null;
  pushEnabled: boolean;
}): Promise<{ inboxOk: boolean; pushSuccess: number; pushFailure: number; error?: string }> {
  const result = await dispatchNotification({
    recipientId: params.recipientId,
    recipientType: params.recipientType,
    notificationType: 'campaign',
    title: params.title,
    message: params.message,
    deepLinkOverride: params.deepLink || undefined,
    imageUrl: params.imageUrl || undefined,
    channels: { inApp: true, push: params.pushEnabled },
    data: {
      campaign_id: params.campaignId,
      dedupeKey: `campaign-${params.campaignId}-${params.recipientId}`,
    },
    forcePush: params.pushEnabled,
  });

  if (!result.inboxOk) {
    return { inboxOk: false, pushSuccess: 0, pushFailure: 0, error: 'Inbox insert failed' };
  }

  return {
    inboxOk: true,
    pushSuccess: result.pushSent,
    pushFailure: result.pushFailed,
    error: result.pushFailed > 0 && result.pushSent === 0 ? 'All push attempts failed' : undefined,
  };
}
