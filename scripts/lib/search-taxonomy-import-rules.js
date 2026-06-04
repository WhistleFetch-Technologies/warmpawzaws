/**
 * Approved taxonomy import resolution (Phase 1).
 * Shared by validate + import scripts. hub_slug is never read from the spreadsheet.
 */

const VALID_HUB_SLUGS = new Set([
  'vet',
  'grooming',
  'training',
  'boarding',
  'walker',
  'nutritionist',
  'shop',
  'pharmacy',
  'insurance',
  'adoption',
  'photography',
  'cafes',
  'resort',
  'pet-sitter',
  'ambulance',
  'breeder',
  'relocation',
  'holiday',
]);

/** Categories that must NOT use a single category-level hub. */
const MULTI_HUB_CATEGORY_SLUGS = new Set([
  'lifestyle_and_discovery',
  'lifestyle_discovery',
  'location_and_convenience',
  'location_convenience',
]);

/** Rule A: one hub per category (display + slug keys). */
const CATEGORY_LEVEL_HUB = {
  veterinary_and_healthcare: 'vet',
  veterinary_healthcare: 'vet',
  grooming: 'grooming',
  boarding_and_daycare: 'boarding',
  boarding_daycare: 'boarding',
  training_and_behaviour: 'training',
  training_and_behavior: 'training',
  training_behaviour: 'training',
  training_behavior: 'training',
  nutrition_and_wellness: 'nutritionist',
  nutrition_wellness: 'nutritionist',
  ecommerce_food: 'shop',
  ecommerce_accessories: 'shop',
  ecommerce_health_products: 'pharmacy',
  insurance: 'insurance',
};

const CATEGORY_DISPLAY_TO_SLUG = {
  'veterinary & healthcare': 'veterinary_and_healthcare',
  'veterinary and healthcare': 'veterinary_and_healthcare',
  grooming: 'grooming',
  'walking & sitting': 'walking_and_sitting',
  'walking and sitting': 'walking_and_sitting',
  'boarding & daycare': 'boarding_and_daycare',
  'boarding and daycare': 'boarding_and_daycare',
  'training & behaviour': 'training_and_behaviour',
  'training & behavior': 'training_and_behaviour',
  'training and behaviour': 'training_and_behaviour',
  'training and behavior': 'training_and_behaviour',
  'nutrition & wellness': 'nutrition_and_wellness',
  'nutrition and wellness': 'nutrition_and_wellness',
  'ecommerce – food': 'ecommerce_food',
  'ecommerce - food': 'ecommerce_food',
  'ecommerce food': 'ecommerce_food',
  'ecommerce – accessories': 'ecommerce_accessories',
  'ecommerce - accessories': 'ecommerce_accessories',
  'ecommerce accessories': 'ecommerce_accessories',
  'ecommerce – health products': 'ecommerce_health_products',
  'ecommerce - health products': 'ecommerce_health_products',
  'ecommerce health products': 'ecommerce_health_products',
  'lifestyle & discovery': 'lifestyle_and_discovery',
  'lifestyle and discovery': 'lifestyle_and_discovery',
  'location & convenience': 'location_and_convenience',
  'location and convenience': 'location_and_convenience',
  insurance: 'insurance',
  adoption: 'adoption',
};

/** Exact normalized keyword → hub (longest-match handled by sorting keys at resolve time). */
const KEYWORD_HUB = {
  // Lifestyle & Discovery
  'pet photography': 'photography',
  'pet resort': 'resort',
  'pet adoption': 'adoption',
  'pet friendly cafe': 'cafes',
  'pet breeder': 'breeder',
  'pet relocation': 'relocation',
  'pet travel': 'relocation',
  'pet holiday': 'holiday',
  // Walking & Sitting
  'dog walker': 'walker',
  'daily dog walk': 'walker',
  'puppy walk': 'walker',
  'pet sitter': 'pet-sitter',
  'cat sitter': 'pet-sitter',
  'pet nanny': 'pet-sitter',
  // Location & Convenience
  '24 hour vet': 'vet',
  'emergency vet': 'vet',
  'same day grooming': 'grooming',
  'pet ambulance': 'ambulance',
  'animal ambulance': 'ambulance',
  // Rule C3 — service-specific at-home (allowed)
  'at home vet': 'vet',
  'at home grooming': 'grooming',
  'at home training': 'training',
  'at home nutrition': 'nutritionist',
};

/** Subcategory slug → hub (multi-hub categories + walking overrides). */
const SUBCATEGORY_HUB = {
  // Lifestyle & Discovery (typical sheet subcategory labels)
  photography: 'photography',
  pet_photography: 'photography',
  resort: 'resort',
  pet_resort: 'resort',
  adoption: 'adoption',
  cafe: 'cafes',
  cafes: 'cafes',
  pet_cafe: 'cafes',
  breeder: 'breeder',
  relocation: 'relocation',
  travel: 'relocation',
  pet_travel: 'relocation',
  holiday: 'holiday',
  pet_holiday: 'holiday',
  // Location & Convenience
  emergency: 'vet',
  emergency_vet: 'vet',
  grooming: 'grooming',
  ambulance: 'ambulance',
  // Walking & Sitting
  walker: 'walker',
  dog_walker: 'walker',
  walking: 'walker',
  sitter: 'pet-sitter',
  pet_sitter: 'pet-sitter',
  pet_sitting: 'pet-sitter',
  sitting: 'pet-sitter',
};

/** Rule C3 — never import these normalized keywords. */
const BLOCKED_KEYWORDS = new Set([
  'at home service',
  'at home',
  'home service',
]);

const SORTED_KEYWORD_ENTRIES = Object.entries(KEYWORD_HUB).sort((a, b) => b[0].length - a[0].length);

function normalizePhrase(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function slugifyLabel(label) {
  return normalizePhrase(label)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveCategorySlug(categoryDisplayName) {
  const displayKey = normalizePhrase(categoryDisplayName);
  if (CATEGORY_DISPLAY_TO_SLUG[displayKey]) return CATEGORY_DISPLAY_TO_SLUG[displayKey];
  return slugifyLabel(categoryDisplayName);
}

function matchKeywordHub(keywordNormalized) {
  if (KEYWORD_HUB[keywordNormalized]) {
    return { hub: KEYWORD_HUB[keywordNormalized], via: 'keyword_exact' };
  }
  for (const [phrase, hub] of SORTED_KEYWORD_ENTRIES) {
    if (keywordNormalized.includes(phrase)) {
      return { hub, via: 'keyword_contains', matchedPhrase: phrase };
    }
  }
  return null;
}

/**
 * @returns {{ status: 'ok', hub: string, via: string, categorySlug: string, matchedPhrase?: string }
 *   | { status: 'skip', reason: string }
 *   | { status: 'unmapped', categorySlug: string }}
 */
function resolveTaxonomyRow({ category, subcategory, keyword }) {
  const categoryDisplay = String(category ?? '').trim();
  const keywordRaw = String(keyword ?? '').trim();
  const subRaw = subcategory != null && String(subcategory).trim() !== '' ? String(subcategory).trim() : null;

  if (!categoryDisplay) return { status: 'skip', reason: 'missing_category' };
  if (!keywordRaw) return { status: 'skip', reason: 'missing_keyword' };

  const keywordNormalized = normalizePhrase(keywordRaw);
  if (keywordNormalized.length < 2) {
    return { status: 'skip', reason: 'keyword_too_short' };
  }
  if (BLOCKED_KEYWORDS.has(keywordNormalized)) {
    return { status: 'skip', reason: 'blocked_generic_phrase' };
  }

  const categorySlug = resolveCategorySlug(categoryDisplay);

  const kwMatch = matchKeywordHub(keywordNormalized);
  if (kwMatch && VALID_HUB_SLUGS.has(kwMatch.hub)) {
    return { status: 'ok', hub: kwMatch.hub, via: kwMatch.via, categorySlug, matchedPhrase: kwMatch.matchedPhrase };
  }

  const subSlug = subRaw ? slugifyLabel(subRaw) : '';
  if (subSlug && SUBCATEGORY_HUB[subSlug] && VALID_HUB_SLUGS.has(SUBCATEGORY_HUB[subSlug])) {
    return { status: 'ok', hub: SUBCATEGORY_HUB[subSlug], via: 'subcategory', categorySlug };
  }

  if (MULTI_HUB_CATEGORY_SLUGS.has(categorySlug)) {
    return { status: 'unmapped', categorySlug };
  }

  if (categorySlug === 'walking_and_sitting' || categorySlug === 'walking_sitting') {
    return { status: 'ok', hub: 'walker', via: 'category_default_walking' };
  }

  if (CATEGORY_LEVEL_HUB[categorySlug]) {
    return { status: 'ok', hub: CATEGORY_LEVEL_HUB[categorySlug], via: 'category_level' };
  }

  const displaySlug = slugifyLabel(categoryDisplay);
  if (CATEGORY_LEVEL_HUB[displaySlug]) {
    return { status: 'ok', hub: CATEGORY_LEVEL_HUB[displaySlug], via: 'category_level' };
  }

  return { status: 'unmapped', categorySlug };
}

module.exports = {
  VALID_HUB_SLUGS,
  MULTI_HUB_CATEGORY_SLUGS,
  CATEGORY_LEVEL_HUB,
  KEYWORD_HUB,
  BLOCKED_KEYWORDS,
  normalizePhrase,
  slugifyLabel,
  resolveCategorySlug,
  resolveTaxonomyRow,
};
