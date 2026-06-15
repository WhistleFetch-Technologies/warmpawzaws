/**
 * Static category imagery for home service cards and related sections.
 * Files live in apps/customer-web/public/images/home/
 */
export const HOME_CATEGORY_IMAGE_URLS: Record<string, string> = {
  grooming: '/images/home/groomig.jpeg',
  vet: '/images/home/vet.jpeg',
  veterinary: '/images/home/vet.jpeg',
  boarding: '/images/home/boarding.jpeg',
  walker: '/images/home/walker.jpeg',
  walking: '/images/home/walker.jpeg',
  'pet-sitter': '/images/home/sitter.jpeg',
  pet_sitter: '/images/home/sitter.jpeg',
  sitting: '/images/home/sitter.jpeg',
  training: '/images/home/training.jpeg',
  nutritionist: '/images/home/nutrition.jpeg',
  nutrition: '/images/home/nutrition.jpeg',
  wellness: '/images/home/nutrition.jpeg',
  shop: '/images/home/nutrition.jpeg',
  pharmacy: '/images/home/vet.jpeg',
};

/** Default hero pet image when CMS banner has no imageUrl. */
export const DEFAULT_HOME_HERO_IMAGE_URL = '/images/home/dog-peep.webp';

export function getCategoryCardImageUrl(screenOrCategory: string | undefined): string | undefined {
  if (!screenOrCategory) return undefined;
  const key = screenOrCategory.toLowerCase().trim();
  return HOME_CATEGORY_IMAGE_URLS[key];
}
