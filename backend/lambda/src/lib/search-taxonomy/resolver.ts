import type { SearchCategoryMatch, SearchTaxonomyKeywordRow, SearchTaxonomyResolveResult } from './types';
import { normalizeSearchPhrase } from './normalize';

const MAX_CATEGORIES = 5;
const MIN_PHRASE_LEN = 2;

type PhraseEntry = {
  phraseNorm: string;
  weight: number;
  categorySlug: string;
  displayName: string;
  subcategory: string | null;
  hubSlug: string;
};

export function buildPhraseIndex(rows: SearchTaxonomyKeywordRow[]): PhraseEntry[] {
  const entries: PhraseEntry[] = [];
  for (const row of rows) {
    if (!row.is_active) continue;
    const phraseNorm = row.keyword_normalized;
    if (!phraseNorm || phraseNorm.length < MIN_PHRASE_LEN) continue;
    entries.push({
      phraseNorm,
      weight: Number(row.weight) || 100,
      categorySlug: row.category_slug,
      displayName: row.category_display_name,
      subcategory: row.subcategory,
      hubSlug: row.hub_slug,
    });
  }
  return entries.sort((a, b) => b.phraseNorm.length - a.phraseNorm.length);
}

/**
 * Match customer query against taxonomy phrases (longest phrase wins per hub).
 * Does not set inferred hub or filter entities — enrichment only (Phase 1).
 */
export function resolveSearchCategoriesFromRows(
  searchQuery: string,
  rows: SearchTaxonomyKeywordRow[]
): SearchTaxonomyResolveResult {
  const q = normalizeSearchPhrase(searchQuery);
  if (!q) {
    return { categories: [] };
  }

  const phrases = buildPhraseIndex(rows);
  const bestByHub = new Map<string, SearchCategoryMatch>();

  for (const entry of phrases) {
    if (!q.includes(entry.phraseNorm)) continue;
    const score = entry.weight + entry.phraseNorm.length;
    const existing = bestByHub.get(entry.hubSlug);
    if (existing && existing.score >= score) continue;

    bestByHub.set(entry.hubSlug, {
      categorySlug: entry.categorySlug,
      displayName: entry.displayName,
      subcategory: entry.subcategory,
      hubSlug: entry.hubSlug,
      score,
    });
  }

  const categories = Array.from(bestByHub.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CATEGORIES);

  return { categories };
}

/** Longest taxonomy phrase matched for the top hub (used to strip routing, not service terms). */
export function findTopHubMatchedPhrase(
  searchQuery: string,
  rows: SearchTaxonomyKeywordRow[],
  topHubSlug: string | null
): string | null {
  if (!topHubSlug) return null;
  const q = normalizeSearchPhrase(searchQuery);
  if (!q) return null;

  let best = '';
  for (const entry of buildPhraseIndex(rows)) {
    if (entry.hubSlug !== topHubSlug) continue;
    if (!q.includes(entry.phraseNorm)) continue;
    if (entry.phraseNorm.length > best.length) best = entry.phraseNorm;
  }
  return best || null;
}
