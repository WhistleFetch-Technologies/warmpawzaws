/**
 * Async hop worker: download Drive files → S3 → write parent + SKU images.
 */

import { uploadDisplayImage } from '../services/image';
import { downloadDriveFileImage } from './drive-file-download';
import {
  collectBackfillFileIds,
  keepDisplayableProductImages,
  keptManagedS3Images,
  lh3DisplayUrlsForFileIds,
} from './bulk-drive-image-plan';
import { parseProductMetadata } from './product-group-identity';
import {
  applyImageApprovalHold,
  MAX_IMAGE_INGEST_ATTEMPTS,
  nextImageIngestRetryAt,
  readImageIngestAttempt,
  shouldRetryImageIngest,
} from './product-image-approval-gate';
import {
  cleanupRemovedProductS3Images,
  deleteAllManagedProductImages,
} from './product-s3-image';
import { resolveUploadBucketForKey } from '../endpoints/constants/helper';
import {
  DRIVE_IMAGE_INGEST_JOB,
  invokeDriveImageIngestBackfill,
  invokeDriveImageIngestWorker,
  isDriveIngestHopAllowed,
  nextDriveIngestBatch,
  normalizeIngestHop,
  type DriveImageIngestBackfillEvent,
  type DriveImageIngestJobEvent,
} from './drive-image-ingest-invoke';

export type DriveIngestProductRow = {
  id: string;
  vendor_id: string;
  images?: unknown;
  metadata?: unknown;
};

export type DriveIngestDeps = {
  downloadFile?: typeof downloadDriveFileImage;
  uploadKey?: (vendorId: string, buffer: Buffer, mime: string) => Promise<string>;
  loadProducts?: (vendorId: string, productIds: string[]) => Promise<DriveIngestProductRow[]>;
  writeImages?: (args: {
    vendorId: string;
    productIds: string[];
    images: string[];
    metadataByProduct: Record<string, Record<string, unknown>>;
  }) => Promise<void>;
  invokeNext?: typeof invokeDriveImageIngestWorker;
  deleteManaged?: typeof deleteAllManagedProductImages;
  cleanupRemoved?: typeof cleanupRemovedProductS3Images;
  verifyKey?: (key: string) => Promise<boolean>;
};

async function defaultUploadKey(vendorId: string, buffer: Buffer, mime: string): Promise<string> {
  const asset = await uploadDisplayImage({
    buffer,
    declaredContentType: mime,
    assetType: 'product',
    ownerId: vendorId,
    vendorId,
  });
  return asset.imageKey;
}

async function defaultLoadProducts(
  vendorId: string,
  productIds: string[],
): Promise<DriveIngestProductRow[]> {
  if (productIds.length === 0) return [];
  const { query } = await import('../database/rds-connection');
  const r = await query(
    `SELECT id, vendor_id, images, metadata
     FROM products
     WHERE vendor_id = $1 AND id = ANY($2::uuid[])`,
    [vendorId, productIds],
  );
  return r.rows as DriveIngestProductRow[];
}

async function defaultWriteImages(args: {
  vendorId: string;
  productIds: string[];
  images: string[];
  metadataByProduct: Record<string, Record<string, unknown>>;
}): Promise<void> {
  const { query } = await import('../database/rds-connection');
  const imagesJson = JSON.stringify(args.images);
  for (const productId of args.productIds) {
    const meta = args.metadataByProduct[productId] ?? {};
    await query(
      `UPDATE products
       SET images = $1::jsonb, metadata = $2::jsonb, updated_at = NOW()
       WHERE id = $3 AND vendor_id = $4`,
      [imagesJson, JSON.stringify(meta), productId, args.vendorId],
    );
  }
  await query(
    `UPDATE product_skus
     SET images = $1::jsonb, updated_at = NOW()
     WHERE vendor_id = $2 AND product_id = ANY($3::uuid[])`,
    [imagesJson, args.vendorId, args.productIds],
  );
}

function ingestStatus(
  remaining: string[],
  completedKeys: string[],
): 'processing' | 'ready' | 'failed' {
  if (remaining.length > 0) return 'processing';
  if (completedKeys.length === 0) return 'failed';
  return 'ready';
}

function uniqueIds(ids: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function defaultVerifyKey(key: string): Promise<boolean> {
  if (!String(key ?? '').trim()) return false;
  return Boolean(await resolveUploadBucketForKey(key));
}

export async function runDriveIngestHop(
  event: DriveImageIngestJobEvent,
  deps: DriveIngestDeps = {},
): Promise<{ status: string; nextHop: boolean }> {
  const hop = normalizeIngestHop(event.hop ?? 1);
  const vendorId = event.vendorId;
  const productIds = [...new Set(event.productIds.map((id) => String(id).trim()).filter(Boolean))];
  const downloadFile = deps.downloadFile ?? downloadDriveFileImage;
  const uploadKey = deps.uploadKey ?? defaultUploadKey;
  const loadProducts = deps.loadProducts ?? defaultLoadProducts;
  const writeImages = deps.writeImages ?? defaultWriteImages;
  const invokeNext = deps.invokeNext ?? invokeDriveImageIngestWorker;
  const deleteManaged = deps.deleteManaged ?? deleteAllManagedProductImages;
  const cleanupRemoved = deps.cleanupRemoved ?? cleanupRemovedProductS3Images;
  const verifyKey = deps.verifyKey ?? defaultVerifyKey;

  const products = await loadProducts(vendorId, productIds);
  if (products.length === 0) {
    const orphanKeys = [...(event.completedKeys ?? [])];
    if (orphanKeys.length > 0) {
      await deleteManaged(orphanKeys, vendorId);
    }
    return { status: 'deleted', nextHop: false };
  }

  const { batch, rest } = nextDriveIngestBatch(event.remainingFileIds);
  const completedKeys = [...(event.completedKeys ?? [])];
  const failedFileIds = [...(event.failedFileIds ?? [])];
  const hopCreated: string[] = [];

  for (const fileId of batch) {
    const downloaded = await downloadFile(fileId);
    if (!downloaded.ok) {
      failedFileIds.push(fileId);
      continue;
    }
    try {
      const key = await uploadKey(vendorId, downloaded.buffer, downloaded.mime);
      if (key && (await verifyKey(key))) {
        completedKeys.push(key);
        hopCreated.push(key);
      } else {
        failedFileIds.push(fileId);
      }
    } catch {
      failedFileIds.push(fileId);
    }
  }

  const liveIds = products.map((p) => String(p.id));
  if (liveIds.length === 0) {
    if (hopCreated.length > 0) await deleteManaged(hopCreated, vendorId);
    return { status: 'deleted', nextHop: false };
  }

  const canContinue = isDriveIngestHopAllowed(hop + 1);
  const retryFailed =
    rest.length === 0 && failedFileIds.length > 0 && canContinue;
  const nextRemaining = rest.length > 0 ? rest : retryFailed ? uniqueIds(failedFileIds) : [];
  const status = ingestStatus(nextRemaining, completedKeys);
  const fileIds = uniqueIds([
    ...(event.fileIds ?? []),
    ...(event.remainingFileIds ?? []),
    ...failedFileIds,
  ]);
  const prevAttempt = Math.max(
    Number(event.attempt ?? 0) || 0,
    ...products.map((p) => readImageIngestAttempt(p.metadata)),
  );
  const attempt = status === 'failed' ? Math.max(1, prevAttempt + 1) : prevAttempt;
  const metadataByProduct: Record<string, Record<string, unknown>> = {};
  const prevS3All: string[] = [];
  const fallbackDisplay: string[] = [];

  for (const p of products) {
    prevS3All.push(...keptManagedS3Images(p.images, vendorId));
    fallbackDisplay.push(...keepDisplayableProductImages(p.images, vendorId));
    const meta = parseProductMetadata(p.metadata);
    const imageIngest: Record<string, unknown> = {
      status,
      source: 'drive_folder',
      folderId: event.folderId ?? null,
      fileIds,
      pendingFileIds: nextRemaining,
      failedFileIds,
      attempt,
    };
    if (status === 'failed') {
      imageIngest.next_retry_at = nextImageIngestRetryAt(Number(imageIngest.attempt) || 1);
    }
    metadataByProduct[String(p.id)] = applyImageApprovalHold(
      {
        ...meta,
        image_ingest: imageIngest,
      },
      completedKeys.length > 0 ? completedKeys : keepDisplayableProductImages(p.images, vendorId),
      vendorId,
    );
  }

  const persistImages =
    completedKeys.length > 0
      ? completedKeys
      : [
          ...new Set(
            fallbackDisplay.length > 0
              ? fallbackDisplay
              : lh3DisplayUrlsForFileIds([
                  ...(event.remainingFileIds ?? []),
                  ...(event.failedFileIds ?? []),
                ]),
          ),
        ];

  try {
    await writeImages({
      vendorId,
      productIds: liveIds,
      images: persistImages,
      metadataByProduct,
    });
  } catch (err) {
    if (hopCreated.length > 0) await deleteManaged(hopCreated, vendorId);
    throw err;
  }

  if (status !== 'processing' && completedKeys.length > 0) {
    const uniquePrev = [...new Set(prevS3All)];
    await cleanupRemoved(uniquePrev, completedKeys, vendorId);
  }

  if (nextRemaining.length > 0 && canContinue) {
    await invokeNext({
      vendorId,
      productIds: liveIds,
      folderId: event.folderId,
      remainingFileIds: nextRemaining,
      completedKeys,
      failedFileIds: rest.length > 0 ? failedFileIds : [],
      fileIds,
      attempt: prevAttempt,
      hop: hop + 1,
    });
    return { status: 'processing', nextHop: true };
  }

  return { status, nextHop: false };
}

export async function processDriveImageIngestJob(event: DriveImageIngestJobEvent): Promise<void> {
  console.log(
    JSON.stringify({
      metric: 'drive_image_ingest_hop_start',
      vendorId: event.vendorId,
      productIds: event.productIds,
      remaining: event.remainingFileIds?.length ?? 0,
      hop: event.hop ?? 1,
    }),
  );
  const result = await runDriveIngestHop(event);
  console.log(
    JSON.stringify({
      metric: 'drive_image_ingest_hop_done',
      vendorId: event.vendorId,
      status: result.status,
      nextHop: result.nextHop,
    }),
  );
}

export async function loadDriveBackfillTargets(
  vendorId?: string,
  limit = 200,
): Promise<Array<{ vendorId: string; productId: string; fileIds: string[] }>> {
  const cap = Math.max(1, Math.min(500, Math.floor(limit)));
  const { query } = await import('../database/rds-connection');
  const productRows = await query(
    `SELECT id, vendor_id, images, metadata
     FROM products
     WHERE ($1::uuid IS NULL OR vendor_id = $1)
       AND (
         images::text ILIKE '%drive.google.com%'
         OR images::text ILIKE '%lh3.googleusercontent.com/d/%'
         OR COALESCE(metadata->'image_ingest'->>'status', '') IN ('processing', 'failed')
         OR (
           metadata->'image_ingest' IS NOT NULL
           AND (
             images IS NULL
             OR images = '[]'::jsonb
             OR (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) = 0)
           )
         )
       )
     LIMIT $2`,
    [vendorId ?? null, cap],
  );
  const skuRows = await query(
    `SELECT DISTINCT product_id, vendor_id, images
     FROM product_skus
     WHERE images::text ILIKE '%drive.google.com%'
       AND ($1::uuid IS NULL OR vendor_id = $1)
     LIMIT $2`,
    [vendorId ?? null, cap],
  );

  const byProduct = new Map<string, { vendorId: string; productId: string; fileIds: Set<string> }>();
  const add = (productId: string, vid: string, images: unknown, metadata?: unknown) => {
    let entry = byProduct.get(productId);
    if (!entry) {
      entry = { vendorId: vid, productId, fileIds: new Set() };
      byProduct.set(productId, entry);
    }
    for (const id of collectBackfillFileIds(images, metadata)) entry.fileIds.add(id);
  };

  for (const row of productRows.rows) {
    add(String(row.id), String(row.vendor_id), row.images, row.metadata);
  }
  for (const row of skuRows.rows) {
    add(String(row.product_id), String(row.vendor_id), row.images);
  }

  return [...byProduct.values()]
    .filter((e) => e.fileIds.size > 0)
    .slice(0, cap)
    .map((e) => ({ vendorId: e.vendorId, productId: e.productId, fileIds: [...e.fileIds] }));
}

export function groupBackfillJobs(
  targets: Array<{ vendorId: string; productId: string; fileIds: string[] }>,
): DriveImageIngestJobEvent[] {
  const byKey = new Map<string, DriveImageIngestJobEvent>();
  for (const t of targets) {
    const key = `${t.vendorId}::${t.fileIds.slice().sort().join(',')}`;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.productIds.includes(t.productId)) existing.productIds.push(t.productId);
      continue;
    }
    byKey.set(key, {
      job: DRIVE_IMAGE_INGEST_JOB,
      vendorId: t.vendorId,
      productIds: [t.productId],
      remainingFileIds: t.fileIds,
      completedKeys: [],
      failedFileIds: [],
      hop: 1,
    });
  }
  return [...byKey.values()];
}

export async function processDriveImageIngestBackfillJob(
  event: DriveImageIngestBackfillEvent,
): Promise<{ enqueued: number }> {
  const targets = await loadDriveBackfillTargets(event.vendorId, event.limit ?? 200);
  const jobs = groupBackfillJobs(targets);
  for (const job of jobs) {
    await invokeDriveImageIngestWorker({
      vendorId: job.vendorId,
      productIds: job.productIds,
      remainingFileIds: job.remainingFileIds,
      completedKeys: [],
      failedFileIds: [],
      hop: 1,
    });
  }
  return { enqueued: jobs.length };
}

/** Fire-and-forget retry for a vendor whose catalog still has image holds. */
export async function maybeEnqueueDueImageIngestRetries(vendorId: string): Promise<void> {
  const vid = String(vendorId ?? '').trim();
  if (!vid) return;
  const { query } = await import('../database/rds-connection');
  const r = await query(
    `SELECT metadata
     FROM products
     WHERE vendor_id = $1
       AND (
         COALESCE(metadata->>'approval_hold', '') = 'images'
         OR COALESCE(metadata->'image_ingest'->>'status', '') IN ('processing', 'failed')
       )
     LIMIT ${MAX_IMAGE_INGEST_ATTEMPTS * 4}`,
    [vid],
  );
  const due = (r.rows || []).some((row) => shouldRetryImageIngest(row.metadata));
  if (!due) return;
  await invokeDriveImageIngestBackfill({ vendorId: vid, limit: 50 });
}
