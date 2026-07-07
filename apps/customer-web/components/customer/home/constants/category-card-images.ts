/**
 * Static category imagery for home service cards and related sections.
 * Files live in apps/customer-web/public/images/home/
 */
export const HOME_CATEGORY_IMAGE_URLS: Record<string, string> = {
  grooming: '/images/home/groomig.webp',
  vet: '/images/home/vet.webp',
  veterinary: '/images/home/vet.webp',
  boarding: '/images/home/boarding.webp',
  walker: '/images/home/walker.webp',
  walking: '/images/home/walker.webp',
  'pet-sitter': '/images/home/sitter.webp',
  pet_sitter: '/images/home/sitter.webp',
  sitting: '/images/home/sitter.webp',
  training: '/images/home/training.webp',
  nutritionist: '/images/home/nutrition.webp',
  nutrition: '/images/home/nutrition.webp',
  wellness: '/images/home/nutrition.webp',
  shop: '/images/home/nutrition.webp',
  pharmacy: '/images/home/vet.webp',
};

/** Default hero pet image when CMS banner has no imageUrl. */
export const DEFAULT_HOME_HERO_IMAGE_URL = '/images/home/dog-peep.webp';

export function getCategoryCardImageUrl(screenOrCategory: string | undefined): string | undefined {
  if (!screenOrCategory) return undefined;
  const key = screenOrCategory.toLowerCase().trim();
  return HOME_CATEGORY_IMAGE_URLS[key];
}
