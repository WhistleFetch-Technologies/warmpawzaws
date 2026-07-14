import {
  DEFAULT_HOME_HERO_IMAGE_URL,
  HOME_CATEGORY_IMAGE_URLS,
} from '@/components/customer/home/constants/category-card-images';

const PREMIUM_CARD_PATHS = [
  '/images/home/3cards/Picsart_26-07-13_11-55-03-999.png',
  '/images/home/3cards/Picsart_26-07-13_11-54-49-722.png',
  '/images/home/3cards/Picsart_26-07-13_11-54-32-921.webp',
] as const;

const SHOP_CATEGORY_PATHS = [
  '/images/shop/categories/pet-food.jpeg',
  '/images/shop/categories/pet-accessories.jpeg',
  '/images/shop/categories/pet-toys.jpeg',
  '/images/shop/categories/pet-grooming.jpeg',
  '/images/shop/categories/pet-health.jpeg',
  '/images/shop/categories/pet-beds-furniture.jpeg',
  '/images/shop/categories/pet-clothing.jpeg',
  '/images/shop/categories/pet-travel.jpeg',
  '/images/shop/categories/pet-pharmacy.jpeg',
  '/images/shop/categories/pet-training.jpeg',
] as const;

const MORE_SERVICES_PATHS = [
  '/images/home/more services/peer.webp',
  '/images/home/more services/insurance.webp',
  '/images/home/more services/walker.webp',
  '/images/home/more services/cafe.webp',
] as const;

const HOME_HUB_EXTRA = [
  '/logo.webp',
  DEFAULT_HOME_HERO_IMAGE_URL,
  '/images/home/article.webp',
  '/images/home/3cards/home-visit.webp',
  '/images/home/3cards/tele-consult.webp',
  '/images/home/3cards/pet-product-shop.webp',
] as const;

/** High-traffic static paths for IndexedDB pre-warm after first paint. */
export function getStaticImagePrewarmPaths(): string[] {
  const categoryPaths = Object.values(HOME_CATEGORY_IMAGE_URLS);
  return [
    ...new Set([
      ...categoryPaths,
      ...SHOP_CATEGORY_PATHS,
      ...MORE_SERVICES_PATHS,
      ...HOME_HUB_EXTRA,
      ...PREMIUM_CARD_PATHS,
    ]),
  ];
}
