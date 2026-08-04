import { inferHubSlugFromSearchQuery } from '@/lib/search-hub-category-filter';

/** Hub chip slug for nutrition browse in /search. */
export function isNutritionHub(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  return c === 'nutritionist' || c === 'nutrition' || c === 'wellness';
}

/** Hub chip slug for training browse in /search. */
export function isTrainingHub(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  return c === 'training' || c === 'trainer' || c === 'trainers';
}

/** Hub chip slug for vet browse in /search. */
export function isVetHub(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  return c === 'vet' || c === 'veterinary' || c === 'veterinarian';
}

/** Hub chip slug for grooming browse in /search. */
export function isGroomingHub(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  return c === 'grooming' || c === 'groomer' || c === 'groomers';
}

/** Hub chip slug for boarding browse in /search. */
export function isBoardingHub(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  return c === 'boarding' || c === 'boarder' || c === 'kennel';
}

/** Hub chip slug for walker browse in /search. */
export function isWalkerHub(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  return c === 'walker' || c === 'walkers' || c === 'dog_walker';
}

/** Hub chip slug for pet sitting browse in /search. */
export function isSittingHub(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  return c === 'sitting' || c === 'sitter' || c === 'pet_sitter' || c === 'pet-sitter';
}

/** Hub chip slug for pet cafe browse in /search. */
export function isCafeHub(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  return c === 'cafe' || c === 'pet_cafe';
}

/** Hub chip slug for resort browse in /search. */
export function isResortHub(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  return c === 'resort' || c === 'pet_resort' || c === 'holiday';
}

/** Hub chip slug for pharmacy browse in /search. */
export function isPharmacyHub(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  return c === 'pharmacy' || c === 'pet_pharmacy';
}

/** Vendor/service row category tokens for nutrition vertical. */
export function isNutritionCategory(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  if (!c) return false;
  return (
    c.includes('nutrition') ||
    c.includes('nutri') ||
    c === 'wellness' ||
    c.includes('pet_nutritionist') ||
    c.includes('nutritionist')
  );
}

/** Vendor/service row category tokens for training vertical. */
export function isTrainingCategory(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  if (!c) return false;
  return (
    c.includes('train') ||
    c.includes('trainer') ||
    c === 'obedience' ||
    c.includes('gurukul')
  );
}

/** Vendor/service row category tokens for grooming vertical. */
export function isGroomingCategory(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  if (!c) return false;
  return (
    c.includes('groom') ||
    c === 'groomer_solo' ||
    c === 'groomer_center' ||
    c.includes('pet_groomer') ||
    c.includes('groomer')
  );
}

/** Vendor/service row category tokens for boarding vertical. */
export function isBoardingCategory(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  if (!c) return false;
  return (
    c.includes('board') ||
    c.includes('kennel') ||
    c.includes('daycare') ||
    c === 'pet_boarder' ||
    c === 'pet_boarding' ||
    c === 'boarding_solo' ||
    c === 'boarding_center'
  );
}

/** Vendor/service row category tokens for walker vertical. */
export function isWalkerCategory(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  if (!c) return false;
  return (
    c.includes('walk') ||
    c === 'pet_walker' ||
    c === 'walker_solo' ||
    c.includes('dog_walker')
  );
}

/** Vendor/service row category tokens for pet sitting vertical (not overnight boarding). */
export function isSittingCategory(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  if (!c) return false;
  if (isBoardingCategory(c) && !c.includes('sit')) return false;
  return (
    c.includes('sitt') ||
    c === 'pet_sitter' ||
    c === 'sitter' ||
    c === 'pet_sitting' ||
    c.includes('in_home_care') ||
    c.includes('in-home')
  );
}

/** Vendor/service row category tokens for pet cafe vertical. */
export function isCafeCategory(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  if (!c) return false;
  return c.includes('cafe') || c.includes('café') || c.includes('bistro');
}

/** Vendor/service row category tokens for resort vertical. */
export function isResortCategory(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  if (!c) return false;
  return c.includes('resort') || c.includes('holiday') || c.includes('vacation');
}

/** Vendor/service row category tokens for pharmacy vertical. */
export function isPharmacyCategory(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  if (!c) return false;
  return (
    c.includes('pharma') ||
    c.includes('medicine') ||
    c.includes('chemist') ||
    c.includes('dispens')
  );
}

const GENERIC_VENDOR_CATEGORIES = new Set(['', 'general', 'all', 'other', 'misc', 'default']);

export function isGenericVendorCategory(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  return GENERIC_VENDOR_CATEGORIES.has(c);
}

function resolveActiveHubChip(activeHubChip: string, searchQuery?: string): string {
  const hub = (activeHubChip || '').trim().toLowerCase();
  if (hub) return hub;
  const q = (searchQuery || '').trim();
  if (!q) return '';
  return inferHubSlugFromSearchQuery(q) || '';
}

/**
 * When the API returns a generic catalog label (e.g. "general"), use the active hub chip
 * or keyword-inferred hub so booking/details routing matches Services flows.
 */
export function resolveEffectiveSearchCategory(
  vendorCategory: string,
  activeHubChip: string,
  searchQuery?: string
): string {
  const hub = resolveActiveHubChip(activeHubChip, searchQuery);
  const vendor = (vendorCategory || '').trim().toLowerCase();

  if (hub && (isGenericVendorCategory(vendor) || !vendor)) {
    return hub;
  }

  if (!hub && isGenericVendorCategory(vendor)) {
    return vendorCategory || 'vet';
  }

  return vendorCategory || hub || 'vet';
}

export function isNutritionVendorResult(result: {
  category?: string;
  name?: string;
}): boolean {
  if (isNutritionCategory(result.category)) return true;
  const n = (result.name || '').toLowerCase();
  return n.includes('nutritionist') || n.includes('nutrition');
}

export function isTrainingVendorResult(result: {
  category?: string;
  name?: string;
}): boolean {
  if (isTrainingCategory(result.category)) return true;
  const n = (result.name || '').toLowerCase();
  return n.includes('trainer') || n.includes('training') || n.includes('gurukul');
}

export function isGroomingVendorResult(result: {
  category?: string;
  name?: string;
}): boolean {
  if (isGroomingCategory(result.category)) return true;
  const n = (result.name || '').toLowerCase();
  return n.includes('groom') || n.includes('salon') || n.includes('spa');
}

export function isBoardingVendorResult(result: {
  category?: string;
  name?: string;
}): boolean {
  if (isSittingCategory(result.category)) return false;
  if (isBoardingCategory(result.category)) return true;
  const n = (result.name || '').toLowerCase();
  return (
    n.includes('boarding') ||
    n.includes('kennel') ||
    n.includes('daycare') ||
    n.includes('paws')
  );
}

export function isWalkerVendorResult(result: {
  category?: string;
  name?: string;
}): boolean {
  if (isWalkerCategory(result.category)) return true;
  const n = (result.name || '').toLowerCase();
  return (
    n.includes('walker') ||
    n.includes('dog walk') ||
    n.includes('pet walk') ||
    n.includes('walking')
  );
}

export function isSittingVendorResult(result: {
  category?: string;
  name?: string;
}): boolean {
  if (isSittingCategory(result.category)) return true;
  const n = (result.name || '').toLowerCase();
  return (
    n.includes('sitter') ||
    n.includes('sitting') ||
    n.includes('in-home care') ||
    n.includes('pet sit')
  );
}

export function isVetVendorResult(result: {
  category?: string;
  name?: string;
}): boolean {
  if (isVetLikeCategory(result.category)) return true;
  const n = (result.name || '').toLowerCase();
  return (
    n.includes('vet') ||
    n.includes('veterinar') ||
    n.includes('clinic') ||
    n.includes('animal hosp') ||
    n.includes('pet hosp')
  );
}

export function isVetLikeCategory(category: string | null | undefined): boolean {
  const c = (category || '').trim().toLowerCase();
  if (!c) return false;
  if (isNutritionCategory(c)) return false;
  if (isTrainingCategory(c)) return false;
  if (isGroomingCategory(c)) return false;
  if (isBoardingCategory(c)) return false;
  if (isWalkerCategory(c)) return false;
  if (isSittingCategory(c)) return false;
  if (isCafeCategory(c)) return false;
  if (isResortCategory(c)) return false;
  if (isPharmacyCategory(c)) return false;
  return c.includes('vet') || c.includes('veterinar') || c.includes('clinic') || c.includes('medical');
}
