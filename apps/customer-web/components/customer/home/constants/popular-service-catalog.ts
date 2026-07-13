import type { LucideIcon } from 'lucide-react';
import { Dog, DoorOpen, Home, Scissors, Stethoscope } from 'lucide-react';
import { HOME_CATEGORY_IMAGE_URLS } from './category-card-images';
import { getCategoryCardTheme } from './category-card-themes';

export interface PopularServiceCatalogEntry {
  id: string;
  title: string;
  description: string;
  screen: string;
  imageUrl: string;
  icon: LucideIcon;
  iconColor: string;
  /** discover-services query */
  discoverCategory: string;
  serviceStyle: string;
  /** Shown as "From ₹X" when discover API returns a min price */
  priceFrom?: number;
}

function entry(
  partial: Omit<PopularServiceCatalogEntry, 'iconColor'> & {
    icon: PopularServiceCatalogEntry['icon'];
  }
): PopularServiceCatalogEntry {
  return {
    ...partial,
    iconColor: getCategoryCardTheme(partial.id).iconColor,
  };
}

export const POPULAR_SERVICE_CATALOG: PopularServiceCatalogEntry[] = [
  entry({
    id: 'grooming',
    title: 'Grooming',
    description: 'Salon, spa & at-home grooming',
    screen: 'grooming',
    imageUrl: HOME_CATEGORY_IMAGE_URLS.grooming,
    icon: Scissors,
    discoverCategory: 'grooming',
    serviceStyle: 'at_center',
  }),
  entry({
    id: 'boarding',
    title: 'Boarding',
    description: "Safe stay while you're away",
    screen: 'boarding',
    imageUrl: HOME_CATEGORY_IMAGE_URLS.boarding,
    icon: Home,
    discoverCategory: 'boarding',
    serviceStyle: 'at_center',
  }),
  entry({
    id: 'walker',
    title: 'Walking',
    description: 'Daily walks & exercise',
    screen: 'walker',
    imageUrl: HOME_CATEGORY_IMAGE_URLS.walker,
    icon: Dog,
    discoverCategory: 'walker',
    serviceStyle: 'at_home',
  }),
  entry({
    id: 'vet',
    title: 'Vet',
    description: 'Consultations, checkups & treatments',
    screen: 'vet',
    imageUrl: HOME_CATEGORY_IMAGE_URLS.vet,
    icon: Stethoscope,
    discoverCategory: 'vet',
    serviceStyle: 'at_center',
  }),
  entry({
    id: 'pet-sitter',
    title: 'Pet Sitting',
    description: 'In-home pet sitting',
    screen: 'pet-sitter',
    imageUrl: HOME_CATEGORY_IMAGE_URLS['pet-sitter'],
    icon: DoorOpen,
    discoverCategory: 'pet-sitter',
    serviceStyle: 'at_home',
  }),
];
