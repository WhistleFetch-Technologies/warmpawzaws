/**
 * Self-chaining campaign delivery worker.
 * Processes PENDING rows in small batches; re-invokes once if more remain.
 * Does not touch FCM/APNs clients — uses existing dispatchCampaignNotification only.
 */

import { insert, query, update } from '../database/rds-connection';
import { dispatchCampaignNotification } from './notification-dispatch';
import {
  CAMPAIGN_WORKER_BATCH_SIZE,
  MAX_CAMPAIGN_CHAIN_HOPS,
  invokeCampaignDeliveryWorker,
  isCampaignChainHopAllowed,
  normalizeCampaignHop,
  type CampaignDeliveryJobEvent,
} from './notification-campaign-invoke';
import { isNotificationPipelineEnabled } from './notification-pipeline-kill-switch';
import type { CampaignRow } from './notification-campaign-processor';

/** Recipients per worker invoke — keeps one invoke well under API/Lambda timeout. */
const BATCH_SIZE = CAMPAIGN_WORKER_BATCH_SIZE;
/** Initial try + 1 retry for transient failures (promotional). */
const MAX_ATTEMPTS = 2;

async function isPushEnabledForApp(targetApp: string): Promise<boolean> {
  const result = await query(
    `SELECT push_enabled FROM notification_channel_settings WHERE app_type = $1`,
    [targetApp]
  ).catch(() => ({ rows: [{ push_enabled: true }] }));
  return result.rows?.[0]?.push_enabled !== false;
}

async function claimPendingBatch(campaignId: string): Promise<
  Array<{
    id: string;
    recipient_id: string;
    recipient_type: string;
    attempt: number;
  }>
> {
  const result = await query(
    `WITH cte AS (
       SELECT id
       FROM notification_campaign_deliveries
       WHERE campaign_id = $1::uuid
         AND status = 'PENDING'
         AND attempt < $2
       ORDER BY created_at ASC, id ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $3
     )
     UPDATE notification_campaign_deliveries d
     SET attempt = d.attempt + 1,
         failure_reason = 'in_flight'
     FROM cte
     WHERE d.id = cte.id
     RETURNING d.id, d.recipient_id::text AS recipient_id, d.recipient_type, d.attempt`,
    [campaignId, MAX_ATTEMPTS, BATCH_SIZE]
  );
  return (result.rows || []) as Array<{
    id: string;
    recipient_id: string;
    recipient_type: string;
    attempt: number;
  }>;
}

async function finalizeCampaignIfDone(campaignId: string): Promise<boolean> {
  const pending = await query(
    `SELECT COUNT(*)::int AS c
     FROM notification_campaign_deliveries
     WHERE campaign_id = $1::uuid
       AND status = 'PENDING'
       AND attempt < $2`,
    [campaignId, MAX_ATTEMPTS]
  );
  if ((pending.rows?.[0]?.c ?? 0) > 0) return false;

  // Mark any leftover PENDING with exhausted attempts as FAILED
  await query(
    `UPDATE notification_campaign_deliveries
     SET status = 'FAILED',
         failure_reason = COALESCE(NULLIF(failure_reason, 'in_flight'), 'max_attempts'),
         processed_at = NOW()
     WHERE campaign_id = $1::uuid
       AND status = 'PENDING'
       AND attempt >= $2`,
    [campaignId, MAX_ATTEMPTS]
  ).catch(() => undefined);

  const counts = await query(
    `SELECT status::text AS status, COUNT(*)::int AS c
     FROM notification_campaign_deliveries
     WHERE campaign_id = $1::uuid
     GROUP BY status`,
    [campaignId]
  );
  let sent = 0;
  let failed = 0;
  for (const row of counts.rows || []) {
    if (row.status === 'SENT' || row.status === 'DELIVERED') sent += Number(row.c) || 0;
    if (row.status === 'FAILED') failed += Number(row.c) || 0;
  }

  const finalStatus = sent > 0 ? 'SENT' : 'FAILED';
  await update('notification_campaigns', { id: campaignId }, {
    status: finalStatus,
    sent_recipients: sent,
    sent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await insert('notification_campaign_events', {
    campaign_id: campaignId,
    event_type: finalStatus === 'SENT' ? 'SENT' : 'FAILED',
    performed_by: null,
    metadata: { sentRecipients: sent, failedRecipients: failed, asyncWorker: true },
  }).catch(() => undefined);

  console.log(
    JSON.stringify({
      metric: 'notification_campaign_worker_finalize',
      campaignId,
      status: finalStatus,
      sent,
      failed,
    })
  );
  return true;
}

async function abortChainAtHopCap(campaignId: string, hop: number): Promise<void> {
  await query(
    `UPDATE notification_campaign_deliveries
     SET status = 'FAILED',
         failure_reason = 'chain_hop_cap',
         processed_at = NOW()
     WHERE campaign_id = $1::uuid
       AND status = 'PENDING'`,
    [campaignId]
  ).catch(() => undefined);

  console.warn(
    JSON.stringify({
      metric: 'notification_campaign_worker',
      status: 'chain_hop_cap',
      campaignId,
      hop,
      maxHops: MAX_CAMPAIGN_CHAIN_HOPS,
    })
  );
  await finalizeCampaignIfDone(campaignId);
}

export async function processCampaignDeliveryJob(event: CampaignDeliveryJobEvent): Promise<void> {
  const campaignId = event.campaignId;
  const hop = normalizeCampaignHop(event.hop);
  if (!isCampaignChainHopAllowed(hop)) {
    await abortChainAtHopCap(campaignId, hop);
    return;
  }

  if (!isNotificationPipelineEnabled()) {
    console.log(JSON.stringify({ metric: 'notification_campaign_worker', status: 'pipeline_disabled', campaignId, hop }));
    return;
  }

  const campaignResult = await query('SELECT * FROM notification_campaigns WHERE id = $1::uuid', [campaignId]);
  const campaign = campaignResult.rows?.[0] as (CampaignRow & { status?: string }) | undefined;
  if (!campaign) {
    console.warn('[campaign-worker] campaign not found', campaignId);
    return;
  }

  const status = String(campaign.status || '');
  if (status === 'CANCELLED') {
    console.log(JSON.stringify({ metric: 'notification_campaign_worker', status: 'cancelled', campaignId }));
    return;
  }

  if (status === 'SENT' || status === 'FAILED') {
    return;
  }

  if (status === 'QUEUED') {
    await update('notification_campaigns', { id: campaignId }, {
      status: 'SENDING',
      updated_at: new Date().toISOString(),
    }).catch(() => undefined);
  }

  const pushEnabled = await isPushEnabledForApp(campaign.target_app);
  const batch = await claimPendingBatch(campaignId);

  if (batch.length === 0) {
    await finalizeCampaignIfDone(campaignId);
    return;
  }

  let pushSuccess = 0;
  let pushFailure = 0;

  for (const row of batch) {
    const recipientType = (row.recipient_type === 'vendor' ? 'vendor' : 'customer') as 'customer' | 'vendor';
    const wantsPush = pushEnabled && campaign.channel === 'PUSH';

    try {
      const result = await dispatchCampaignNotification({
        recipientId: row.recipient_id,
        recipientType,
        campaignId,
        title: campaign.title,
        message: campaign.message,
        deepLink: campaign.deep_link,
        imageUrl: campaign.image_url,
        pushEnabled: wantsPush,
      });

      pushSuccess += result.pushSuccess;
      pushFailure += result.pushFailure;

      if (result.inboxOk) {
        await update('notification_campaign_deliveries', { id: row.id }, {
          status: 'SENT',
          failure_reason: null,
          processed_at: new Date().toISOString(),
        }).catch(() => undefined);
      } else {
        const reason = result.error || 'Delivery failed';
        const permanent = /no.?fresh|no active|Inbox insert failed/i.test(reason) || row.attempt >= MAX_ATTEMPTS;
        if (permanent) {
          await update('notification_campaign_deliveries', { id: row.id }, {
            status: 'FAILED',
            failure_reason: reason,
            processed_at: new Date().toISOString(),
          }).catch(() => undefined);
        } else {
          await update('notification_campaign_deliveries', { id: row.id }, {
            status: 'PENDING',
            failure_reason: reason,
          }).catch(() => undefined);
        }
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (row.attempt >= MAX_ATTEMPTS) {
        await update('notification_campaign_deliveries', { id: row.id }, {
          status: 'FAILED',
          failure_reason: reason.slice(0, 500),
          processed_at: new Date().toISOString(),
        }).catch(() => undefined);
      } else {
        await update('notification_campaign_deliveries', { id: row.id }, {
          status: 'PENDING',
          failure_reason: reason.slice(0, 500),
        }).catch(() => undefined);
      }
    }
  }

  console.log(
    JSON.stringify({
      metric: 'notification_campaign_worker_batch',
      campaignId,
      hop,
      batchSize: batch.length,
      pushSuccess,
      pushFailure,
    })
  );

  const done = await finalizeCampaignIfDone(campaignId);
  if (done) return;

  if (hop >= MAX_CAMPAIGN_CHAIN_HOPS) {
    await abortChainAtHopCap(campaignId, hop);
    return;
  }

  // One continuation invoke only — no fan-out, no cron. Hop is strictly increasing.
  await invokeCampaignDeliveryWorker(campaignId, hop + 1);
}
