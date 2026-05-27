import type { ComponentType } from 'react';

/** Quick service tile from catalog + launch config (matches useCustomerCategories shape). */
export interface QuickServiceTile {
  icon: ComponentType<{ className?: string }>;
  label: string;
  color: string;
  screen: string;
  categoryId: string;
  isComingSoon?: boolean;
}

/** Hero carousel slide — CMS home_top banners + defaults. */
export interface HomeCarouselBanner {
  id: string | number;
  title: string;
  subtitle: string;
  gradientFrom: string;
  gradientTo: string;
  Icon: ComponentType<{ className?: string }>;
  ctaText: string;
  ctaLink: string;
  comingSoon?: boolean;
  imageUrl?: string;
}

/** Screens always shown as non-interactive “coming soon” on home (product policy). */
export const COMING_SOON_HOME_SERVICE_SCREENS = new Set(['mating-dating-hub', 'cafes']);
