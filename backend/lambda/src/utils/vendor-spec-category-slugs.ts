/** Map service_catalog / service_categories slug to specialization_master.category_id */
export const CATEGORY_TO_SPEC: Record<string, string> = {
  veterinary: 'veterinary',
  grooming: 'grooming',
  training: 'training',
  walking: 'walking',
  diagnostic: 'veterinary',
  diagnostics: 'veterinary',
  pharmacy: 'veterinary',
  emergency: 'veterinary',
  wellness: 'wellness',
  specialty: 'veterinary',
  boarding: 'boarding',
  pet_boarding: 'boarding',
  pet_boarder: 'boarding',
  pet_daycare: 'boarding',
  pet_sitter: 'boarding',
  pet_sitting: 'boarding',
  sitter: 'boarding',
  sitting: 'boarding',
  nutrition: 'wellness',
  behavioral: 'behavioral',
  behaviour: 'behavioral',
};

export const BOARDING_FAMILY_SPEC_CATEGORY_KEYS = new Set([
  'boarding',
  'pet_boarding',
  'pet_boarder',
  'pet_daycare',
  'pet_sitter',
  'pet_sitting',
  'sitter',
  'sitting',
]);

export function normalizeCatalogCategoryKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

/** Expand catalogue category slug(s) to specialization_master.category_id values. */
export function expandSpecCategorySlugs(rawSlug: string): string[] {
  const key = normalizeCatalogCategoryKey(rawSlug);
  const mapped =
    CATEGORY_TO_SPEC[key] ||
    CATEGORY_TO_SPEC[String(rawSlug || '').trim().toLowerCase()] ||
    key;
  const slugs = new Set<string>([key, mapped, String(rawSlug || '').trim().toLowerCase()]);
  if (
    ['pet_sitter', 'pet_sitting', 'sitter', 'sitting'].includes(key) ||
    key.includes('pet_sit')
  ) {
    slugs.add('boarding');
  }
  if (['pet_boarder', 'pet_daycare', 'pet_boarding', 'boarding'].includes(key)) {
    slugs.add('boarding');
  }
  return [...slugs].filter(Boolean);
}

export function isBoardingFamilySpecCategory(slugs: string[]): boolean {
  return slugs.some((s) => BOARDING_FAMILY_SPEC_CATEGORY_KEYS.has(normalizeCatalogCategoryKey(s)));
}

/** Category-only filter for boarding/sitting — specs are shared across boarding roles. */
export function roleNamesForSpecCategoryQuery(
  normalizedCategorySlugs: string[],
  expandedRoleNames: string[]
): string[] {
  if (isBoardingFamilySpecCategory(normalizedCategorySlugs)) {
    return [];
  }
  return expandedRoleNames;
}
