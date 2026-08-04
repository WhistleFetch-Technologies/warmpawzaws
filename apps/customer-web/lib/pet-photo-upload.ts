import { apiClient } from '@/lib/api-client';
import type { PhotoUploadResult } from '@/lib/photo-upload-enhanced';

/**
 * Extract S3 object key from a presigned URL or raw key string.
 */
export function extractPetImageKey(urlOrKey: string | null | undefined): string | null {
  if (urlOrKey == null) return null;
  let raw = String(urlOrKey).trim();
  if (!raw || raw.startsWith('data:')) return null;

  if (raw.includes('X-Amz-Algorithm=') || raw.includes('X-Amz-Credential=')) {
    try {
      const u = new URL(raw);
      u.search = '';
      raw = u.toString();
    } catch {
      raw = raw.split('?')[0] ?? raw;
    }
  }

  if (!raw.includes('://')) {
    return raw.replace(/^\/+/, '');
  }

  try {
    const u = new URL(raw.split('?')[0]);
    const hostMatch = u.hostname.match(/^([^.]+)\.s3[./]/);
    if (hostMatch) {
      return decodeURIComponent(u.pathname.replace(/^\//, ''));
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Collect display + thumb keys from a pet photo upload API result.
 */
export function collectUploadKeysFromResult(result: PhotoUploadResult): string[] {
  const imageKey = result.imageKey || result.fileName;
  if (!imageKey) return [];

  const keys: string[] = [imageKey];
  const thumbKey =
    result.thumbKey ||
    (imageKey.endsWith('.webp') ? imageKey.replace(/\.webp$/i, '.thumb.webp') : null);
  if (thumbKey && thumbKey !== imageKey) keys.push(thumbKey);
  return keys;
}

/**
 * Abandon uncommitted pet wizard uploads (temp pet_* folder).
 */
export async function abandonPendingPetPhotoUploads(
  tempPetId: string,
  imageKeys: string[],
): Promise<{ success: boolean; deleted?: number; failed?: number }> {
  const normalizedKeys = imageKeys
    .map((k) => extractPetImageKey(k) ?? k.trim())
    .filter(Boolean);

  if (!tempPetId || normalizedKeys.length === 0) {
    return { success: true, deleted: 0, failed: 0 };
  }

  try {
    const response = await apiClient.post<{
      success?: boolean;
      deleted?: number;
      failed?: number;
      error?: string;
    }>('/storage/abandon-pet-upload', {
      tempPetId,
      imageKeys: normalizedKeys,
    });

    return {
      success: Boolean(response?.success),
      deleted: response?.deleted ?? 0,
      failed: response?.failed ?? 0,
    };
  } catch (err) {
    console.warn('[pet-photo-upload] abandon failed:', err);
    return { success: false, deleted: 0, failed: normalizedKeys.length };
  }
}

/**
 * Keys eligible for abandon (pending minus committed).
 */
export function keysToAbandon(
  pendingKeys: string[],
  committedKey: string | null,
): string[] {
  if (!committedKey) return [...pendingKeys];
  return pendingKeys.filter((k) => {
    const normalized = extractPetImageKey(k) ?? k;
    return normalized !== committedKey;
  });
}
