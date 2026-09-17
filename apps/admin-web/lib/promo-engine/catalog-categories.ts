import { apiClient } from '@/lib/api-client';

export interface CatalogServiceCategory {
  id: string;
  slug: string;
  name: string;
}

const UUID_RE = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function isEcommerceCategory(row: Record<string, unknown>): boolean {
  const type = readString(row.type, row.category_type, row.categoryType).toLowerCase();
  return type === 'ecommerce' || type === 'product' || type === 'shop';
}

function isInactive(row: Record<string, unknown>): boolean {
  const status = readString(row.status, row.is_active, row.isActive).toLowerCase();
  if (!status) return false;
  return status === 'inactive' || status === 'false' || status === '0' || status === 'draft';
}

/** Catalogue slug used as the stored service key (Admin → Catalogue → Categories). */
export function catalogCategorySlug(raw: unknown): string {
  const row = asRecord(raw);
  const slug = readString(row.slug, row.categoryId, row.category_id, row.category_slug);
  if (slug && !UUID_RE.test(slug)) return slug;
  const id = readString(row.id);
  if (id && !UUID_RE.test(id)) return id;
  return slug;
}

export function catalogCategoryName(raw: unknown, fallbackSlug = ''): string {
  const row = asRecord(raw);
  return readString(row.name, row.display_name, row.displayName, fallbackSlug);
}

export function normalizeCatalogCategories(raw: unknown): CatalogServiceCategory[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: CatalogServiceCategory[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (isEcommerceCategory(row) || isInactive(row)) continue;
    const slug = catalogCategorySlug(row);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({
      id: readString(row.id, row.categoryId, row.category_id, slug),
      slug,
      name: catalogCategoryName(row, slug),
    });
  }
  return out;
}

export function labelForCatalogSlug(
  slug: string,
  categories: CatalogServiceCategory[],
): string {
  if (!slug) return '';
  const match = matchCatalogSlug(slug, categories);
  if (match) {
    const row = categories.find((c) => c.slug === match);
    return row?.name || match;
  }
  return slug;
}

/** Map a stored or legacy value (GROOMING, grooming, uuid) onto a catalogue slug. */
export function matchCatalogSlug(
  value: string,
  categories: CatalogServiceCategory[],
): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]+/g, '');
  const found = categories.find((c) => {
    const slug = c.slug.toLowerCase();
    const name = c.name.toLowerCase();
    const id = c.id.toLowerCase();
    return (
      c.slug === raw ||
      slug === lower ||
      id === lower ||
      name === lower ||
      slug.replace(/[^a-z0-9]+/g, '') === compact ||
      name.replace(/[^a-z0-9]+/g, '') === compact
    );
  });
  return found?.slug;
}

export function labelsForCatalogSlugs(
  slugs: string[],
  categories: CatalogServiceCategory[],
): string {
  return slugs.map((slug) => labelForCatalogSlug(slug, categories)).filter(Boolean).join(', ');
}

let cached: CatalogServiceCategory[] | null = null;
let inflight: Promise<CatalogServiceCategory[]> | null = null;

export async function fetchCatalogServiceCategories(): Promise<CatalogServiceCategory[]> {
  if (cached) return cached;
  if (!inflight) {
    inflight = (async () => {
      const res = await apiClient.get<{ success?: boolean; categories?: unknown }>(
        '/admin/catalog/categories',
      );
      const rows = normalizeCatalogCategories(res.categories);
      cached = rows;
      return rows;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function __resetCatalogServiceCategoryCacheForTests() {
  cached = null;
  inflight = null;
}
