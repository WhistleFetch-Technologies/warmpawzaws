/**
 * Keep keys in sync with apps/customer-web/lib/pet-blood-types.ts
 */

export const ALL_VALID_BLOOD_TYPE_KEYS = [
  'dog:dea1_positive',
  'dog:dea1_negative',
  'dog:dea3',
  'dog:dea4',
  'dog:dea5',
  'dog:dea6',
  'dog:dea7',
  'dog:dea8',
  'dog:dal',
  'dog:kai1',
  'dog:kai2',
  'dog:unknown',
  'cat:type_a',
  'cat:type_b',
  'cat:type_ab',
  'cat:mik_positive',
  'cat:mik_negative',
  'cat:fea_other',
  'cat:unknown',
] as const;

const VALID_KEYS = new Set<string>(ALL_VALID_BLOOD_TYPE_KEYS);

function normalizeSpecies(species: string): 'dog' | 'cat' | undefined {
  const s = String(species || '').toLowerCase();
  if (s.includes('cat')) return 'cat';
  if (s.includes('dog')) return 'dog';
  return undefined;
}

export function isValidBloodTypeKey(key: string): boolean {
  return VALID_KEYS.has(key);
}

export function isBloodTypeKeyForSpecies(key: string, species: string): boolean {
  const normalizedSpecies = normalizeSpecies(species);
  if (!normalizedSpecies) return false;
  return key.startsWith(`${normalizedSpecies}:`);
}

export function normalizeBloodTypeForStorage(
  key: unknown,
  species: string
): string | undefined {
  if (key == null || key === '') return undefined;
  const normalized = String(key).trim();
  if (!isValidBloodTypeKey(normalized)) return undefined;
  if (!isBloodTypeKeyForSpecies(normalized, species)) return undefined;
  return normalized;
}

export function sanitizeBloodTypeInput(
  key: unknown,
  species: string
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (key == null || key === '') {
    return { ok: true, value: undefined };
  }

  const normalized = String(key).trim();
  if (!isValidBloodTypeKey(normalized)) {
    return { ok: false, error: 'Invalid blood type for this pet species' };
  }

  if (!isBloodTypeKeyForSpecies(normalized, species)) {
    return { ok: false, error: 'Invalid blood type for this pet species' };
  }

  return { ok: true, value: normalized };
}

export function wasBloodTypeInPayload(payload: Record<string, unknown>): boolean {
  if (Object.prototype.hasOwnProperty.call(payload, 'bloodType')) return true;
  const medicalHistory = payload.medicalHistory ?? payload.medical_history;
  if (medicalHistory && typeof medicalHistory === 'object' && Object.prototype.hasOwnProperty.call(medicalHistory, 'bloodType')) {
    return true;
  }
  const healthRecords = payload.healthRecords ?? payload.health_records;
  if (healthRecords && typeof healthRecords === 'object' && Object.prototype.hasOwnProperty.call(healthRecords, 'bloodType')) {
    return true;
  }
  return false;
}

export function resolveBloodTypeFromPayload(
  payload: Record<string, unknown>,
  species: string
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  const medicalHistory = (payload.medicalHistory ?? payload.medical_history ?? {}) as Record<string, unknown>;
  const healthRecords = (payload.healthRecords ?? payload.health_records ?? {}) as Record<string, unknown>;
  const candidate = payload.bloodType ?? medicalHistory.bloodType ?? healthRecords.bloodType;
  return sanitizeBloodTypeInput(candidate, species);
}
