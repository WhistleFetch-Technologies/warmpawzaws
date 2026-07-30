import type { LucideIcon } from 'lucide-react';
import {
  Apple,
  Brain,
  Footprints,
  GraduationCap,
  Home,
  Scissors,
  Stethoscope,
} from 'lucide-react';
import {
  listWapptHubCategories,
  normalizeWapptHubCategory,
  type WapptHubCategory,
} from '@/lib/wappt-hub-registry';
import { resolveWapptVendorProfileConfig } from '@/lib/warmpawz-appointments/wappt-vendor-profile-config';

export type WapptVendorListConfig = {
  category: string;
  serviceName: string;
  serviceSubtitle: string;
  headerIcon: LucideIcon;
  searchPlaceholder: string;
  loadingMessage: string;
  emptyTitle: string;
  emptySubtitle: string;
  cardCategoryLabel: string;
  resultsCountLabel: (count: number) => string;
};

const CATEGORY_LIST_CONFIG: Record<WapptHubCategory, Omit<WapptVendorListConfig, 'category'>> = {
  vet: {
    serviceName: 'Veterinary Clinic',
    serviceSubtitle: 'Find a veterinary clinic near you',
    headerIcon: Stethoscope,
    searchPlaceholder: 'Search clinics...',
    loadingMessage: 'Finding clinics...',
    emptyTitle: 'No clinics found',
    emptySubtitle: 'Try adjusting your search or filters',
    cardCategoryLabel: 'Veterinary Clinic',
    resultsCountLabel: (count) => `${count} clinic${count === 1 ? '' : 's'} found`,
  },
  grooming: {
    serviceName: 'Grooming Salon',
    serviceSubtitle: 'Find a grooming salon near you',
    headerIcon: Scissors,
    searchPlaceholder: 'Search salons...',
    loadingMessage: 'Finding salons...',
    emptyTitle: 'No salons found',
    emptySubtitle: 'Try adjusting your search or filters',
    cardCategoryLabel: 'Grooming Salon',
    resultsCountLabel: (count) => `${count} salon${count === 1 ? '' : 's'} found`,
  },
  training: {
    serviceName: 'Training Centre',
    serviceSubtitle: 'Find a training centre near you',
    headerIcon: GraduationCap,
    searchPlaceholder: 'Search trainers...',
    loadingMessage: 'Finding trainers...',
    emptyTitle: 'No trainers found',
    emptySubtitle: 'Try adjusting your search or filters',
    cardCategoryLabel: 'Training Centre',
    resultsCountLabel: (count) => `${count} trainer${count === 1 ? '' : 's'} found`,
  },
  behaviorist: {
    serviceName: 'Pet Behaviorist',
    serviceSubtitle: 'Find a behavior specialist near you',
    headerIcon: Brain,
    searchPlaceholder: 'Search behaviorists...',
    loadingMessage: 'Finding behaviorists...',
    emptyTitle: 'No behaviorists found',
    emptySubtitle: 'Try adjusting your search or filters',
    cardCategoryLabel: 'Behaviorist',
    resultsCountLabel: (count) => `${count} provider${count === 1 ? '' : 's'} found`,
  },
  walker: {
    serviceName: 'Dog Walker',
    serviceSubtitle: 'Find a trusted walker near you',
    headerIcon: Footprints,
    searchPlaceholder: 'Search walkers...',
    loadingMessage: 'Finding walkers...',
    emptyTitle: 'No walkers found',
    emptySubtitle: 'Try adjusting your search or filters',
    cardCategoryLabel: 'Dog Walker',
    resultsCountLabel: (count) => `${count} walker${count === 1 ? '' : 's'} found`,
  },
  boarding: {
    serviceName: 'Pet Boarding',
    serviceSubtitle: 'Find a boarding facility near you',
    headerIcon: Home,
    searchPlaceholder: 'Search boarding facilities...',
    loadingMessage: 'Finding boarding facilities...',
    emptyTitle: 'No boarding facilities found',
    emptySubtitle: 'Try adjusting your search or filters',
    cardCategoryLabel: 'Boarding Facility',
    resultsCountLabel: (count) => `${count} facilit${count === 1 ? 'y' : 'ies'} found`,
  },
  sitting: {
    serviceName: 'Pet Sitter',
    serviceSubtitle: 'Find a pet sitter near you',
    headerIcon: Home,
    searchPlaceholder: 'Search sitters...',
    loadingMessage: 'Finding sitters...',
    emptyTitle: 'No sitters found',
    emptySubtitle: 'Try adjusting your search or filters',
    cardCategoryLabel: 'Pet Sitter',
    resultsCountLabel: (count) => `${count} sitter${count === 1 ? '' : 's'} found`,
  },
  nutrition: {
    serviceName: 'Pet Nutritionist',
    serviceSubtitle: 'Find a nutrition specialist near you',
    headerIcon: Apple,
    searchPlaceholder: 'Search nutritionists...',
    loadingMessage: 'Finding nutritionists...',
    emptyTitle: 'No nutritionists found',
    emptySubtitle: 'Try adjusting your search or filters',
    cardCategoryLabel: 'Nutritionist',
    resultsCountLabel: (count) => `${count} specialist${count === 1 ? '' : 's'} found`,
  },
};

export function resolveWapptVendorListConfig(category: string): WapptVendorListConfig {
  const hub = normalizeWapptHubCategory(category);
  const profile = resolveWapptVendorProfileConfig(category);
  const list = hub ? CATEGORY_LIST_CONFIG[hub] : undefined;
  if (!list) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[wappt] missing list config for category "${category}"`);
    }
    return {
      category: hub ?? category,
      ...CATEGORY_LIST_CONFIG.vet,
      headerIcon: profile.headerIcon,
      cardCategoryLabel: profile.styleBadgeLabel('at_center'),
    };
  }
  return {
    category: hub,
    ...list,
    headerIcon: profile.headerIcon,
    cardCategoryLabel: profile.styleBadgeLabel('at_center'),
  };
}

export function listWapptListConfiguredCategories(): WapptHubCategory[] {
  return listWapptHubCategories().filter((hub) => Boolean(CATEGORY_LIST_CONFIG[hub]));
}
