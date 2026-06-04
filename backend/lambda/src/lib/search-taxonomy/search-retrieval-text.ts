import { normalizeSearchPhrase } from './normalize';
import type { CategorySource } from './types';

/**
 * Taxonomy phrases that only route to a hub — no residual text search when the query
 * is exactly this phrase (or phrase + intent modifiers like "near me").
 */
export const TAXONOMY_ROUTING_PHRASES = new Set(
  [
    'dog doctor',
    'cat doctor',
    'pet clinic',
    'animal hospital',
    'pet nutritionist',
    'vet near me',
    'emergency vet',
    '24 hour vet',
  ].map(normalizeSearchPhrase)
);

/** Multi-word intent phrases — stripped before token matching (longest first). */
export const SEARCH_INTENT_PHRASES = [
  'near me',
  'open now',
  'right now',
  'open today',
  'same day',
  '24 hours',
  '24 hour',
  '24hour',
] as const;

/** Single-word intent tokens — never used in strict ILIKE / OpenSearch must. */
export const SEARCH_INTENT_TOKENS = new Set([
  'near',
  'me',
  'now',
  'open',
  'same',
  'day',
  'hour',
  'hours',
  '24',
  'today',
  'tonight',
  'asap',
  'urgent',
  'immediate',
  'immediately',
]);

const PET_QUALIFIER_TOKENS = new Set([
  'dog',
  'cat',
  'pet',
  'pets',
  'puppy',
  'puppies',
  'kitten',
  'kittens',
  'animal',
  'animals',
  'bird',
  'birds',
  'fish',
  'pup',
  'kitty',
]);

/** Hub routing words removed when taxonomy picked the hub (not service-specific). */
const VET_ROUTING_TOKENS = new Set([
  'vet',
  'vets',
  'veterinary',
  'clinic',
  'clinics',
  'hospital',
  'hospitals',
]);

export type ResidualSearchText = {
  /** Joined tokens for logging / API (`""` = category-scoped browse). */
  searchText: string;
  /** Tokens applied as AND filters (SQL) or multi_match query (OpenSearch). */
  tokens: string[];
};

function stripIntentPhrases(normalized: string): string {
  let s = normalized;
  const phrases = [...SEARCH_INTENT_PHRASES].sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    if (s.includes(phrase)) {
      s = s.split(phrase).join(' ');
    }
  }
  return s.replace(/\s+/g, ' ').trim();
}

function queryHadIntentPhrases(normalized: string): boolean {
  return stripIntentPhrases(normalized) !== normalized;
}

function tokenize(normalized: string, maxTokens = 6): string[] {
  return normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, maxTokens);
}

const NUTRITIONIST_ROUTING_TOKENS = new Set([
  'nutrition',
  'nutritionist',
  'diet',
  'dietitian',
  'wellness',
]);

function isHubRoutingToken(token: string, hubSlug: string): boolean {
  if (hubSlug === 'vet') return VET_ROUTING_TOKENS.has(token);
  if (hubSlug === 'grooming') return false;
  if (hubSlug === 'nutritionist') return NUTRITIONIST_ROUTING_TOKENS.has(token);
  return false;
}

function removePhraseFromQuery(query: string, phrase: string | null | undefined): string {
  if (!phrase) return query;
  return query.split(phrase).join(' ').replace(/\s+/g, ' ').trim();
}

function filterSearchTokens(
  rawTokens: string[],
  opts: { categorySource: CategorySource; topHubSlug?: string | null }
): string[] {
  return rawTokens.filter((token) => {
    if (PET_QUALIFIER_TOKENS.has(token)) return false;
    if (SEARCH_INTENT_TOKENS.has(token)) return false;
    if (opts.categorySource === 'taxonomy' && opts.topHubSlug) {
      if (isHubRoutingToken(token, opts.topHubSlug)) return false;
    }
    return true;
  });
}

function isHubBrowseOnlyQuery(
  normalized: string,
  withoutIntent: string,
  topMatchedPhrase: string | null | undefined,
  hadIntent: boolean
): boolean {
  if (!topMatchedPhrase) return false;
  const phrase = normalizeSearchPhrase(topMatchedPhrase);
  if (TAXONOMY_ROUTING_PHRASES.has(phrase)) {
    return normalized === phrase || withoutIntent === phrase;
  }
  return hadIntent && withoutIntent === phrase;
}

/**
 * Build text tokens for entity search after taxonomy category constraint.
 * - Full taxonomy routing phrase → hub browse only (searchText "").
 * - Query extends beyond matched phrase → residual tokens from the extra text only.
 * - Exact non-routing phrase (e.g. pet surgery) → tokens from phrase minus pet/hub routing words.
 */
export function buildResidualSearchText(
  searchQuery: string,
  opts: {
    categorySource: CategorySource;
    topHubSlug?: string | null;
    topMatchedPhrase?: string | null;
  }
): ResidualSearchText {
  const normalized = normalizeSearchPhrase(searchQuery);
  if (!normalized) {
    return { searchText: '', tokens: [] };
  }

  const hadIntent = queryHadIntentPhrases(normalized);
  const withoutIntent = stripIntentPhrases(normalized);
  const matchedPhrase = opts.topMatchedPhrase
    ? normalizeSearchPhrase(opts.topMatchedPhrase)
    : null;

  if (
    opts.categorySource === 'taxonomy' &&
    isHubBrowseOnlyQuery(normalized, withoutIntent, matchedPhrase, hadIntent)
  ) {
    return { searchText: '', tokens: [] };
  }

  let remainder = withoutIntent;
  if (opts.categorySource === 'taxonomy' && matchedPhrase) {
    remainder = removePhraseFromQuery(withoutIntent, matchedPhrase);
  }

  let tokens: string[];
  if (remainder) {
    tokens = filterSearchTokens(tokenize(remainder), opts);
  } else if (
    opts.categorySource === 'taxonomy' &&
    matchedPhrase &&
    withoutIntent === matchedPhrase
  ) {
    tokens = filterSearchTokens(tokenize(matchedPhrase), opts);
  } else {
    tokens = filterSearchTokens(tokenize(withoutIntent), opts);
  }

  return {
    searchText: tokens.join(' '),
    tokens,
  };
}
