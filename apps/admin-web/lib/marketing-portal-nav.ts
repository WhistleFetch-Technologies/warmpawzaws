/**
 * Marketing portal IA — sidebar groups (UI only; routes unchanged).
 */

export type MarketingPortalNavLink = {
  id: string;
  label: string;
  href: string;
  /** Nav item id from ADMIN_PORTAL_NAV_ITEMS used for RBAC visibility. */
  permissionNavId: string;
};

export type MarketingPortalNavGroup = {
  id: 'marketing-hub' | 'promotions' | 'notifications';
  label: string;
  links: MarketingPortalNavLink[];
};

export const MARKETING_PORTAL_NAV_GROUPS: MarketingPortalNavGroup[] = [
  {
    id: 'marketing-hub',
    label: 'Marketing Hub',
    links: [
      {
        id: 'hub-dashboard-ui',
        label: 'Dashboard UI',
        href: '/marketing?tab=ui-config',
        permissionNavId: 'marketing',
      },
      {
        id: 'hub-spotlight',
        label: 'Spotlight',
        href: '/marketing?tab=spotlight',
        permissionNavId: 'marketing',
      },
      {
        id: 'hub-banners',
        label: 'Banners',
        href: '/marketing?tab=banners',
        permissionNavId: 'marketing',
      },
      {
        id: 'hub-articles',
        label: 'Articles',
        href: '/marketing?tab=articles',
        permissionNavId: 'marketing',
      },
      {
        id: 'hub-whats-new',
        label: "What's New",
        href: '/marketing?tab=announcements',
        permissionNavId: 'marketing',
      },
    ],
  },
  {
    id: 'promotions',
    label: 'Promotions',
    links: [
      {
        id: 'promo-platform',
        label: 'Platform Promotions',
        href: '/promotions',
        permissionNavId: 'promotions',
      },
      {
        id: 'promo-vendor',
        label: 'Vendor Promotions',
        href: '/marketing/vendor-promotions',
        permissionNavId: 'marketing-vendor-promotions',
      },
      {
        id: 'promo-coupons',
        label: 'Coupons',
        href: '/promotions?type=coupons',
        permissionNavId: 'promotions',
      },
      {
        id: 'promo-policy',
        label: 'Policy Center',
        href: '/policy-center',
        permissionNavId: 'policy-center',
      },
      {
        id: 'promo-analytics',
        label: 'Analytics',
        href: '/marketing/analytics',
        permissionNavId: 'marketing-analytics',
      },
      {
        id: 'promo-campaigns',
        label: 'Campaigns',
        href: '/marketing/campaigns',
        permissionNavId: 'marketing-campaigns',
      },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    links: [
      {
        id: 'notif-push',
        label: 'Push Notifications',
        href: '/notification-engine?view=push',
        permissionNavId: 'notification-engine',
      },
      {
        id: 'notif-campaigns',
        label: 'Notification Campaigns',
        href: '/notification-engine?view=campaigns',
        permissionNavId: 'notification-engine',
      },
      {
        id: 'notif-templates',
        label: 'Templates',
        href: '/notification-engine?view=templates',
        permissionNavId: 'notification-engine',
      },
      {
        id: 'notif-history',
        label: 'History',
        href: '/notifications',
        permissionNavId: 'notification-engine',
      },
    ],
  },
];

export function marketingPortalLinkActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  const [path, query = ''] = href.split('?');
  if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
  if (!query) return pathname === path || pathname.startsWith(`${path}/`);
  const expected = new URLSearchParams(query);
  const actual = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  for (const [key, value] of expected.entries()) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}

export function marketingPortalGroupActive(
  group: MarketingPortalNavGroup,
  pathname: string | null
): boolean {
  return group.links.some((link) => {
    const [path] = link.href.split('?');
    if (pathname === path || pathname?.startsWith(`${path}/`)) return true;
    return marketingPortalLinkActive(link.href, pathname);
  });
}
