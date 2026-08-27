/**
 * Normalize bulk Image cells: expand one Drive folder per row into comma-separated file URLs.
 * Idempotent — rows that already have file URLs pass through unchanged.
 */

import { classifyBulkImageCell } from './bulk-image-cell';
import {
  createDriveFolderListCache,
  DRIVE_FOLDER_FETCH_CONCURRENCY,
  listDriveFolderImages,
  mapWithConcurrency,
  type DriveFolderListCache,
} from './drive-folder-images';
import { getBulkProductTitle } from './product-ecommerce-validation';
import { resolveBulkGroupKey } from './product-group-identity';
import { normalizeProductGroupKey } from './bulk-product-variant-builder';

export type ExpandBulkImageError = {
  row: number;
  field: 'images';
  message: string;
  value?: string;
};

export type ExpandBulkImageWarning = {
  row: number;
  field: 'images';
  message: string;
  value?: string;
};

export type ExpandBulkRowImagesResult = {
  errors: ExpandBulkImageError[];
  warnings: ExpandBulkImageWarning[];
};

const CONFLICT_MESSAGE =
  'This Drive folder is used on more than one product. Use one folder per product (or per variant row of the same product), or paste comma-separated file URLs.';

const TRUNCATION_WARNING =
  'This Drive folder has more than 8 images; only the first 8 (by filename) were kept.';

type RowRef = Record<string, unknown> & { rowNum?: number };

function parentKeyForRow(vendorId: string, row: RowRef): string {
  const fromResolve = resolveBulkGroupKey(vendorId, {
    product_group_id: (row.product_group_id as string) ?? null,
    name: String(row.name ?? row.title ?? ''),
    brand: (row.brand as string) ?? null,
    category: (row.category as string) ?? null,
    category_id: (row.category_id as string) ?? null,
  });
  if (fromResolve) return fromResolve;
  const name = getBulkProductTitle(row);
  const category = String(row.category ?? '').trim();
  return normalizeProductGroupKey(name, category || '_');
}

function imageRaw(row: RowRef): unknown {
  return row.images ?? row.image_urls;
}

/**
 * Mutates rows in place: folder cells become comma-separated file URLs.
 * Returns per-row errors/warnings; does not throw for folder failures.
 */
export async function expandBulkRowImages(
  vendorId: string,
  rows: RowRef[],
  options?: { cache?: DriveFolderListCache; listFolder?: typeof listDriveFolderImages },
): Promise<ExpandBulkRowImagesResult> {
  const errors: ExpandBulkImageError[] = [];
  const warnings: ExpandBulkImageWarning[] = [];
  const cache = options?.cache ?? createDriveFolderListCache();
  const listFolder = options?.listFolder ?? listDriveFolderImages;

  type FolderRow = { index: number; rowNum: number; folderId: string; parentKey: string };
  const folderRows: FolderRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = row.rowNum != null ? Number(row.rowNum) : i + 1;
    const classified = classifyBulkImageCell(imageRaw(row));

    if (classified.kind === 'files') {
      // Idempotent: already file URLs — leave unchanged, no Drive call
      continue;
    }

    if (classified.kind === 'invalid') {
      errors.push({
        row: rowNum,
        field: 'images',
        message: classified.message,
        value: String(imageRaw(row) ?? '').slice(0, 200),
      });
      continue;
    }

    folderRows.push({
      index: i,
      rowNum,
      folderId: classified.folderId,
      parentKey: parentKeyForRow(vendorId, row),
    });
  }

  // folderId → set of parent keys (conflict before fetch)
  const ownership = new Map<string, Set<string>>();
  for (const fr of folderRows) {
    let set = ownership.get(fr.folderId);
    if (!set) {
      set = new Set();
      ownership.set(fr.folderId, set);
    }
    set.add(fr.parentKey);
  }

  const conflictedFolderIds = new Set<string>();
  for (const [folderId, parents] of ownership) {
    if (parents.size > 1) conflictedFolderIds.add(folderId);
  }

  const toFetchIds = new Set<string>();
  for (const fr of folderRows) {
    if (conflictedFolderIds.has(fr.folderId)) {
      errors.push({
        row: fr.rowNum,
        field: 'images',
        message: CONFLICT_MESSAGE,
        value: fr.folderId,
      });
    } else {
      toFetchIds.add(fr.folderId);
    }
  }

  const idsToFetch = [...toFetchIds];
  await mapWithConcurrency(idsToFetch, DRIVE_FOLDER_FETCH_CONCURRENCY, (folderId) =>
    listFolder(folderId, cache),
  );

  for (const fr of folderRows) {
    if (conflictedFolderIds.has(fr.folderId)) continue;

    const result = await listFolder(fr.folderId, cache);
    if (!result.ok) {
      errors.push({
        row: fr.rowNum,
        field: 'images',
        message: result.message,
        value: fr.folderId,
      });
      continue;
    }

    rows[fr.index].images = result.urls.join(', ');
    if (result.truncated) {
      warnings.push({
        row: fr.rowNum,
        field: 'images',
        message: TRUNCATION_WARNING,
        value: fr.folderId,
      });
    }
  }

  return { errors, warnings };
}
