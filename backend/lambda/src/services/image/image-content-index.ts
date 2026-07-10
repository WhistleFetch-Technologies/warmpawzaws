/**
 * SHA256 dedup index (product, facility, banner only).
 */

import { createHash } from 'crypto';
import { query } from '../../database/rds-connection';
import type { AssetType } from './image-types';
import { DEDUP_ASSET_TYPES } from './image-types';
import { buildThumbWebpKey } from './image-key-builder';

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export type DedupHit = {
  webpKey: string;
  thumbKey: string | null;
};

export async function lookupDedupEntry(sha256: string): Promise<DedupHit | null> {
  try {
    const result = await query(
      `SELECT webp_key, thumb_key FROM image_content_index WHERE content_sha256 = $1 LIMIT 1`,
      [sha256],
    );
    const row = result.rows[0] as { webp_key?: string; thumb_key?: string | null } | undefined;
    if (!row?.webp_key) return null;
    return {
      webpKey: row.webp_key,
      thumbKey: row.thumb_key ?? null,
    };
  } catch (err: unknown) {
    const msg = (err as Error)?.message || '';
    if (msg.includes('image_content_index') && msg.includes('does not exist')) {
      return null;
    }
    console.warn('[image-content-index] lookup failed:', msg);
    return null;
  }
}

export async function insertDedupEntry(opts: {
  sha256: string;
  webpKey: string;
  thumbKey: string | null;
  byteSize: number;
}): Promise<void> {
  if (!DEDUP_ASSET_TYPES.size) return;
  try {
    await query(
      `INSERT INTO image_content_index (content_sha256, webp_key, thumb_key, byte_size)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (content_sha256) DO NOTHING`,
      [opts.sha256, opts.webpKey, opts.thumbKey, opts.byteSize],
    );
  } catch (err: unknown) {
    const msg = (err as Error)?.message || '';
    if (msg.includes('image_content_index') && msg.includes('does not exist')) {
      return;
    }
    console.warn('[image-content-index] insert failed:', msg);
  }
}

export function shouldDedup(assetType: AssetType): boolean {
  return DEDUP_ASSET_TYPES.has(assetType);
}

export function thumbKeyForDisplay(displayKey: string, explicitThumb: string | null): string | null {
  return explicitThumb ?? (displayKey ? buildThumbWebpKey(displayKey) : null);
}
