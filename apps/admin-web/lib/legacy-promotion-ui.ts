import type { AdminPortalNavItem } from '@warmpawz/shared-types';

/** Env / runtime flag — default false (new Promotion Platform only). */
export function isLegacyPromotionUiEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const runtime = (window as unknown as { __WARMPAWZ_RUNTIME_CONFIG__?: { enableLegacyPromotionUi?: boolean | string } })
      .__WARMPAWZ_RUNTIME_CONFIG__?.enableLegacyPromotionUi;
    if (runtime === true || runtime === 'true') return true;
  }
  return process.env.NEXT_PUBLIC_ENABLE_LEGACY_PROMOTION_UI === 'true';
}

/** Legacy tabs on /marketing — hidden from normal QA when flag is off. */
export const LEGACY_MARKETING_PROMO_TABS = ['promotions', 'vendor-promotions', 'coupons'] as const;

export type LegacyMarketingPromoTab = (typeof LEGACY_MARKETING_PROMO_TABS)[number];

export function isLegacyMarketingPromoTab(tab: string): tab is LegacyMarketingPromoTab {
  return (LEGACY_MARKETING_PROMO_TABS as readonly string[]).includes(tab);
}

/** Marketing sidebar items for the new Promotion Platform (legacy hub tab duplicates excluded). */
const PRIMARY_MARKETING_NAV_IDS = new Set([
  'marketing',
  'promotions',
  'marketing-vendor-promotions',
  'policy-center',
  'marketing-analytics',
  'marketing-campaigns',
  'notification-engine',
]);

export function filterMarketingSidebarNavItems(items: AdminPortalNavItem[]): AdminPortalNavItem[] {
  if (isLegacyPromotionUiEnabled()) return items;
  return items.filter((item) => PRIMARY_MARKETING_NAV_IDS.has(item.id));
}

/** Default /marketing tab when legacy promo tabs are hidden. */
export const MARKETING_HUB_DEFAULT_TAB = 'banners';
