/**
 * Static shop category tile images (customer public folder).
 * Matches admin catalog names; files live under /images/shop/categories/.
 */

const SHOP_CATEGORY_IMAGE_BY_SLUG: Record<string, string> = {
  'pet-food': '/images/shop/categories/pet-food.jpeg',
  'pet-accessories': '/images/shop/categories/pet-accessories.jpeg',
  'pet-toys': '/images/shop/categories/pet-toys.jpeg',
  'pet-grooming': '/images/shop/categories/pet-grooming.jpeg',
  'pet-health': '/images/shop/categories/pet-health.jpeg',
  'pet-beds-furniture': '/images/shop/categories/pet-beds-furniture.jpeg',
  'pet-beds-furnitures': '/images/shop/categories/pet-beds-furniture.jpeg',
  'pet-clothing': '/images/shop/categories/pet-clothing.jpeg',
  'pet-clothings': '/images/shop/categories/pet-clothing.jpeg',
  'pet-travel': '/images/shop/categories/pet-travel.jpeg',
  'pet-pharmacy': '/images/shop/categories/pet-pharmacy.jpeg',
  'pet-training': '/images/shop/categories/pet-training.jpeg',
};

export function slugifyShopCategoryName(nameOrSlug: string): string {
  return String(nameOrSlug ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Resolve static image URL for a shop category name or slug. */
export function getShopCategoryStaticImageUrl(nameOrSlug: string): string | undefined {
  const raw = String(nameOrSlug ?? '').trim();
  if (!raw) return undefined;

  const slug = slugifyShopCategoryName(raw);
  if (slug && SHOP_CATEGORY_IMAGE_BY_SLUG[slug]) {
    return SHOP_CATEGORY_IMAGE_BY_SLUG[slug];
  }

  // Plural/singular aliases from API names
  const aliases: Record<string, string> = {
    food: 'pet-food',
    foods: 'pet-food',
    accessories: 'pet-accessories',
    toys: 'pet-toys',
    grooming: 'pet-grooming',
    health: 'pet-health',
    clothing: 'pet-clothing',
    clothings: 'pet-clothing',
    travel: 'pet-travel',
    pharmacy: 'pet-pharmacy',
    training: 'pet-training',
  };
  const aliasSlug = aliases[slug];
  if (aliasSlug && SHOP_CATEGORY_IMAGE_BY_SLUG[aliasSlug]) {
    return SHOP_CATEGORY_IMAGE_BY_SLUG[aliasSlug];
  }

  return undefined;
}

export function isShopCategoryStaticImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return url.startsWith('/images/shop/categories/');
}
