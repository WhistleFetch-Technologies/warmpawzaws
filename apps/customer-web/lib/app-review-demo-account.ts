/**
 * App Store review demo account (9606901515) — phone-only UI gates.
 * Other users: all helpers return false / pass-through unchanged.
 */

import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';

export const APP_REVIEW_DEMO_PHONE = '9606901515';

/** Menu action keys hidden for the review demo account. */
export const REVIEW_HIDDEN_MENU_ACTIONS = new Set([
  'orders',
  'rewards-loyalty',
  'referral-system',
]);

/** Shell / home screen ids hidden for the review demo account. */
export const REVIEW_HIDDEN_SCREENS = new Set([
  'shop',
  'cart',
  'checkout',
  'order_success',
  'order_history',
  'order_detail',
  'order_tracking',
  'product_detail',
  'product_reviews',
  'vendor_profile',
  'rewards-loyalty',
  'referral-system',
  'promotions',
  'wishlist',
  'insurance',
  'adoption',
  'cafes',
  'mating-dating-hub',
  'breeder',
  'meal_plans',
  'meal-plan',
  'ambulance',
  'premium-pet-food',
  'pet-sitter',
  'pet_sitter',
  'sitting',
]);

/** Home service tile screen/category ids to remove entirely (not show as "Soon"). */
export const REVIEW_HIDDEN_HOME_TILE_KEYS = new Set([
  'mating-dating-hub',
  'cafes',
  'insurance',
  'adoption',
  'breeder',
  'ambulance',
  'meal_plans',
  'meal-plans',
  'premium-pet-food',
  'shop',
  'marketplace',
  'pet-sitter',
  'pet_sitter',
  'sitting',
  'physio',
  'physiotherapy',
  'physio-therapy',
]);

export function normalizePhoneForGate(phone: string | null | undefined): string {
  if (phone == null) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function isAppReviewDemoAccount(phone: string | null | undefined): boolean {
  return normalizePhoneForGate(phone) === APP_REVIEW_DEMO_PHONE;
}

export function readStoredCustomerPhone(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('customerPhone')?.trim() ||
    localStorage.getItem('customer_phone')?.trim() ||
    localStorage.getItem('phone')?.trim() ||
    ''
  );
}

/** Shop tab, home shop row, marketplace routes — hidden for demo account. */
export function isShopUiVisibleForAccount(phone?: string | null): boolean {
  const p = phone ?? readStoredCustomerPhone();
  if (isAppReviewDemoAccount(p)) return false;
  return isCustomerEcommerceEnabled();
}

/** Loyalty / referral surfaces — hidden for demo account only. */
export function isLoyaltyUiVisibleForAccount(phone?: string | null): boolean {
  const p = phone ?? readStoredCustomerPhone();
  return !isAppReviewDemoAccount(p);
}

export function isReferralUiVisibleForAccount(phone?: string | null): boolean {
  return isLoyaltyUiVisibleForAccount(phone);
}

/** Meal-plan entry points — hidden for demo account. */
export function isMealPlansUiVisibleForAccount(phone?: string | null): boolean {
  const p = phone ?? readStoredCustomerPhone();
  return !isAppReviewDemoAccount(p);
}

export function isReviewBlockedScreen(screen: string, phone?: string | null): boolean {
  const p = phone ?? readStoredCustomerPhone();
  if (!isAppReviewDemoAccount(p)) return false;
  const key = String(screen || '').toLowerCase().trim();
  return REVIEW_HIDDEN_SCREENS.has(key);
}

export function isReviewBlockedMenuAction(action: string, phone?: string | null): boolean {
  const p = phone ?? readStoredCustomerPhone();
  if (!isAppReviewDemoAccount(p)) return false;
  return REVIEW_HIDDEN_MENU_ACTIONS.has(action);
}

export function isReviewBlockedMenuView(view: string, phone?: string | null): boolean {
  const p = phone ?? readStoredCustomerPhone();
  if (!isAppReviewDemoAccount(p)) return false;
  const v = String(view || '').toLowerCase().trim();
  return v === 'cart' || v === 'saved';
}

type MenuItemLike = {
  action?: string;
  view?: string;
  comingSoon?: boolean;
};

/** Filter profile menu rows — removes under-build items for demo account (no Soon badges). */
export function filterAccountMenuForReviewAccount<T extends MenuItemLike>(
  items: T[],
  phone?: string | null
): T[] {
  const p = phone ?? readStoredCustomerPhone();
  if (!isAppReviewDemoAccount(p)) return items;
  return items.filter((item) => {
    if (item.action && isReviewBlockedMenuAction(item.action, p)) return false;
    if (item.view && isReviewBlockedMenuView(item.view, p)) return false;
    return true;
  });
}

type ServiceTileLike = {
  screen?: string;
  categoryId?: string;
  isComingSoon?: boolean;
  comingSoon?: boolean;
};

function tileKey(tile: ServiceTileLike): string {
  return String(tile.screen || tile.categoryId || '')
    .toLowerCase()
    .trim();
}

/** Remove under-build home tiles for demo account (live vet/grooming/etc. stay). */
export function filterHomeServiceTilesForReviewAccount<T extends ServiceTileLike>(
  items: T[],
  phone?: string | null
): T[] {
  const p = phone ?? readStoredCustomerPhone();
  if (!isAppReviewDemoAccount(p)) return items;
  return items.filter((tile) => {
    const key = tileKey(tile);
    if (REVIEW_HIDDEN_HOME_TILE_KEYS.has(key)) return false;
    if (tile.isComingSoon || tile.comingSoon) return false;
    return true;
  });
}

type PopularServiceLike = {
  id?: string;
  screen?: string;
};

function popularServiceKey(item: PopularServiceLike): string {
  return String(item.id || item.screen || '')
    .toLowerCase()
    .trim();
}

/** Popular Services home row — hide under-build cards (e.g. Pet Sitting) for demo account. */
export function filterPopularServicesForReviewAccount<T extends PopularServiceLike>(
  items: T[],
  phone?: string | null
): T[] {
  const p = phone ?? readStoredCustomerPhone();
  if (!isAppReviewDemoAccount(p)) return items;
  return items.filter((item) => !REVIEW_HIDDEN_HOME_TILE_KEYS.has(popularServiceKey(item)));
}

/** URL path prefixes blocked for demo account (redirect to home). */
export const REVIEW_BLOCKED_URL_PREFIXES = [
  '/shop',
  '/cart',
  '/checkout',
  '/orders',
  '/wishlist',
  '/rewards',
  '/referrals',
  '/promotions',
  '/returns',
] as const;

export function isReviewBlockedUrlPath(pathname: string, phone?: string | null): boolean {
  const p = phone ?? readStoredCustomerPhone();
  if (!isAppReviewDemoAccount(p)) return false;
  const path = (pathname || '/').split('?')[0]?.split('#')[0] ?? '/';
  return REVIEW_BLOCKED_URL_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

type ComingSoonLike = {
  comingSoon?: boolean;
  coming_soon?: boolean;
};

/** Remove non-actionable banners for demo account (no disabled CTAs). */
export function filterComingSoonBannersForReviewAccount<T extends ComingSoonLike>(
  items: T[],
  phone?: string | null
): T[] {
  const p = phone ?? readStoredCustomerPhone();
  if (!isAppReviewDemoAccount(p)) return items;
  return items.filter((item) => {
    const soon = Boolean(item.comingSoon || item.coming_soon);
    return !soon;
  });
}

type WhatsNewLike = {
  id?: string;
  comingSoon?: boolean;
  announcementType?: string;
  ctaLink?: string;
  badgeText?: string;
  ctaText?: string;
};

/** Strip coming-soon / under-build What's New rows for demo account. */
export function filterWhatsNewAnnouncementsForReviewAccount<T extends WhatsNewLike>(
  items: T[],
  phone?: string | null
): T[] {
  const p = phone ?? readStoredCustomerPhone();
  if (!isAppReviewDemoAccount(p)) return items;
  return items.filter((item) => {
    if (item.comingSoon) return false;
    const type = String(item.announcementType || '').toLowerCase();
    if (type === 'emergency' || type === 'premium') return false;
    const link = String(item.ctaLink || '')
      .toLowerCase()
      .trim()
      .replace(/^\//, '');
    if (link && REVIEW_HIDDEN_SCREENS.has(link)) return false;
    if (link === 'shop' || link === 'rewards' || link === 'referrals' || link === 'subscriptions') {
      return false;
    }
    const badge = String(item.badgeText || '').toUpperCase();
    const cta = String(item.ctaText || '').toUpperCase();
    if (badge === 'SOON' || cta.includes('COMING SOON')) return false;
    return true;
  });
}
