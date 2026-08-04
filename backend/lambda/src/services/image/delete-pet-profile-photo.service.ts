/**
 * Delete committed pet profile photo assets from S3 when a pet is deleted.
 */

import { isValidUUID } from '../../types/entities';
import { extractRawImageKey } from './image-migrator';
import { deleteObjectKey, listObjectKeysUnderPrefix } from './image-repository';

const PET_AVATAR_KEY_RE = /^media\/pet\/[^/]+\/avatar_[a-z0-9]+(?:\.thumb)?\.webp$/i;

export type DeletePetProfilePhotoResult = {
  deleted: number;
  failed: number;
};

function sanitizePetOwnerId(id: string): string {
  return String(id)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 128);
}

function buildUuidPetAvatarPattern(sanitizedPetId: string): RegExp {
  const escaped = sanitizedPetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^media/pet/${escaped}/avatar_[a-z0-9]+(?:\\.thumb)?\\.webp$`,
    'i',
  );
}

export function isAllowedPetProfilePhotoKey(
  key: string,
  petId: string,
): boolean {
  const normalized = key.replace(/^\/+/, '');
  if (!PET_AVATAR_KEY_RE.test(normalized)) return false;

  const sanitizedPetId = sanitizePetOwnerId(petId);
  const uuidPattern = buildUuidPetAvatarPattern(sanitizedPetId);
  if (uuidPattern.test(normalized)) return true;

  // Legacy wizard temp folder — only when key is explicitly from profile_photo_url
  const legacyPattern = /^media\/pet\/pet_\d{10,}\/avatar_[a-z0-9]+(?:\.thumb)?\.webp$/i;
  return legacyPattern.test(normalized);
}

function keysFromProfilePhotoUrl(
  profilePhotoUrl: string | null | undefined,
  petId: string,
): string[] {
  const displayKey = extractRawImageKey(profilePhotoUrl);
  if (!displayKey || !isAllowedPetProfilePhotoKey(displayKey, petId)) {
    return [];
  }

  const keys = [displayKey];
  if (displayKey.endsWith('.webp')) {
    const thumbKey = displayKey.replace(/\.webp$/i, '.thumb.webp');
    if (thumbKey !== displayKey && isAllowedPetProfilePhotoKey(thumbKey, petId)) {
      keys.push(thumbKey);
    }
  }
  return keys;
}

function filterPrefixAvatarKeys(keys: string[], sanitizedPetId: string): string[] {
  const pattern = buildUuidPetAvatarPattern(sanitizedPetId);
  return keys.filter((k) => pattern.test(k.replace(/^\/+/, '')));
}

export async function deletePetProfilePhotoAssets(
  petId: string,
  profilePhotoUrl: string | null | undefined,
): Promise<DeletePetProfilePhotoResult> {
  if (!isValidUUID(petId)) {
    return { deleted: 0, failed: 0 };
  }

  const sanitizedPetId = sanitizePetOwnerId(petId);
  const keySet = new Set<string>();

  for (const key of keysFromProfilePhotoUrl(profilePhotoUrl, petId)) {
    keySet.add(key.replace(/^\/+/, ''));
  }

  const prefixKeys = await listObjectKeysUnderPrefix(`media/pet/${sanitizedPetId}/`);
  for (const key of filterPrefixAvatarKeys(prefixKeys, sanitizedPetId)) {
    keySet.add(key.replace(/^\/+/, ''));
  }

  if (keySet.size === 0) {
    return { deleted: 0, failed: 0 };
  }

  let deleted = 0;
  let failed = 0;

  for (const key of keySet) {
    try {
      await deleteObjectKey(key);
      deleted += 1;
    } catch (err: unknown) {
      failed += 1;
      console.warn(
        '[delete-pet-profile-photo] failed to delete key:',
        key,
        (err as Error)?.message || err,
      );
    }
  }

  return { deleted, failed };
}
