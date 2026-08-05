/**
 * Abandon uncommitted pet avatar uploads from the add-pet wizard (temp pet_* IDs).
 */

import { deleteObjectKey } from './image-repository';

const TEMP_PET_ID_RE = /^pet_\d{10,}$/;

function sanitizePetOwnerId(id: string): string {
  return String(id)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 128);
}

function buildAllowedKeyPattern(sanitizedTempPetId: string): RegExp {
  const escaped = sanitizedTempPetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `^media/pet/${escaped}/avatar_[a-z0-9]+(?:\\.thumb)?\\.webp$`,
    'i',
  );
}

export type AbandonPetUploadInput = {
  tempPetId: string;
  imageKeys: string[];
};

export type AbandonPetUploadResult = {
  success: boolean;
  deleted: number;
  failed: number;
  error?: string;
};

export function validateAbandonPetUploadInput(input: AbandonPetUploadInput): string | null {
  const tempPetId = String(input.tempPetId || '').trim();
  if (!tempPetId || !TEMP_PET_ID_RE.test(tempPetId)) {
    return 'tempPetId must be a wizard temp id (pet_<timestamp>)';
  }

  const keys = input.imageKeys;
  if (!Array.isArray(keys) || keys.length === 0) {
    return 'imageKeys must be a non-empty array';
  }

  const sanitized = sanitizePetOwnerId(tempPetId);
  const pattern = buildAllowedKeyPattern(sanitized);

  for (const raw of keys) {
    const key = String(raw || '').trim().replace(/^\/+/, '');
    if (!key || !pattern.test(key)) {
      return `Invalid imageKey for temp pet upload: ${raw}`;
    }
  }

  return null;
}

export async function abandonPetUploadKeys(input: AbandonPetUploadInput): Promise<AbandonPetUploadResult> {
  const validationError = validateAbandonPetUploadInput(input);
  if (validationError) {
    return { success: false, deleted: 0, failed: 0, error: validationError };
  }

  const uniqueKeys = [...new Set(
    input.imageKeys.map((k) => String(k).trim().replace(/^\/+/, '')).filter(Boolean),
  )];

  let deleted = 0;
  let failed = 0;

  for (const key of uniqueKeys) {
    try {
      await deleteObjectKey(key);
      deleted += 1;
    } catch {
      failed += 1;
    }
  }

  return { success: failed === 0, deleted, failed };
}
