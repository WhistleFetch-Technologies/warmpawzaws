/**
 * Fire-and-forget Drive image ingest. Same Lambda.invoke Event pattern as campaigns.
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

export const DRIVE_IMAGE_INGEST_JOB = 'drive-image-ingest' as const;
export const DRIVE_IMAGE_INGEST_BACKFILL_JOB = 'drive-image-ingest-backfill' as const;
export const DRIVE_INGEST_BATCH_SIZE = 3;
export const MAX_DRIVE_INGEST_HOPS = 16;

export type DriveImageIngestJobEvent = {
  job: typeof DRIVE_IMAGE_INGEST_JOB;
  vendorId: string;
  productIds: string[];
  folderId?: string | null;
  remainingFileIds: string[];
  completedKeys?: string[];
  failedFileIds?: string[];
  hop?: number;
};

export type DriveImageIngestBackfillEvent = {
  job: typeof DRIVE_IMAGE_INGEST_BACKFILL_JOB;
  vendorId?: string;
  limit?: number;
};

export function normalizeIngestHop(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function isDriveIngestHopAllowed(hop: number): boolean {
  return hop >= 1 && hop <= MAX_DRIVE_INGEST_HOPS;
}

export function isDriveImageIngestJobEvent(event: unknown): event is DriveImageIngestJobEvent {
  if (!event || typeof event !== 'object') return false;
  const e = event as Record<string, unknown>;
  return (
    e.job === DRIVE_IMAGE_INGEST_JOB &&
    typeof e.vendorId === 'string' &&
    e.vendorId.length > 0 &&
    Array.isArray(e.productIds) &&
    Array.isArray(e.remainingFileIds)
  );
}

export function isDriveImageIngestBackfillEvent(event: unknown): event is DriveImageIngestBackfillEvent {
  if (!event || typeof event !== 'object') return false;
  const e = event as Record<string, unknown>;
  return e.job === DRIVE_IMAGE_INGEST_BACKFILL_JOB;
}

export function nextDriveIngestBatch(remainingFileIds: string[]): {
  batch: string[];
  rest: string[];
} {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of remainingFileIds) {
    const trimmed = String(id ?? '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }
  return {
    batch: unique.slice(0, DRIVE_INGEST_BATCH_SIZE),
    rest: unique.slice(DRIVE_INGEST_BATCH_SIZE),
  };
}

async function invokeEvent(payload: object): Promise<void> {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME?.trim();
  if (!functionName) {
    if ((payload as { job?: string }).job === DRIVE_IMAGE_INGEST_BACKFILL_JOB) {
      const { processDriveImageIngestBackfillJob } = await import('./drive-image-ingest-worker');
      void processDriveImageIngestBackfillJob(payload as DriveImageIngestBackfillEvent).catch((err) => {
        console.error('[drive-image-ingest] local backfill failed:', err?.message || err);
      });
      return;
    }
    const { processDriveImageIngestJob } = await import('./drive-image-ingest-worker');
    void processDriveImageIngestJob(payload as DriveImageIngestJobEvent).catch((err) => {
      console.error('[drive-image-ingest] local chain failed:', err?.message || err);
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

export async function invokeDriveImageIngestWorker(
  event: Omit<DriveImageIngestJobEvent, 'job'> & { hop?: number },
): Promise<{ invoked: boolean; hop: number; capped: boolean }> {
  const hop = normalizeIngestHop(event.hop ?? 1);
  if (!isDriveIngestHopAllowed(hop)) {
    console.warn(
      JSON.stringify({
        metric: 'drive_image_ingest_invoke_capped',
        vendorId: event.vendorId,
        hop,
        maxHops: MAX_DRIVE_INGEST_HOPS,
      }),
    );
    return { invoked: false, hop, capped: true };
  }

  const payload: DriveImageIngestJobEvent = {
    job: DRIVE_IMAGE_INGEST_JOB,
    vendorId: event.vendorId,
    productIds: event.productIds,
    folderId: event.folderId ?? null,
    remainingFileIds: event.remainingFileIds,
    completedKeys: event.completedKeys ?? [],
    failedFileIds: event.failedFileIds ?? [],
    hop,
  };
  await invokeEvent(payload);
  return { invoked: true, hop, capped: false };
}

export async function invokeDriveImageIngestBackfill(opts?: {
  vendorId?: string;
  limit?: number;
}): Promise<void> {
  await invokeEvent({
    job: DRIVE_IMAGE_INGEST_BACKFILL_JOB,
    vendorId: opts?.vendorId,
    limit: opts?.limit ?? 200,
  } satisfies DriveImageIngestBackfillEvent);
}
