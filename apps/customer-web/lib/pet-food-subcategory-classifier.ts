/**
 * Pet Food subcategory keyword rules — keep in sync with
 * backend/lambda/src/utils/pet-food-subcategory-classifier.ts
 *
 * Used on the shop page when products are still tagged on parent "Pet Food".
 */

import type { ShopCategory } from '@/components/shop/shop-types';

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

const PET_FOOD_SUBCATEGORY_REGEX: Readonly<Record<PetFoodSubcategoryName, RegExp>> = {
  'Pet Treats':
    /\b(treat|treats|chew|chews|munchies|munchy|bone|bones|snack|snacks|biscuit|biscuits|jerky|stick|sticks|kabab|kebab|tukada)\b/i,
  'Wet Pet Food':
    /\b(wet|gravy|chunks in gravy|in gravy|canned|pouch|pouches|moist|pate|paté|broth|stew)\b/i,
  'Dry Pet Food': /\b(dry|kibble|kibbles|pellets|crunchy)\b/i,
  'Therapeutic Food':
    /\b(therapeutic|prescription diet|vet diet|prescription|renal|kidney|urinary|digestive|gastrointestinal|hypoallergenic|hydrolyzed|recovery|hepatic|cardiac)\b/i,
  'Puppy Food': /\b(puppy|puppies|kitten|kittens|junior)\b/i,
  'Adult Food': /\b(adult|senior|mature|7\+ years|1\+ year|1\+ years)\b/i,
};

export const PET_FOOD_CATEGORY_NAME = 'Pet Food';

export function isPetFoodSubcategoryName(name: string): name is PetFoodSubcategoryName {
  return PET_FOOD_SUBCATEGORY_NAME_SET.has(String(name ?? '').trim());
}

export function classifyPetFoodSubcategory(
  name: unknown,
  description?: unknown
): PetFoodSubcategoryName | null {
  const text = `${String(name ?? '').trim()} ${String(description ?? '').trim()}`.trim();
  if (!text || /\b(cat litter|litter tray|litter box|litter mat)\b/i.test(text)) return null;

  for (const subName of PET_FOOD_SUBCATEGORY_NAMES) {
    if (PET_FOOD_SUBCATEGORY_REGEX[subName].test(text)) return subName;
  }
  return null;
}

/** Map selected chip id → parent API category + optional Pet Food subcategory filter. */
export function resolvePetFoodSubcategoryProductQuery(
  selectedCategoryId: string,
  categories: ShopCategory[]
): { apiCategoryId: string; subcategoryName: PetFoodSubcategoryName | null } {
  if (!selectedCategoryId) {
    return { apiCategoryId: '', subcategoryName: null };
  }

  const cat = categories.find((c) => c.id === selectedCategoryId);
  if (!cat || !isPetFoodSubcategoryName(cat.name)) {
    return { apiCategoryId: selectedCategoryId, subcategoryName: null };
  }

  const petFoodParent = categories.find(
    (c) => c.name === PET_FOOD_CATEGORY_NAME && !c.parent_category_id
  );
  const parentId = cat.parent_category_id || petFoodParent?.id || '';

  return {
    apiCategoryId: parentId || selectedCategoryId,
    subcategoryName: cat.name,
  };
}

export function productMatchesPetFoodSubcategory(
  product: { name?: string; description?: string },
  subcategoryName: PetFoodSubcategoryName
): boolean {
  return classifyPetFoodSubcategory(product.name, product.description) === subcategoryName;
}
