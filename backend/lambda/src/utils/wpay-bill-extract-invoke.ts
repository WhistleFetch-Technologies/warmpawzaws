/**
 * Fire-and-forget bill extract. Same Lambda.invoke Event pattern as campaigns.
 * Payload is settlementId + imageKey only — never the image bytes (256KB Event limit).
 * No SQS / EventBridge. One invoke per Confirm; no hop chain.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export const WPAY_BILL_EXTRACT_JOB = 'wpay-bill-extract' as const;

export type WpayBillExtractJobEvent = {
  job: typeof WPAY_BILL_EXTRACT_JOB;
  settlementId: string;
  imageKey: string;
};

export function isWpayBillExtractJobEvent(event: unknown): event is WpayBillExtractJobEvent {
  if (!event || typeof event !== 'object') return false;
  const e = event as Record<string, unknown>;
  return (
    e.job === WPAY_BILL_EXTRACT_JOB &&
    typeof e.settlementId === 'string' &&
    e.settlementId.length > 0 &&
    typeof e.imageKey === 'string' &&
    e.imageKey.length > 0
  );
}

export async function invokeWpayBillExtractWorker(opts: {
  settlementId: string;
  imageKey: string;
}): Promise<void> {
  const payload: WpayBillExtractJobEvent = {
    job: WPAY_BILL_EXTRACT_JOB,
    settlementId: opts.settlementId,
    imageKey: opts.imageKey,
  };

  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME?.trim();
  if (!functionName) {
    const { processWpayBillExtractJob } = await import('./wpay-bill-extract-worker');
    void processWpayBillExtractJob(payload).catch((err) => {
      console.error('[wpay-bill-extract] local run failed:', err?.message || err);
    });
    return;
  }

  const client = new LambdaClient({});
  await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );
}
