/**
 * Executes notification campaign delivery: inbox + push per recipient.
 */

import { insert, query, update } from '../database/rds-connection';
import {
  buildAudienceFiltersPayload,
  resolveCampaignRecipientIds,
  type AudienceFilters,
} from './notification-campaign-audience';
import { dispatchCampaignNotification } from './notification-dispatch';

const MAX_RECIPIENTS_PER_SEND = 5000;

export interface CampaignRow {
  id: string;
  title: string;
  message: string;
  channel: string;
  target_app: string;
  image_url?: string | null;
  deep_link?: string | null;
  targeting_type: string;
  audience_filters?: unknown;
}

export interface CampaignTargeting {
  region_ids: string[];
  city_names: string[];
  user_ids: string[];
  segment_ids: string[];
}

export interface CampaignDeliveryResult {
  status: 'SENT' | 'FAILED';
  estimatedRecipients: number;
  sentRecipients: number;
  failedRecipients: number;
  pushSuccessCount: number;
  pushFailureCount: number;
  errors: string[];
}

function buildFiltersFromCampaign(
  campaign: CampaignRow,
  targeting: CampaignTargeting
): AudienceFilters {
  const audience = buildAudienceFiltersPayload({
    audience_filters: campaign.audience_filters,
    ...((campaign.audience_filters as Record<string, unknown>) || {}),
  });
  return {
    targeting_type: String(campaign.targeting_type || 'BROADCAST'),
    target_app: (campaign.target_app as 'CUSTOMER' | 'VENDOR') || 'CUSTOMER',
    region_ids: targeting.region_ids,
    city_names: targeting.city_names,
    user_ids: targeting.user_ids,
    segment_ids: targeting.segment_ids,
    ...audience,
  };
}

async function isPushEnabledForApp(targetApp: string): Promise<boolean> {
  const result = await query(
    `SELECT push_enabled FROM notification_channel_settings WHERE app_type = $1`,
    [targetApp]
  ).catch(() => ({ rows: [{ push_enabled: true }] }));
  return result.rows?.[0]?.push_enabled !== false;
}

async function deliverToRecipient(
  campaign: CampaignRow,
  recipientId: string,
  recipientType: 'customer' | 'vendor',
  pushEnabled: boolean
): Promise<{ inboxOk: boolean; pushSuccess: number; pushFailure: number; error?: string }> {
  const wantsPush = pushEnabled && campaign.channel === 'PUSH';
  return dispatchCampaignNotification({
    recipientId,
    recipientType,
    campaignId: campaign.id,
    title: campaign.title,
    message: campaign.message,
    deepLink: campaign.deep_link,
    imageUrl: campaign.image_url,
    pushEnabled: wantsPush,
  });
}

export async function executeCampaignDelivery(
  campaign: CampaignRow,
  targeting: CampaignTargeting,
  performedBy: string | null
): Promise<CampaignDeliveryResult> {
  const errors: string[] = [];
  const filters = buildFiltersFromCampaign(campaign, targeting);
  const recipientIds = await resolveCampaignRecipientIds(filters, MAX_RECIPIENTS_PER_SEND);

  if (recipientIds.length === 0) {
    return {
      status: 'FAILED',
      estimatedRecipients: 0,
      sentRecipients: 0,
      failedRecipients: 0,
      pushSuccessCount: 0,
      pushFailureCount: 0,
      errors: ['No recipients match selected filters'],
    };
  }

  const recipientType = campaign.target_app === 'VENDOR' ? 'vendor' : 'customer';
  const pushEnabled = await isPushEnabledForApp(campaign.target_app);

  await update('notification_campaigns', { id: campaign.id }, {
    status: 'SENDING',
    estimated_recipients: recipientIds.length,
    updated_at: new Date().toISOString(),
  });
  await insert('notification_campaign_events', {
    campaign_id: campaign.id,
    event_type: 'SENDING',
    performed_by: performedBy,
    metadata: { recipientCount: recipientIds.length },
  }).catch(() => undefined);

  let sentRecipients = 0;
  let failedRecipients = 0;
  let pushSuccessCount = 0;
  let pushFailureCount = 0;

  for (const recipientId of recipientIds) {
    const deliveryRow = await insert('notification_campaign_deliveries', {
      campaign_id: campaign.id,
      recipient_id: recipientId,
      recipient_type: recipientType,
      status: 'PENDING',
    }).catch(() => null);

    const deliveryId = deliveryRow?.[0]?.id as string | undefined;
    const result = await deliverToRecipient(campaign, recipientId, recipientType, pushEnabled);

    pushSuccessCount += result.pushSuccess;
    pushFailureCount += result.pushFailure;

    if (result.inboxOk) {
      sentRecipients += 1;
      if (deliveryId) {
        await update('notification_campaign_deliveries', { id: deliveryId }, {
          status: 'SENT',
          processed_at: new Date().toISOString(),
        }).catch(() => undefined);
      }
    } else {
      failedRecipients += 1;
      if (result.error) errors.push(`${recipientId}: ${result.error}`);
      if (deliveryId) {
        await update('notification_campaign_deliveries', { id: deliveryId }, {
          status: 'FAILED',
          failure_reason: result.error || 'Delivery failed',
          processed_at: new Date().toISOString(),
        }).catch(() => undefined);
      }
    }
  }

  const finalStatus = sentRecipients > 0 ? 'SENT' : 'FAILED';
  await update('notification_campaigns', { id: campaign.id }, {
    status: finalStatus,
    sent_recipients: sentRecipients,
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await insert('notification_campaign_events', {
    campaign_id: campaign.id,
    event_type: finalStatus === 'SENT' ? 'SENT' : 'FAILED',
    performed_by: performedBy,
    metadata: {
      sentRecipients,
      failedRecipients,
      pushSuccessCount,
      pushFailureCount,
      errorSample: errors.slice(0, 5),
    },
  }).catch(() => undefined);

  return {
    status: finalStatus,
    estimatedRecipients: recipientIds.length,
    sentRecipients,
    failedRecipients,
    pushSuccessCount,
    pushFailureCount,
    errors: errors.slice(0, 10),
  };
}

