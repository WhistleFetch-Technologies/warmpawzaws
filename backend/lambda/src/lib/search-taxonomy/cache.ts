import { query } from '../../database/rds-connection';
import type { SearchTaxonomyKeywordRow } from './types';
import { resolveSearchCategoriesFromRows } from './resolver';
import type { SearchTaxonomyResolveResult } from './types';

const CACHE_TTL_MS = 10 * 60 * 1000;

let cachedRows: SearchTaxonomyKeywordRow[] | null = null;
let cachedAt = 0;
let cachedWatermark: string | null = null;

async function fetchWatermark(): Promise<string | null> {
  try {
    const res = await query(
      `SELECT COALESCE(MAX(updated_at)::text, '') AS wm FROM search_taxonomy_keywords WHERE is_active = true`
    );
    return res.rows[0]?.wm ?? '';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('search_taxonomy_keywords') || msg.includes('does not exist')) {
      return null;
    }
    throw err;
  }
}

async function fetchActiveRows(): Promise<SearchTaxonomyKeywordRow[]> {
  const res = await query(
    `SELECT id::text AS id,
            category_slug,
            category_display_name,
            subcategory,
            keyword,
            keyword_normalized,
            hub_slug,
            weight,
            is_active
     FROM search_taxonomy_keywords
     WHERE is_active = true`
  );
  return (res.rows || []) as SearchTaxonomyKeywordRow[];
}

export async function loadSearchTaxonomyRows(force = false): Promise<SearchTaxonomyKeywordRow[]> {
  const now = Date.now();
  const wm = await fetchWatermark();
  if (wm === null) {
    return [];
  }

  const stale =
    force ||
    !cachedRows ||
    now - cachedAt > CACHE_TTL_MS ||
    wm !== cachedWatermark;

  if (!stale && cachedRows) {
    return cachedRows;
  }

  cachedRows = await fetchActiveRows();
  cachedAt = now;
  cachedWatermark = wm;
  return cachedRows;
}

export function invalidateSearchTaxonomyCache(): void {
  cachedRows = null;
  cachedAt = 0;
  cachedWatermark = null;
}

export async function resolveSearchCategories(searchQuery: string): Promise<SearchTaxonomyResolveResult> {
  const rows = await loadSearchTaxonomyRows();
  return resolveSearchCategoriesFromRows(searchQuery, rows);
}
