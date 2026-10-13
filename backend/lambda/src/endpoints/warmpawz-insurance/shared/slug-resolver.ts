import { INSURANCE_SLUGS, insuranceSlugByKey, type InsuranceSlugDefinition } from '@warmpawz/shared-types';

export interface SlugProfile {
  readonly customer: Record<string, unknown> | null;
  readonly address: Record<string, unknown> | null;
  readonly pet: Record<string, unknown> | null;
}

export interface ResolvedSlug {
  readonly slug: string;
  readonly value: string | null;
  readonly source: 'column' | 'json' | 'missing';
}

function jsonBag(row: Record<string, unknown> | null): Record<string, unknown> | null {
  const raw = row?.medical_history;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function stringify(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  return text === '' ? null : text;
}

function rowFor(def: InsuranceSlugDefinition, profile: SlugProfile): Record<string, unknown> | null {
  if (def.group === 'customer') return profile.customer;
  if (def.group === 'address') return profile.address;
  return profile.pet;
}

export function resolveSlugValue(def: InsuranceSlugDefinition, profile: SlugProfile): ResolvedSlug {
  const row = rowFor(def, profile);
  if (!row) return { slug: def.slug, value: null, source: 'missing' };
  const column = stringify(row[def.source.column]);
  if (column != null) return { slug: def.slug, value: column, source: 'column' };
  const path = def.source.jsonPath;
  if (path) {
    const key = path.split('.').pop() || '';
    const fromJson = stringify(jsonBag(row)?.[key]);
    if (fromJson != null) return { slug: def.slug, value: fromJson, source: 'json' };
  }
  return { slug: def.slug, value: null, source: 'missing' };
}

export function resolveSlugValues(profile: SlugProfile, slugs?: readonly string[]): ResolvedSlug[] {
  const defs = slugs?.length
    ? slugs.map((slug) => insuranceSlugByKey(slug)).filter((def): def is InsuranceSlugDefinition => Boolean(def))
    : [...INSURANCE_SLUGS];
  return defs.map((def) => resolveSlugValue(def, profile));
}
