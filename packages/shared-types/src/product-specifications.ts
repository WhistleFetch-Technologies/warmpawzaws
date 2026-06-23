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

export function normalizePetType(raw: unknown): 'dog' | 'cat' | 'other' | '' {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (s === 'dog' || s === 'dogs') return 'dog';
  if (s === 'cat' || s === 'cats') return 'cat';
  if (s === 'other') return 'other';
  return 'other';
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
