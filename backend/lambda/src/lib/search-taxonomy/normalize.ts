const PLURAL_TO_SINGULAR: Record<string, string> = {
  dogs: 'dog',
  cats: 'cat',
  puppies: 'puppy',
  kittens: 'kitten',
  pets: 'pet',
  vets: 'vet',
  walkers: 'walker',
  trainers: 'trainer',
  groomers: 'groomer',
  haircuts: 'haircut',
};

const TYPO_TO_CANONICAL: Record<string, string> = {
  doctur: 'doctor',
  docter: 'doctor',
  doctar: 'doctor',
  veterinar: 'veterinarian',
  groomin: 'grooming',
  groomer: 'grooming',
  nutriton: 'nutrition',
  nutritionist: 'nutritionist',
  behaviourist: 'behaviourist',
  behaviorist: 'behaviourist',
  agression: 'aggression',
  agressive: 'aggressive',
  vaccinaton: 'vaccination',
  boarding: 'boarding',
};

const PHRASE_NORMALIZATIONS: [RegExp, string][] = [
  [/\bhaircuts?\b/g, 'hair cut'],
  [/\bnail trimming\b/g, 'nail trim'],
  [/\b24\s*hours?\b/g, '24 hour'],
  [/\bx\s*ray\b/g, 'x-ray'],
  [/\bxray\b/g, 'x-ray'],
];

function normalizeToken(token: string): string {
  let t = token.trim().toLowerCase();
  if (!t) return '';
  if (PLURAL_TO_SINGULAR[t]) t = PLURAL_TO_SINGULAR[t];
  if (TYPO_TO_CANONICAL[t]) t = TYPO_TO_CANONICAL[t];
  return t;
}

/** Full Phase 2 query normalization for intent + taxonomy matching. */
export function normalizeSearchQuery(raw: string | null | undefined): string {
  let s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^\w\s-&/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of PHRASE_NORMALIZATIONS) {
    s = s.replace(pattern, replacement);
  }

  const tokens = s.split(/\s+/).map(normalizeToken).filter(Boolean);
  return tokens.join(' ');
}

/** Collapse whitespace and lowercase for phrase matching (alias of normalizeSearchQuery). */
export function normalizeSearchPhrase(raw: string | null | undefined): string {
  return normalizeSearchQuery(raw);
}

/** Tokenize a normalized query string. */
export function tokenizeQuery(normalized: string | null | undefined, maxTokens = 24): string[] {
  return String(normalized ?? '')
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, maxTokens);
}

/** Stable slug from spreadsheet Category column (logic key). */
export function slugifyCategoryLabel(label: string | null | undefined): string {
  return normalizeSearchQuery(label)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export { normalizeToken };
