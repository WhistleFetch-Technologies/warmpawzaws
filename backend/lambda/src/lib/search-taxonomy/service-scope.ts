import { tokenizeQuery } from './normalize';

/** Hubs that must never drive Home/service search results. */
export const SERVICE_BLOCKED_HUBS = new Set(['shop', 'pharmacy']);

/** Product/ecommerce phrases — longest match checked first via sorted list at runtime. */
const ECOMMERCE_PRODUCT_PHRASES = [
  'grain free food',
  'prescription diet',
  'gps tracker',
  'pet clothes',
  'cat litter',
  'tick shampoo',
  'flea powder',
  'calcium syrup',
  'joint care',
  'ear cleaner',
  'dental care',
  'dog collar',
  'cat collars',
  'dog leash',
  'pet bed',
  'wet food',
  'dry food',
  'puppy food',
  'dog food',
  'cat food',
  'pet toys',
  'dog toys',
  'pet medicine',
  'skin care',
  'raincoat',
  'bandanas',
  'harness',
  'carrier',
  'biscuits',
  'treats',
  'bowls',
  'crate',
  'leash',
  'collar',
  'toys',
  'shoes',
  'supplements',
  'litter',
  'harness',
];

/** Service phrases that override product signals when both could match. */
const SERVICE_OVERRIDE_PHRASES = [
  'pet nutritionist',
  'diet plan',
  'weight management',
  'allergy diet',
  'senior dog nutrition',
  'cat nutrition',
  'at home nutrition',
  'homemade dog food',
  'raw diet',
  'tick treatment',
  'flea treatment',
  'emergency vet',
  '24 hour vet',
  'home vet visit',
  'online vet consultation',
  'pet blood test',
  'pet x-ray',
  'pet scan',
  'pet ambulance',
  'animal ambulance',
];

const SORTED_ECOMMERCE = [...ECOMMERCE_PRODUCT_PHRASES].sort((a, b) => b.length - a.length);
const SORTED_SERVICE_OVERRIDE = [...SERVICE_OVERRIDE_PHRASES].sort((a, b) => b.length - a.length);

const PET_TOKENS = new Set(['dog', 'cat', 'pet', 'puppy', 'kitten', 'animal']);

/** True when query is clearly a product purchase, not a service booking. */
export function isEcommerceOnlyQuery(normalized: string, tokens?: string[]): boolean {
  const q = (normalized || '').trim();
  if (!q) return false;

  for (const phrase of SORTED_SERVICE_OVERRIDE) {
    if (q.includes(phrase)) return false;
  }

  for (const phrase of SORTED_ECOMMERCE) {
    if (q === phrase || q.includes(phrase)) {
      return true;
    }
  }

  const t = tokens ?? tokenizeQuery(q);
  const tokenSet = new Set(t);

  if (tokenSet.has('food') && !hasNutritionServiceContext(q, t)) {
    return true;
  }

  if (
    (tokenSet.has('shampoo') || tokenSet.has('powder') || tokenSet.has('syrup')) &&
    !q.includes('treatment')
  ) {
    return true;
  }

  if (
    tokenSet.has('supplements') &&
    !tokenSet.has('nutritionist') &&
    !tokenSet.has('nutrition') &&
    !q.includes('diet plan') &&
    !q.includes('weight management')
  ) {
    return true;
  }

  return false;
}

function hasNutritionServiceContext(normalized: string, tokens: string[]): boolean {
  const tokenSet = new Set(tokens);
  if (
    tokenSet.has('nutritionist') ||
    tokenSet.has('overweight') ||
    normalized.includes('diet plan') ||
    normalized.includes('weight management') ||
    normalized.includes('allergy diet') ||
    normalized.includes('senior dog nutrition') ||
    normalized.includes('homemade dog food') ||
    normalized.includes('raw diet')
  ) {
    return true;
  }
  if (tokenSet.has('diet') && (tokenSet.has('plan') || hasPetToken(tokenSet))) {
    return true;
  }
  return false;
}

export function hasPetToken(tokenSet: Set<string>): boolean {
  for (const p of PET_TOKENS) {
    if (tokenSet.has(p)) return true;
  }
  return false;
}

export function isServiceHubSlug(hubSlug: string | null | undefined): boolean {
  const hub = String(hubSlug || '').trim().toLowerCase();
  if (!hub) return false;
  return !SERVICE_BLOCKED_HUBS.has(hub);
}
