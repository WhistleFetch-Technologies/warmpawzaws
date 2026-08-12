import type { SearchCategoryMatch, SearchTaxonomyKeywordRow, SearchTaxonomyResolveResult } from './types';
import {
  extractSearchModifiers,
  isGenericOnlyPhrase,
  phraseTokensMatchQuery,
  resolveIntentFromRules,
} from './intent-rules';
import { normalizeSearchQuery, tokenizeQuery } from './normalize';
import { isEcommerceOnlyQuery, isServiceHubSlug, SERVICE_BLOCKED_HUBS } from './service-scope';

const MAX_CATEGORIES = 5;
const MIN_PHRASE_LEN = 2;

const PHRASE_MATCH_BONUS = 1000;
const TOKEN_SET_MATCH_BONUS = 500;
const INTENT_RULE_BONUS = 0;

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
    if (SERVICE_BLOCKED_HUBS.has(row.hub_slug)) continue;
    const phraseNorm = normalizeSearchQuery(row.keyword_normalized || row.keyword);
    if (!phraseNorm || phraseNorm.length < MIN_PHRASE_LEN) continue;
    if (isGenericOnlyPhrase(phraseNorm)) continue;
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

function upsertMatch(
  bestByHub: Map<string, SearchCategoryMatch>,
  match: SearchCategoryMatch
): void {
  if (!isServiceHubSlug(match.hubSlug)) return;
  const existing = bestByHub.get(match.hubSlug);
  if (existing && existing.score >= match.score) return;
  bestByHub.set(match.hubSlug, match);
}

/**
 * Phase 2: phrase substring → token-set → intent rules.
 * Service scope: blocks ecommerce-only queries and shop/pharmacy hubs.
 */
export function resolveSearchCategoriesFromRows(
  searchQuery: string,
  rows: SearchTaxonomyKeywordRow[]
): SearchTaxonomyResolveResult {
  const normalized = normalizeSearchQuery(searchQuery);
  if (!normalized) {
    return { categories: [] };
  }

  const tokens = tokenizeQuery(normalized);
  const tokenSet = new Set(tokens);
  const modifiers = extractSearchModifiers(normalized);

  if (isEcommerceOnlyQuery(normalized, tokens)) {
    return { categories: [], blockedEcommerce: true, modifiers, confidence: 0 };
  }

  const phrases = buildPhraseIndex(rows);
  const bestByHub = new Map<string, SearchCategoryMatch>();

  // 1) Longest phrase substring match
  for (const entry of phrases) {
    if (!normalized.includes(entry.phraseNorm)) continue;
    const score = entry.weight + entry.phraseNorm.length + PHRASE_MATCH_BONUS;
    upsertMatch(bestByHub, {
      categorySlug: entry.categorySlug,
      displayName: entry.displayName,
      subcategory: entry.subcategory,
      hubSlug: entry.hubSlug,
      score,
      matchKind: 'phrase',
      matchedSignals: [`phrase:${entry.phraseNorm}`],
    });
  }

  // 2) Token-set match (order-independent)
  for (const entry of phrases) {
    const phraseTokenCount = entry.phraseNorm.split(/\s+/).filter(Boolean).length;
    if (phraseTokenCount < 2) continue;
    if (normalized.includes(entry.phraseNorm)) continue;
    if (!phraseTokensMatchQuery(entry.phraseNorm, tokenSet)) continue;
    const score = entry.weight + entry.phraseNorm.length + TOKEN_SET_MATCH_BONUS;
    upsertMatch(bestByHub, {
      categorySlug: entry.categorySlug,
      displayName: entry.displayName,
      subcategory: entry.subcategory,
      hubSlug: entry.hubSlug,
      score,
      matchKind: 'token_set',
      matchedSignals: [`tokens:${entry.phraseNorm}`],
    });
  }

  // 3) Intent rules
  const intent = resolveIntentFromRules(normalized, tokens);
  if (intent && isServiceHubSlug(intent.hubSlug)) {
    const display = hubDisplayName(intent.hubSlug, rows);
    upsertMatch(bestByHub, {
      categorySlug: display.categorySlug,
      displayName: display.displayName,
      subcategory: null,
      hubSlug: intent.hubSlug,
      score: intent.score + INTENT_RULE_BONUS,
      intentCode: intent.intentCode,
      matchKind: 'intent_rule',
      matchedSignals: intent.matchedSignals,
    });
    Object.assign(modifiers, intent.modifiers);
  }

  const categories = Array.from(bestByHub.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CATEGORIES);

  const top = categories[0];
  const confidence = top ? Math.min(1, top.score / (PHRASE_MATCH_BONUS + 200)) : 0;

  return {
    categories,
    intentCode: top?.intentCode ?? intent?.intentCode ?? null,
    modifiers,
    confidence: categories.length ? confidence : 0,
  };
}

function hubDisplayName(
  hubSlug: string,
  rows: SearchTaxonomyKeywordRow[]
): { categorySlug: string; displayName: string } {
  const row = rows.find((r) => r.hub_slug === hubSlug && isServiceHubSlug(r.hub_slug));
  if (row) {
    return { categorySlug: row.category_slug, displayName: row.category_display_name };
  }
  const defaults: Record<string, { categorySlug: string; displayName: string }> = {
    vet: { categorySlug: 'veterinary_and_healthcare', displayName: 'Veterinary & Healthcare' },
    grooming: { categorySlug: 'grooming', displayName: 'Grooming' },
    training: { categorySlug: 'training_and_behaviour', displayName: 'Training & Behaviour' },
    boarding: { categorySlug: 'boarding_and_daycare', displayName: 'Boarding & Daycare' },
    walker: { categorySlug: 'walking_and_sitting', displayName: 'Walking & Sitting' },
    'pet-sitter': { categorySlug: 'walking_and_sitting', displayName: 'Walking & Sitting' },
    nutritionist: { categorySlug: 'nutrition_and_wellness', displayName: 'Nutrition & Wellness' },
  };
  return defaults[hubSlug] || { categorySlug: hubSlug, displayName: hubSlug };
}

/** Longest taxonomy phrase matched for the top hub (phrase or token-set). */
export function findTopHubMatchedPhrase(
  searchQuery: string,
  rows: SearchTaxonomyKeywordRow[],
  topHubSlug: string | null
): string | null {
  if (!topHubSlug) return null;
  const normalized = normalizeSearchQuery(searchQuery);
  if (!normalized) return null;

  const tokenSet = new Set(tokenizeQuery(normalized));
  let best = '';

  for (const entry of buildPhraseIndex(rows)) {
    if (entry.hubSlug !== topHubSlug) continue;
    const matched =
      normalized.includes(entry.phraseNorm) || phraseTokensMatchQuery(entry.phraseNorm, tokenSet);
    if (!matched) continue;
    if (entry.phraseNorm.length > best.length) best = entry.phraseNorm;
  }

  return best || null;
}
