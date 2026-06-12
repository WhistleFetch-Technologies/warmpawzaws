import { resolveCustomerScreenForCategoryAndStyle } from '@warmpawz/service-launch-mappings';

const SERVICE_TYPE_CATEGORY_SCREENS = [
  'vet',
  'grooming',
  'training',
  'walker',
  'boarding',
  'nutritionist',
  'pet-sitter',
  'lab-diagnostics',
  'pharmacy',
  'adoption',
  'insurance',
] as const;

const BANNER_SERVICE_STYLES = ['tele', 'at_home', 'at_center'] as const;

/** All screens `buildServiceTypeNavTarget` can emit via resolveCustomerScreenForCategoryAndStyle. */
export function collectBannerServiceTypeResolverScreens(): string[] {
  const screens = new Set<string>();
  for (const category of SERVICE_TYPE_CATEGORY_SCREENS) {
    for (const style of BANNER_SERVICE_STYLES) {
      const screen = resolveCustomerScreenForCategoryAndStyle(category, style);
      if (screen) screens.add(screen);
    }
  }
  return [...screens];
}

/** Screens from vendor profile / booking banner resolver paths. */
export const BANNER_VENDOR_BOOKING_NAV_SCREENS = [
  'vet-services-by-style',
  'vet-booking',
  'training-booking',
  'create-booking',
  'purchase-package',
  'grooming-booking',
  'boarding-booking',
  'walker-booking',
  'pet-sitter-booking',
] as const;

/**
 * Screen ids that CustomerHomeWrapper.handleNavigateToService accepts for banner navTarget.screen.
 * Keep in sync when adding new banner destination types or style-specific landing screens.
 */
export const CUSTOMER_HOME_HANDLED_BANNER_NAV_SCREENS = new Set<string>([
  ...collectBannerServiceTypeResolverScreens(),
  ...BANNER_VENDOR_BOOKING_NAV_SCREENS,
]);
