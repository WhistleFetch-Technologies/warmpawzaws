/**
 * Notification campaign delivery: enqueue PENDING rows + async worker kick.
 * Per-recipient FCM/inbox stays in notification-dispatch (unchanged engine).
 */

import { insert, query, update } from '../database/rds-connection';
import {
  buildAudienceFiltersPayload,
  resolveCampaignRecipientIds,
  type AudienceFilters,
} from './notification-campaign-audience';
import { invokeCampaignDeliveryWorker } from './notification-campaign-invoke';
import {
  campaignPipelineDisabledResult,
  isNotificationPipelineEnabled,
} from './notification-pipeline-kill-switch';

const MAX_RECIPIENTS_PER_SEND = 5000;
const INSERT_CHUNK = 500;

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
  status?: string;
}

export interface CampaignTargeting {
  region_ids: string[];
  city_names: string[];
  user_ids: string[];
  segment_ids: string[];
}

export interface CampaignDeliveryResult {
  status: 'QUEUED' | 'SENT' | 'FAILED';
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
    // Promotional blast: only recipients with a fresh active FCM token
    has_push_token: true,
  };
}

async function insertPendingDeliveries(
  campaignId: string,
  recipientType: 'customer' | 'vendor',
  recipientIds: string[]
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < recipientIds.length; i += INSERT_CHUNK) {
    const chunk = recipientIds.slice(i, i + INSERT_CHUNK);
    const result = await query(
      `INSERT INTO notification_campaign_deliveries
         (campaign_id, recipient_id, recipient_type, status, attempt)
       SELECT $1::uuid, x, $2, 'PENDING', 0
       FROM unnest($3::uuid[]) AS x`,
      [campaignId, recipientType, chunk]
    );
    inserted += result.rowCount ?? chunk.length;
  }
  return inserted;
}

/**
 * Resolve audience, insert PENDING deliveries, mark QUEUED, kick self-chaining worker.
 * Returns immediately after enqueue — does not wait for FCM fan-out.
 */
export async function executeCampaignDelivery(
  campaign: CampaignRow,
  targeting: CampaignTargeting,
  performedBy: string | null
): Promise<CampaignDeliveryResult> {
  if (!isNotificationPipelineEnabled()) {
    console.log(
      JSON.stringify({
        metric: 'notification_campaign_delivery',
        status: 'pipeline_disabled',
        campaignId: campaign.id,
      })
    );
    return campaignPipelineDisabledResult() as CampaignDeliveryResult;
  }

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
      errors: ['No recipients with fresh active FCM tokens match selected filters'],
    };
  }

  const recipientType = campaign.target_app === 'VENDOR' ? 'vendor' : 'customer';

  await update('notification_campaigns', { id: campaign.id }, {
    status: 'QUEUED',
    estimated_recipients: recipientIds.length,
    updated_at: new Date().toISOString(),
  });
  await insert('notification_campaign_events', {
    campaign_id: campaign.id,
    event_type: 'QUEUED',
    performed_by: performedBy,
    metadata: { recipientCount: recipientIds.length, asyncEnqueue: true },
  }).catch(() => undefined);

  await insertPendingDeliveries(campaign.id, recipientType, recipientIds);

  await update('notification_campaigns', { id: campaign.id }, {
    status: 'SENDING',
    updated_at: new Date().toISOString(),
  });
  await insert('notification_campaign_events', {
    campaign_id: campaign.id,
    event_type: 'SENDING',
    performed_by: performedBy,
    metadata: { recipientCount: recipientIds.length, asyncWorker: true },
  }).catch(() => undefined);

  try {
    await invokeCampaignDeliveryWorker(campaign.id, 1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[campaign-enqueue] worker invoke failed:', msg);
    return {
      status: 'QUEUED',
      estimatedRecipients: recipientIds.length,
      sentRecipients: 0,
      failedRecipients: 0,
      pushSuccessCount: 0,
      pushFailureCount: 0,
      errors: [`Worker invoke failed (deliveries queued): ${msg}`],
    };
  }

  console.log(
    JSON.stringify({
      metric: 'notification_campaign_enqueue',
      campaignId: campaign.id,
      recipientCount: recipientIds.length,
    })
  );

  return {
    status: 'QUEUED',
    estimatedRecipients: recipientIds.length,
    sentRecipients: 0,
    failedRecipients: 0,
    pushSuccessCount: 0,
    pushFailureCount: 0,
    errors: [],
  };
}
