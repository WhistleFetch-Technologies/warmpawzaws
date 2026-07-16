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
  pet_sitter: 'sitter',
  pet_sitting: 'sitter',
  sitter: 'sitter',
  sitting: 'sitter',
  nutrition: 'wellness',
  behavioral: 'behavioral',
  behaviour: 'behavioral',
};

export const BOARDING_FAMILY_SPEC_CATEGORY_KEYS = new Set([
  'boarding',
  'pet_boarding',
  'pet_boarder',
  'pet_daycare',
]);

export const SITTER_FAMILY_SPEC_CATEGORY_KEYS = new Set([
  'sitter',
  'pet_sitter',
  'pet_sitting',
  'sitting',
]);

const SITTER_ROLE_KEYS = new Set(['sitter', 'pet_sitter']);
const BOARDING_ROLE_KEYS = new Set([
  'boarding',
  'pet_boarder',
  'pet_daycare',
  'pet_boarding',
  'boarding_solo',
  'boarding_center',
]);

/** specialization_master rows for in-home sitting (stored under category_id boarding in prod). */
const SITTER_SPEC_ID_KEYS = new Set([
  'overnight_sitting',
  'day_visits',
  'day_sitting',
  'extended_home',
  'drop_in',
  'drop_in_visits',
  'in_home_sitting',
  'pet_sitting',
  'house_sitting',
]);

const BOARDING_SPEC_ID_KEYS = new Set([
  'daycare',
  'short_stay',
  'long_stay',
  'luxury_boarding',
  'medical_boarding',
  'overnight_boarding',
  'weekend_stay',
]);

export type SpecializationMasterRow = {
  specialization_id?: string | null;
  name?: string | null;
  display_name?: string | null;
  category_id?: string | null;
  applicable_roles?: string[] | null;
};

export function normalizeCatalogCategoryKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

function normalizeSpecId(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

function rowRoles(row: SpecializationMasterRow): string[] {
  if (!Array.isArray(row.applicable_roles)) return [];
  return row.applicable_roles.map((r) => normalizeCatalogCategoryKey(String(r)));
}

function rolesIncludeAny(roles: string[], keys: Set<string>): boolean {
  return roles.some((r) => keys.has(r));
}

function specIdLooksLikeSitter(specId: string): boolean {
  if (!specId) return false;
  if (SITTER_SPEC_ID_KEYS.has(specId)) return true;
  if (specId.startsWith('sit_')) return true;
  if (specId.includes('sitting') && !specId.includes('boarding')) return true;
  if (/^(day_visit|drop_in|extended_home|overnight_sit)/.test(specId)) return true;
  return false;
}

function specIdLooksLikeBoarding(specId: string): boolean {
  if (!specId) return false;
  if (BOARDING_SPEC_ID_KEYS.has(specId)) return true;
  if (specId.startsWith('board_')) return true;
  if (specId.includes('daycare')) return true;
  if (specId.includes('boarding') && !specId.includes('sitting')) return true;
  return false;
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
    SITTER_FAMILY_SPEC_CATEGORY_KEYS.has(key) ||
    key.includes('pet_sit') ||
    ['pet_sitter', 'pet_sitting', 'sitter', 'sitting'].includes(key)
  ) {
    slugs.add('sitter');
  }
  if (
    BOARDING_FAMILY_SPEC_CATEGORY_KEYS.has(key) ||
    ['pet_boarder', 'pet_daycare', 'pet_boarding', 'boarding'].includes(key)
  ) {
    slugs.add('boarding');
  }

  return [...slugs].filter(Boolean);
}

/**
 * DB query slugs — sitter catalogue categories still store rows under category_id boarding.
 */
export function expandSpecCategorySlugsForDbQuery(rawSlug: string): string[] {
  const slugs = expandSpecCategorySlugs(rawSlug).map(normalizeCatalogCategoryKey);
  const unique = new Set(slugs);
  if (isSitterFamilySpecCategory([...unique])) {
    unique.add('boarding');
    unique.add('sitter');
  }
  return [...unique];
}

export function isBoardingFamilySpecCategory(slugs: string[]): boolean {
  return slugs.some((s) => BOARDING_FAMILY_SPEC_CATEGORY_KEYS.has(normalizeCatalogCategoryKey(s)));
}

export function isSitterFamilySpecCategory(slugs: string[]): boolean {
  return slugs.some((s) => SITTER_FAMILY_SPEC_CATEGORY_KEYS.has(normalizeCatalogCategoryKey(s)));
}

export function isSitterSpecializationRow(row: SpecializationMasterRow): boolean {
  const specId = normalizeSpecId(row.specialization_id);
  const roles = rowRoles(row);
  const hasSitterRole = rolesIncludeAny(roles, SITTER_ROLE_KEYS);
  const hasBoardingRole = rolesIncludeAny(roles, BOARDING_ROLE_KEYS);

  if (specIdLooksLikeSitter(specId)) return true;
  if (hasSitterRole && !hasBoardingRole) return true;
  if (hasSitterRole && hasBoardingRole && specIdLooksLikeSitter(specId)) return true;

  const label = `${row.display_name || ''} ${row.name || ''}`.toLowerCase();
  if (/pet\s*sitt|in[-\s]?home\s*sitt|overnight\s*sitt|drop[-\s]?in/.test(label)) return true;

  return false;
}

export function isBoardingSpecializationRow(row: SpecializationMasterRow): boolean {
  const specId = normalizeSpecId(row.specialization_id);
  const roles = rowRoles(row);

  if (isSitterSpecializationRow(row)) return false;
  if (specIdLooksLikeBoarding(specId)) return true;
  if (rolesIncludeAny(roles, BOARDING_ROLE_KEYS)) return true;

  const label = `${row.display_name || ''} ${row.name || ''}`.toLowerCase();
  if (/board|daycare|day\s*care|kennel|hotel\s*stay/.test(label) && !/sitt/.test(label)) return true;

  return false;
}

/** Split boarding-category rows between Pet Boarding vs Pet Sitting vendor catalogue picks. */
export function filterSpecializationMasterRowsForVendorCategory(
  rows: SpecializationMasterRow[],
  normalizedCategorySlugs: string[]
): SpecializationMasterRow[] {
  const sitterPick = isSitterFamilySpecCategory(normalizedCategorySlugs);
  const boardingPick = isBoardingFamilySpecCategory(normalizedCategorySlugs);

  if (sitterPick && !boardingPick) {
    return rows.filter(isSitterSpecializationRow);
  }
  if (boardingPick && !sitterPick) {
    return rows.filter(isBoardingSpecializationRow);
  }
  return rows;
}

/** Boarding/sitter catalogue categories use category-only filtering (roles vary in DB). */
export function roleNamesForSpecCategoryQuery(
  normalizedCategorySlugs: string[],
  expandedRoleNames: string[]
): string[] {
  if (isBoardingFamilySpecCategory(normalizedCategorySlugs) || isSitterFamilySpecCategory(normalizedCategorySlugs)) {
    return [];
  }
  return expandedRoleNames;
}

/**
 * Validate specialization_master rows against a service_categories.category_id slug.
 * Must stay in sync with GET /vendor/specializations/by-category (DB slug expansion +
 * sitter vs boarding row filter). Pet Sitting catalogue rows often store specs under
 * category_id `boarding` in specialization_master.
 */
export function areSpecializationRowsValidForCatalogSlug(
  rows: SpecializationMasterRow[],
  catalogSlug: string,
  requiredSpecIds: string[]
): boolean {
  if (!requiredSpecIds.length) return true;

  const vendorPickSlugs = expandSpecCategorySlugs(catalogSlug).map(normalizeCatalogCategoryKey);
  const dbQuerySlugSet = new Set(
    expandSpecCategorySlugsForDbQuery(catalogSlug).map(normalizeCatalogCategoryKey)
  );

  const matchingCategory = (rows || []).filter((r) =>
    dbQuerySlugSet.has(normalizeCatalogCategoryKey(String(r.category_id || '')))
  );
  const allowed = filterSpecializationMasterRowsForVendorCategory(matchingCategory, vendorPickSlugs);
  const okIds = new Set(allowed.map((r) => String(r.specialization_id)));

  return requiredSpecIds.every((sid) => okIds.has(String(sid)));
}
