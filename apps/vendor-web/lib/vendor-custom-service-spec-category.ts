export type CatalogCategoryRow = {
  id?: string;
  name?: string;
  category_id?: string;
};

/** Display / legacy names → specialization_master / service_categories.category_id */
const SPEC_CATEGORY_ALIASES: Record<string, string> = {
  // Walker — prod catalogue name is "Dog Walker" (category_id=walking)
  walking: 'walking',
  walker: 'walking',
  dog_walker: 'walking',
  pet_walker: 'walking',
  dog_walking: 'walking',
  pet_walking: 'walking',
  // Legacy custom-service default for trainer_walker roles (never existed in catalogue)
  training_and_walking: 'walking',
  training_walking: 'walking',
  // Trainer
  training: 'training',
  trainer: 'training',
  pet_trainer: 'training',
  training_behaviorist: 'training',
  training_and_behaviorist: 'training',
};

function normalizeKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Preferred catalogue slug for a vendor role (used when auto-selecting category).
 */
export function preferredSpecCategorySlugForRole(roleNameOrId?: string | null): string | null {
  const key = normalizeKey(roleNameOrId || '');
  if (!key) return null;
  if (
    key.includes('walker') ||
    key === 'walking' ||
    key === 'dog_walker' ||
    key === 'pet_walker' ||
    key === 'walker_solo'
  ) {
    return 'walking';
  }
  if (key.includes('trainer') || key === 'training' || key.includes('obedience')) {
    return 'training';
  }
  if (key.includes('sitter') || key === 'sitting') {
    return 'sitter';
  }
  if (key.includes('groom')) {
    return 'grooming';
  }
  if (key.includes('vet') || key.includes('clinic')) {
    return 'veterinary';
  }
  if (key.includes('board') || key.includes('daycare')) {
    return 'boarding';
  }
  return null;
}

/**
 * Pick the best platform category row for a role (UUID + slug).
 */
export function findPreferredCatalogCategoryForRole(
  catalogCategories: CatalogCategoryRow[],
  roleNameOrId?: string | null
): CatalogCategoryRow | null {
  const preferred = preferredSpecCategorySlugForRole(roleNameOrId);
  if (!preferred || !catalogCategories?.length) return null;

  const preferredKey = normalizeKey(preferred);
  const bySlug = catalogCategories.find((c) => normalizeKey(String(c.category_id || '')) === preferredKey);
  if (bySlug) return bySlug;

  // Prod walking category display name is "Dog Walker"
  const byAliasName = catalogCategories.find((c) => {
    const nameKey = normalizeKey(String(c.name || ''));
    const mapped = SPEC_CATEGORY_ALIASES[nameKey];
    return mapped === preferredKey || nameKey === preferredKey;
  });
  return byAliasName || null;
}

/**
 * Resolve catalogue key for GET /vendor/specializations/by-category.
 * Prefers platform UUID, then category_id slug, then normalized display name.
 */
export function resolveVendorCustomServiceSpecCategoryId(input: {
  platformCategoryId?: string | null;
  categoryName?: string | null;
  catalogCategories?: CatalogCategoryRow[];
  /** When set, maps ambiguous legacy defaults (e.g. Training & Walking) to role family. */
  vendorRoleName?: string | null;
}): string | null {
  const platformId = String(input.platformCategoryId ?? '').trim();
  if (platformId) return platformId;

  const categoryName = String(input.categoryName ?? '').trim();
  if (!categoryName || categoryName === 'other') return null;

  const selNorm = categoryName.toLowerCase();
  const selKey = normalizeKey(categoryName);

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryName)) {
    return categoryName;
  }

  const catalogCategories = input.catalogCategories ?? [];
  const row = catalogCategories.find((c) => {
    const name = String(c.name || '').toLowerCase();
    const slug = normalizeKey(String(c.category_id || ''));
    const idKey = normalizeKey(String(c.id || ''));
    const nameKey = normalizeKey(String(c.name || ''));
    return (
      idKey === selKey ||
      name === selNorm ||
      slug === selKey ||
      nameKey === selKey
    );
  });

  const categorySlug = row?.category_id != null ? String(row.category_id).trim() : '';
  if (categorySlug) return categorySlug;

  const idStr = row?.id != null ? String(row.id).trim() : '';
  if (idStr) return idStr;

  // Ambiguous legacy default used for both trainers and walkers
  if (selKey === 'training_and_walking' || selKey === 'training_walking') {
    const rolePreferred = preferredSpecCategorySlugForRole(input.vendorRoleName);
    if (rolePreferred) return rolePreferred;
    return 'walking';
  }

  const aliased = SPEC_CATEGORY_ALIASES[selKey];
  if (aliased) return aliased;

  return selKey || null;
}
