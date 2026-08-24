import { inferHubSlugFromSearchQuery } from '@/lib/search-hub-category-filter';

const SEARCH_INTENT_TOKENS = new Set([
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

/** Filler words in natural-language hub queries — not used as vendor name filters. */
const SEARCH_QUALIFIER_NOISE_TOKENS = new Set([
  'a',
  'an',
  'the',
  'i',
  'my',
  'our',
  'your',
  'for',
  'to',
  'best',
  'good',
  'great',
  'top',
  'find',
  'need',
  'want',
  'looking',
  'please',
  'help',
  'some',
  'any',
  'recommend',
  'recommended',
]);

const HUB_ROUTING_TOKENS: Record<string, Set<string>> = {
  vet: new Set(['vet', 'vets', 'veterinary', 'clinic', 'clinics', 'hospital', 'hospitals']),
  nutritionist: new Set(['nutrition', 'nutritionist', 'diet', 'dietitian', 'wellness']),
  nutrition: new Set(['nutrition', 'nutritionist', 'diet', 'dietitian', 'wellness']),
  training: new Set([
    'train',
    'trainer',
    'trainers',
    'training',
    'obedience',
    'behaviorist',
    'behaviourist',
    'coach',
    'agility',
  ]),
  walker: new Set(['walk', 'walker', 'walking']),
  grooming: new Set(['groom', 'grooming', 'salon', 'spa', 'bath', 'haircut', 'trim', 'nail']),
  boarding: new Set(['board', 'boarding', 'kennel', 'daycare', 'hostel']),
  sitting: new Set(['sitter', 'sitting', 'sitters']),
};

function stripIntentPhrases(normalized: string): string {
  const phrases = ['near me', 'open now', 'right now', 'open today', 'same day', '24 hours', '24 hour'];
  let s = normalized;
  for (const phrase of phrases.sort((a, b) => b.length - a.length)) {
    if (s.includes(phrase)) s = s.split(phrase).join(' ');
  }
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Residual tokens for WAPPT vendor name filtering after hub inference.
 * Mirrors backend buildResidualSearchText enough for client-side parity on sentence queries.
 */
export function buildWapptVendorKeywordTokens(query: string, hubSlug: string): string[] {
  const normalized = stripIntentPhrases((query || '').trim().toLowerCase());
  if (!normalized) return [];

  const inferredHub = inferHubSlugFromSearchQuery(query);
  const taxonomyMatched =
    !!inferredHub &&
    (inferredHub === hubSlug ||
      (inferredHub === 'nutritionist' && hubSlug === 'nutrition') ||
      (inferredHub === 'nutrition' && hubSlug === 'nutritionist'));

  const routing = HUB_ROUTING_TOKENS[hubSlug] ?? HUB_ROUTING_TOKENS[inferredHub ?? ''];

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      if (PET_QUALIFIER_TOKENS.has(token)) return false;
      if (SEARCH_INTENT_TOKENS.has(token)) return false;
      if (taxonomyMatched && SEARCH_QUALIFIER_NOISE_TOKENS.has(token)) return false;
      if (taxonomyMatched && routing?.has(token)) return false;
      return true;
    });
}

/** Whether a WAPPT vendor row matches a keyword query for the loaded hub. */
export function wapptVendorMatchesKeyword(
  haystack: string,
  query: string | undefined,
  hubSlug: string,
): boolean {
  const q = (query || '').trim();
  if (!q) return true;

  const tokens = buildWapptVendorKeywordTokens(q, hubSlug);
  if (tokens.length === 0) return true;

  const hay = haystack.toLowerCase();
  return tokens.every((token) => hay.includes(token));
}
