import { slugifyCategoryLabel, normalizeSearchPhrase } from './normalize';

/**
 * Maps spreadsheet Category labels (and slugs) → discovery hub_slug.
 * hub_slug is never read from the spreadsheet.
 */
const CATEGORY_LABEL_TO_HUB: Record<string, string> = {
  veterinary_and_healthcare: 'vet',
  veterinary_healthcare: 'vet',
  grooming: 'grooming',
  walking_and_sitting: 'walker',
  walking_sitting: 'walker',
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
  lifestyle_and_discovery: 'photography',
  lifestyle_discovery: 'photography',
  location_and_convenience: 'vet',
  location_convenience: 'vet',
  insurance: 'insurance',
  adoption: 'adoption',
};

/** Display-name aliases (normalized phrase keys). */
const DISPLAY_NAME_TO_HUB: Record<string, string> = {
  'veterinary & healthcare': 'vet',
  'veterinary and healthcare': 'vet',
  grooming: 'grooming',
  'walking & sitting': 'walker',
  'walking and sitting': 'walker',
  'boarding & daycare': 'boarding',
  'boarding and daycare': 'boarding',
  'training & behaviour': 'training',
  'training & behavior': 'training',
  'training and behaviour': 'training',
  'training and behavior': 'training',
  'nutrition & wellness': 'nutritionist',
  'nutrition and wellness': 'nutritionist',
  'ecommerce – food': 'shop',
  'ecommerce - food': 'shop',
  'ecommerce food': 'shop',
  'ecommerce – accessories': 'shop',
  'ecommerce - accessories': 'shop',
  'ecommerce accessories': 'shop',
  'ecommerce – health products': 'pharmacy',
  'ecommerce - health products': 'pharmacy',
  'ecommerce health products': 'pharmacy',
  'lifestyle & discovery': 'photography',
  'lifestyle and discovery': 'photography',
  'location & convenience': 'vet',
  'location and convenience': 'vet',
  insurance: 'insurance',
  adoption: 'adoption',
};

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

export function resolveHubSlugForCategory(
  categoryDisplayName: string,
  categorySlug?: string
): string {
  const slugKey = (categorySlug || slugifyCategoryLabel(categoryDisplayName)).trim();
  if (slugKey && CATEGORY_LABEL_TO_HUB[slugKey]) {
    return CATEGORY_LABEL_TO_HUB[slugKey];
  }

  const displayKey = normalizeSearchPhrase(categoryDisplayName);
  if (DISPLAY_NAME_TO_HUB[displayKey]) {
    return DISPLAY_NAME_TO_HUB[displayKey];
  }

  if (slugKey && VALID_HUB_SLUGS.has(slugKey)) {
    return slugKey;
  }

  throw new Error(
    `Unmapped taxonomy category "${categoryDisplayName}" (slug: ${slugKey}). ` +
      'Add mapping in hub-map.ts or fix spreadsheet Category label.'
  );
}

export function isValidHubSlug(hub: string): boolean {
  return VALID_HUB_SLUGS.has(String(hub || '').trim().toLowerCase());
}

export { slugifyCategoryLabel };
