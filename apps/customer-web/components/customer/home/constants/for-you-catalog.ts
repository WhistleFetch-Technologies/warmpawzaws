import { HOME_CATEGORY_IMAGE_URLS } from './category-card-images';

export interface ForYouCatalogEntry {
  id: string;
  title: string;
  description: string;
  screen: string;
  imageUrl: string;
}

export const FOR_YOU_CATALOG: ForYouCatalogEntry[] = [
  {
    id: 'grooming',
    title: 'Grooming',
    description: 'Salon & at-home grooming',
    screen: 'grooming',
    imageUrl: HOME_CATEGORY_IMAGE_URLS.grooming,
  },
  {
    id: 'vet',
    title: 'Vet Checkup',
    description: 'Consultations & checkups',
    screen: 'vet',
    imageUrl: HOME_CATEGORY_IMAGE_URLS.vet,
  },
  {
    id: 'walker',
    title: 'Daily Walk',
    description: 'Walks & exercise',
    screen: 'walker',
    imageUrl: HOME_CATEGORY_IMAGE_URLS.walker,
  },
];
