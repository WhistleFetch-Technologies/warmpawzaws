/**
 * Async invoke of the API Lambda for notification campaign delivery batches.
 * InvocationType Event only — no EventBridge / cron. Cost = sends that are actually started.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export const CAMPAIGN_DELIVERY_JOB = 'notification-campaign-delivery' as const;

export type CampaignDeliveryJobEvent = {
  job: typeof CAMPAIGN_DELIVERY_JOB;
  campaignId: string;
};

export function isCampaignDeliveryJobEvent(event: unknown): event is CampaignDeliveryJobEvent {
  if (!event || typeof event !== 'object') return false;
  const e = event as Record<string, unknown>;
  return e.job === CAMPAIGN_DELIVERY_JOB && typeof e.campaignId === 'string' && e.campaignId.length > 0;
}

/**
 * Fire-and-forget worker invoke. Falls back to in-process chain when not running on Lambda
 * (local/offline) so enqueue still progresses without AWS invoke.
 */
export async function invokeCampaignDeliveryWorker(campaignId: string): Promise<void> {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME?.trim();
  const payload: CampaignDeliveryJobEvent = {
    job: CAMPAIGN_DELIVERY_JOB,
    campaignId,
  };

  if (!functionName) {
    const { processCampaignDeliveryJob } = await import('./notification-campaign-worker');
    void processCampaignDeliveryJob(payload).catch((err) => {
      console.error('[campaign-worker] local chain failed:', err?.message || err);
    });
    return;
  }

  const client = new LambdaClient({});
  await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify(payload)),
    })
  );
}
