/**
 * Classify Pet Food catalog rows into subcategories from product name + description.
 * Used when products are still tagged on parent "Pet Food" instead of a subcategory.
 *
 * Priority (first match wins): Treats → Wet → Dry → Therapeutic → Puppy → Adult
 */

export const PET_FOOD_SUBCATEGORY_NAMES = [
  'Pet Treats',
  'Wet Pet Food',
  'Dry Pet Food',
  'Therapeutic Food',
  'Puppy Food',
  'Adult Food',
] as const;

export type PetFoodSubcategoryName = (typeof PET_FOOD_SUBCATEGORY_NAMES)[number];

const PET_FOOD_SUBCATEGORY_NAME_SET = new Set<string>(PET_FOOD_SUBCATEGORY_NAMES);

/** PostgreSQL regex (case-insensitive) — order defines classifier priority. */
export const PET_FOOD_SUBCATEGORY_REGEX: Readonly<
  Record<PetFoodSubcategoryName, string>
> = {
  'Pet Treats':
    '(treat|treats|chew|chews|munchies|munchy|bone|bones|snack|snacks|biscuit|biscuits|jerky|stick|sticks|kabab|kebab|tukada)',
  'Wet Pet Food':
    '(wet|gravy|chunks in gravy|in gravy|canned|pouch|pouches|moist|pate|pat[eé]|broth|stew)',
  'Dry Pet Food': '(dry|kibble|kibbles|pellets|crunchy)',
  'Therapeutic Food':
    '(therapeutic|prescription|renal|kidney|urinary|digestive|gastrointestinal|hypoallergenic|hydrolyzed|veterinary|clinical|recovery|hepatic|cardiac|vet diet|prescription diet)',
  'Puppy Food': '(puppy|puppies|kitten|kittens|junior)',
  'Adult Food': '(adult|senior|mature|7\\+ years|1\\+ year|1\\+ years)',
};

export function isPetFoodSubcategoryName(name: string): name is PetFoodSubcategoryName {
  return PET_FOOD_SUBCATEGORY_NAME_SET.has(String(name ?? '').trim());
}

export function productTextBlob(name: unknown, description?: unknown): string {
  return `${String(name ?? '').trim()} ${String(description ?? '').trim()}`.trim().toLowerCase();
}

/** Classify combined product text into a Pet Food subcategory name, or null if no rule matches. */
export function classifyPetFoodSubcategory(
  name: unknown,
  description?: unknown
): PetFoodSubcategoryName | null {
  const text = productTextBlob(name, description);
  if (!text) return null;

  for (const subName of PET_FOOD_SUBCATEGORY_NAMES) {
    const re = new RegExp(PET_FOOD_SUBCATEGORY_REGEX[subName], 'i');
    if (re.test(text)) return subName;
  }
  return null;
}

/** SQL expression for combined lowercase product name + description. */
export function petFoodProductTextSql(
  nameColumn = 'p.name',
  descriptionColumn = 'COALESCE(p.description, \'\')'
): string {
  return `LOWER(TRIM(COALESCE(${nameColumn}, '') || ' ' || ${descriptionColumn}))`;
}

/**
 * SQL boolean expression: parent-tagged product matches a specific Pet Food subcategory
 * using the same priority order as {@link classifyPetFoodSubcategory}.
 */
export function petFoodSubcategoryParentProductMatchSql(
  subcategoryName: string,
  nameColumn = 'p.name',
  descriptionColumn = 'COALESCE(p.description, \'\')'
): string | null {
  if (!isPetFoodSubcategoryName(subcategoryName)) return null;

  const text = petFoodProductTextSql(nameColumn, descriptionColumn);
  const idx = PET_FOOD_SUBCATEGORY_NAMES.indexOf(subcategoryName);
  if (idx < 0) return null;

  const higherPriority = PET_FOOD_SUBCATEGORY_NAMES.slice(0, idx);
  const excludeHigher = higherPriority
    .map((name) => `${text} !~ '${PET_FOOD_SUBCATEGORY_REGEX[name]}'`)
    .join(' AND ');

  const matchSelf = `${text} ~ '${PET_FOOD_SUBCATEGORY_REGEX[subcategoryName]}'`;
  return excludeHigher ? `(${excludeHigher} AND ${matchSelf})` : matchSelf;
}
