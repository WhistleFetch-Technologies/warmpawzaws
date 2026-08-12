import { loadSearchTaxonomyRows } from './cache';
import { getBuiltinTaxonomyRows } from './builtin-keywords';
import { findTopHubMatchedPhrase, resolveSearchCategoriesFromRows } from './resolver';
import type { SearchCategoryMatch, SearchTaxonomyResolveResult } from './types';

export type SearchTaxonomyFullResult = SearchTaxonomyResolveResult & {
  topHubSlug: string | null;
  topMatchedPhrase: string | null;
  /** `db` when rows loaded from Postgres; `builtin` when fallback phrases used. */
  source: 'db' | 'builtin' | 'none';
};

/**
 * Resolve taxonomy for a customer query (DB first, built-in fallback when table empty).
 */
export async function resolveSearchTaxonomy(searchQuery: string): Promise<SearchTaxonomyFullResult> {
  const q = String(searchQuery || '').trim();
  if (!q) {
    return {
      categories: [],
      topHubSlug: null,
      topMatchedPhrase: null,
      source: 'none',
      intentCode: null,
      confidence: 0,
    };
  }

  const dbRows = await loadSearchTaxonomyRows();
  const source: 'db' | 'builtin' = dbRows.length > 0 ? 'db' : 'builtin';
  const rows = dbRows.length > 0 ? dbRows : getBuiltinTaxonomyRows();
  const resolved = resolveSearchCategoriesFromRows(q, rows);
  const topHubSlug = pickTopHubSlug(resolved.categories);
  const topMatchedPhrase = findTopHubMatchedPhrase(q, rows, topHubSlug);

  return {
    ...resolved,
    topHubSlug,
    topMatchedPhrase,
    source,
  };
}

function pickTopHubSlug(categories: SearchCategoryMatch[]): string | null {
  if (!categories.length) return null;
  return categories[0].hubSlug || null;
}

export function logSearchTaxonomyDebug(opts: {
  query: string;
  categories: SearchCategoryMatch[];
  topHubSlug: string | null;
  explicitCategory?: string;
  effectiveCategory?: string;
  categorySource: 'explicit' | 'taxonomy' | 'none';
  searchMethod: string;
  taxonomySource: 'db' | 'builtin' | 'none';
  hubDrivenRetrieval: boolean;
  searchText?: string;
  searchTokens?: string[];
}): void {
  console.log('[search-taxonomy]', JSON.stringify({
    query: opts.query,
    taxonomySource: opts.taxonomySource,
    resolvedCategories: opts.categories.map((c) => ({
      displayName: c.displayName,
      hubSlug: c.hubSlug,
      score: c.score,
      intentCode: c.intentCode,
      matchKind: c.matchKind,
    })),
    resolvedTopHub: opts.topHubSlug,
    explicitCategory: opts.explicitCategory || null,
    effectiveCategory: opts.effectiveCategory || null,
    categorySource: opts.categorySource,
    hubDrivenRetrieval: opts.hubDrivenRetrieval,
    searchText: opts.searchText ?? '',
    searchTokens: opts.searchTokens ?? [],
    searchMethod: opts.searchMethod,
  }));
}
