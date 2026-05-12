import {
  parsePaginationFromCustomerServiceResponse,
  type CustomerServicePaginationMeta,
} from '@warmpawz/shared-types';

/**
 * Normalize GET pets responses from multiple backend shapes:
 * - Enhanced: { success, data: { pets } }
 * - Legacy: { pets }
 * - Phone route: { success, pets }
 * - Rare: top-level array or data as array
 */

export type PetUi = {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: number;
  weight: number;
  gender: string;
  photo_url?: string;
};

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

export function extractPetsArray(res: unknown): unknown[] {
  if (res == null || typeof res !== 'object') return [];
  const r = res as Record<string, unknown>;

  if (Array.isArray(r.pets)) return r.pets;

  const data = r.data;
  if (data != null && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.pets)) return d.pets;
    if (Array.isArray(data)) return data as unknown[];
  }

  if (Array.isArray(r.data)) return r.data as unknown[];
  if (Array.isArray(r)) return r as unknown[];

  return [];
}

export function normalizePetForUi(raw: unknown): PetUi | null {
  if (raw == null || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const id = p.id != null ? String(p.id).trim() : '';
  if (!id) return null;

  const name = p.name != null ? String(p.name).trim() : '';
  const speciesRaw = p.species ?? p.type;
  const species =
    speciesRaw != null && String(speciesRaw).trim() !== ''
      ? String(speciesRaw).trim().toLowerCase()
      : 'pet';

  const breedRaw = p.breed;
  const breed =
    breedRaw != null && String(breedRaw).trim() !== ''
      ? String(breedRaw).trim()
      : '';

  function firstFinite(nums: unknown[]): number {
    for (const v of nums) {
      const n = num(v, NaN);
      if (!Number.isNaN(n)) return n;
    }
    return 0;
  }

  const age = firstFinite([p.age, p.age_years, (p as { ageYears?: unknown }).ageYears]);
  const weight = firstFinite([p.weight, p.weight_kg, (p as { weightKg?: unknown }).weightKg]);

  const genderRaw = p.gender;
  const gender =
    genderRaw != null && String(genderRaw).trim() !== ''
      ? String(genderRaw).trim().toLowerCase()
      : 'unknown';

  const photo_url =
    (typeof p.photo_url === 'string' && p.photo_url) ||
    (typeof p.profile_photo_url === 'string' && p.profile_photo_url) ||
    (typeof p.photo === 'string' && p.photo) ||
    (typeof p.image === 'string' && p.image) ||
    undefined;

  return {
    id,
    name: name || 'Unnamed pet',
    species,
    breed,
    age: Number.isNaN(age) ? 0 : age,
    weight: Number.isNaN(weight) ? 0 : weight,
    gender,
    photo_url,
  };
}

export function petsFromApiResponse(res: unknown): PetUi[] {
  const arr = extractPetsArray(res);
  const out: PetUi[] = [];
  for (const item of arr) {
    const n = normalizePetForUi(item);
    if (n) out.push(n);
  }
  return out;
}

export function petsAndPaginationFromApiResponse(res: unknown): {
  pets: PetUi[];
  pagination?: CustomerServicePaginationMeta;
} {
  return {
    pets: petsFromApiResponse(res),
    pagination: parsePaginationFromCustomerServiceResponse(res),
  };
}
