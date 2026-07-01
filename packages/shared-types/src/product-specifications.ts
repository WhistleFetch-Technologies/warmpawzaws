/**
 * Product specifications helpers — Key:Value CSV and reserved keys.
 */

export const RESERVED_SPEC_KEYS = new Set([
  'key_features',
  'pet_type',
  'pet_type_other',
  'manufacturing_details',
  'length_cm',
  'breadth_cm',
  'height_cm',
  'delivery_regions',
]);

export function parseSpecificationsCsv(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw?.trim()) return out;
  for (const segment of raw.split(',')) {
    const part = segment.trim();
    if (!part) continue;
    const colon = part.indexOf(':');
    if (colon <= 0) continue;
    const key = part.slice(0, colon).trim();
    const value = part.slice(colon + 1).trim();
    if (!key || !value) continue;
    const normKey = key.toLowerCase().replace(/\s+/g, '_');
    if (RESERVED_SPEC_KEYS.has(normKey)) continue;
    out[key] = value;
  }
  return out;
}

export type StoredPetType = 'dog' | 'cat' | 'allpet' | 'other';

export type ResolvedPetType = {
  pet_type: StoredPetType | null;
  pet_type_other: string | null;
};

export const PET_TYPE_CUSTOMER_LABEL_ALL_PETS = 'All pets';

const ALL_PET_ALIASES = new Set([
  'other',
  'allpet',
  'all pets',
  'all pet',
  'allpets',
  'all-pets',
]);

function trimStr(raw: unknown): string {
  return String(raw ?? '').trim();
}

function isAllPetAlias(normalized: string): boolean {
  return ALL_PET_ALIASES.has(normalized.replace(/\s+/g, ' '));
}

/** @deprecated Prefer resolveVendorPetTypeInput for vendor input; kept for legacy callers. */
export function normalizePetType(raw: unknown): StoredPetType | '' {
  const resolved = resolveVendorPetTypeInput(raw);
  return resolved.pet_type ?? '';
}

/** Single vendor-facing string (+ optional legacy second column) → stored form. */
export function resolveVendorPetTypeInput(
  rawPetType: unknown,
  legacyPetTypeOther?: unknown,
): ResolvedPetType {
  const legacyLabel = trimStr(legacyPetTypeOther);
  const raw = trimStr(rawPetType);

  if (!raw && !legacyLabel) {
    return { pet_type: 'allpet', pet_type_other: null };
  }

  if (legacyLabel) {
    const mainNorm = raw.toLowerCase();
    if (!raw || isAllPetAlias(mainNorm)) {
      return { pet_type: 'other', pet_type_other: legacyLabel };
    }
  }

  if (!raw) {
    return { pet_type: 'allpet', pet_type_other: null };
  }

  const norm = raw.toLowerCase().replace(/\s+/g, ' ');
  if (norm === 'dog' || norm === 'dogs') {
    return { pet_type: 'dog', pet_type_other: null };
  }
  if (norm === 'cat' || norm === 'cats') {
    return { pet_type: 'cat', pet_type_other: null };
  }
  if (isAllPetAlias(norm)) {
    return { pet_type: 'allpet', pet_type_other: null };
  }

  return { pet_type: 'other', pet_type_other: raw };
}

/** Normalize stored pet_type for read paths (legacy other without label → allpet). */
export function normalizeStoredPetType(
  pet_type: unknown,
  pet_type_other?: unknown,
): StoredPetType | null {
  const label = trimStr(pet_type_other);
  const raw = trimStr(pet_type).toLowerCase();
  if (!raw && !label) return 'allpet';
  if (!raw) return label ? 'other' : 'allpet';
  if (raw === 'dog' || raw === 'dogs') return 'dog';
  if (raw === 'cat' || raw === 'cats') return 'cat';
  if (raw === 'other') return label ? 'other' : 'allpet';
  if (raw === 'allpet' || isAllPetAlias(raw)) return 'allpet';
  return 'other';
}

/** Stored form → single string for vendor form / bulk round-trip. */
export function formatPetTypeForVendor(pet_type: unknown, pet_type_other?: unknown): string {
  const stored = normalizeStoredPetType(pet_type, pet_type_other);
  const label = trimStr(pet_type_other);
  if (stored === 'dog') return 'Dog';
  if (stored === 'cat') return 'Cat';
  if (stored === 'allpet') return PET_TYPE_CUSTOMER_LABEL_ALL_PETS;
  if (stored === 'other' && label) return label;
  return '';
}

/** Stored form → customer-facing label. */
export function formatPetTypeForCustomer(pet_type: unknown, pet_type_other?: unknown): string {
  const stored = normalizeStoredPetType(pet_type, pet_type_other);
  const label = trimStr(pet_type_other);
  if (stored === 'dog') return 'Dog';
  if (stored === 'cat') return 'Cat';
  if (stored === 'allpet') return PET_TYPE_CUSTOMER_LABEL_ALL_PETS;
  if (stored === 'other' && label) return label;
  return PET_TYPE_CUSTOMER_LABEL_ALL_PETS;
}

export type ProductDimensionsCm = {
  length_cm?: number | null;
  breadth_cm?: number | null;
  height_cm?: number | null;
};

export type StorefrontDimensions = {
  length: number;
  width: number;
  height: number;
  weight: number;
};

export function parseOptionalPositiveNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(String(raw).replace(/,/g, '').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
