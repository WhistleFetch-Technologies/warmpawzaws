/**
 * Async hop worker: download Drive files → S3 → write parent + SKU images.
 */

import { uploadDisplayImage } from '../services/image';
import { downloadDriveFileImage } from './drive-file-download';
import {
  extractDriveFileIdsFromImageList,
  keptManagedS3Images,
} from './bulk-drive-image-plan';
import { parseProductMetadata } from './product-group-identity';
import {
  cleanupRemovedProductS3Images,
  deleteAllManagedProductImages,
} from './product-s3-image';
import {
  DRIVE_IMAGE_INGEST_JOB,
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
  failedFileIds: string[],
): 'processing' | 'ready' | 'failed' {
  if (remaining.length > 0) return 'processing';
  if (completedKeys.length === 0) return 'failed';
  if (failedFileIds.length > 0 && completedKeys.length > 0) return 'ready';
  return completedKeys.length > 0 ? 'ready' : 'failed';
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
      if (key) {
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

  const status = ingestStatus(rest, completedKeys, failedFileIds);
  const metadataByProduct: Record<string, Record<string, unknown>> = {};
  const prevS3All: string[] = [];

  for (const p of products) {
    prevS3All.push(...keptManagedS3Images(p.images, vendorId));
    const meta = parseProductMetadata(p.metadata);
    metadataByProduct[String(p.id)] = {
      ...meta,
      image_ingest: {
        status,
        source: 'drive_folder',
        folderId: event.folderId ?? null,
        pendingFileIds: rest,
        failedFileIds,
      },
    };
  }

  const persistImages = completedKeys.length > 0 ? completedKeys : prevS3All.filter((u, i, a) => a.indexOf(u) === i);

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

  if (rest.length > 0 && isDriveIngestHopAllowed(hop + 1)) {
    await invokeNext({
      vendorId,
      productIds: liveIds,
      folderId: event.folderId,
      remainingFileIds: rest,
      completedKeys,
      failedFileIds,
      hop: hop + 1,
    });
    return { status: 'processing', nextHop: true };
  }

  return { status, nextHop: false };
}

export async function processDriveImageIngestJob(event: DriveImageIngestJobEvent): Promise<void> {
  await runDriveIngestHop(event);
}

export async function loadDriveBackfillTargets(
  vendorId?: string,
  limit = 200,
): Promise<Array<{ vendorId: string; productId: string; fileIds: string[] }>> {
  const cap = Math.max(1, Math.min(500, Math.floor(limit)));
  const { query } = await import('../database/rds-connection');
  const productRows = await query(
    `SELECT id, vendor_id, images
     FROM products
     WHERE images::text ILIKE '%drive.google.com%'
       AND ($1::uuid IS NULL OR vendor_id = $1)
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
  const add = (productId: string, vid: string, images: unknown) => {
    let entry = byProduct.get(productId);
    if (!entry) {
      entry = { vendorId: vid, productId, fileIds: new Set() };
      byProduct.set(productId, entry);
    }
    for (const id of extractDriveFileIdsFromImageList(images)) entry.fileIds.add(id);
  };

  for (const row of productRows.rows) {
    add(String(row.id), String(row.vendor_id), row.images);
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
