import { HOME_CATEGORY_IMAGE_URLS } from './category-card-images';

export interface HelpWayCatalogEntry {
  id: string;
  title: string;
  description: string;
  screen: string;
  categoryId: string;
  imageUrl: string;
}

export const HELP_WAYS_CATALOG: HelpWayCatalogEntry[] = [
  {
    id: 'nutrition',
    title: 'Nutrition',
    description: 'Personalized meal plans & expert diet advice.',
    screen: 'nutritionist',
    categoryId: 'nutritionist',
    imageUrl: HOME_CATEGORY_IMAGE_URLS.nutritionist,
  },
  {
    id: 'training',
    title: 'Training',
    description: 'Build good behavior with expert-led training.',
    screen: 'training',
    categoryId: 'training',
    imageUrl: HOME_CATEGORY_IMAGE_URLS.training,
  },
  {
    id: 'shop',
    title: 'Pet Products',
    description: 'Food, toys & essentials for happy pets.',
    screen: 'shop',
    categoryId: 'shop',
    imageUrl: HOME_CATEGORY_IMAGE_URLS.shop,
  },
  {
    id: 'insurance',
    title: 'Insurance',
    description: 'Full coverage plans for complete peace of mind.',
    screen: 'insurance',
    categoryId: 'insurance',
    imageUrl: HOME_CATEGORY_IMAGE_URLS.vet,
  },
];
