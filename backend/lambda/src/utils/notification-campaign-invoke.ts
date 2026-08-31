/**
 * Async invoke of the API Lambda for notification campaign delivery batches.
 * InvocationType Event only — no EventBridge / cron. Cost = sends that are actually started.
 * Self-chain is hop-capped so a stuck/retry loop cannot run away.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export const CAMPAIGN_DELIVERY_JOB = 'notification-campaign-delivery' as const;

/** Must stay in sync with notification-campaign-processor MAX_RECIPIENTS_PER_SEND. */
export const MAX_CAMPAIGN_RECIPIENTS = 5000;
export const CAMPAIGN_WORKER_BATCH_SIZE = 40;
/**
 * Hard cap on self-invokes for one campaign chain (includes the first kick).
 * One full pass of max audience + small retry slack — never unbounded.
 */
export const MAX_CAMPAIGN_CHAIN_HOPS =
  Math.ceil(MAX_CAMPAIGN_RECIPIENTS / CAMPAIGN_WORKER_BATCH_SIZE) + 10;

export type CampaignDeliveryJobEvent = {
  job: typeof CAMPAIGN_DELIVERY_JOB;
  campaignId: string;
  /** 1-based hop. First worker invoke is 1. */
  hop?: number;
};

export function normalizeCampaignHop(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function isCampaignChainHopAllowed(hop: number): boolean {
  return hop >= 1 && hop <= MAX_CAMPAIGN_CHAIN_HOPS;
}

export function isCampaignDeliveryJobEvent(event: unknown): event is CampaignDeliveryJobEvent {
  if (!event || typeof event !== 'object') return false;
  const e = event as Record<string, unknown>;
  return e.job === CAMPAIGN_DELIVERY_JOB && typeof e.campaignId === 'string' && e.campaignId.length > 0;
}

/**
 * Fire-and-forget worker invoke. Falls back to in-process chain when not running on Lambda
 * (local/offline) so enqueue still progresses without AWS invoke.
 * Refuses to invoke when hop exceeds MAX_CAMPAIGN_CHAIN_HOPS.
 */
export async function invokeCampaignDeliveryWorker(
  campaignId: string,
  hop = 1
): Promise<{ invoked: boolean; hop: number; capped: boolean }> {
  const nextHop = normalizeCampaignHop(hop);
  if (!isCampaignChainHopAllowed(nextHop)) {
    console.warn(
      JSON.stringify({
        metric: 'notification_campaign_invoke_capped',
        campaignId,
        hop: nextHop,
        maxHops: MAX_CAMPAIGN_CHAIN_HOPS,
      })
    );
    return { invoked: false, hop: nextHop, capped: true };
  }

  const payload: CampaignDeliveryJobEvent = {
    job: CAMPAIGN_DELIVERY_JOB,
    campaignId,
    hop: nextHop,
  };

  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME?.trim();
  if (!functionName) {
    const { processCampaignDeliveryJob } = await import('./notification-campaign-worker');
    void processCampaignDeliveryJob(payload).catch((err) => {
      console.error('[campaign-worker] local chain failed:', err?.message || err);
    });
    return { invoked: true, hop: nextHop, capped: false };
  }

  const client = new LambdaClient({});
  await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify(payload)),
    })
  );
  return { invoked: true, hop: nextHop, capped: false };
}
