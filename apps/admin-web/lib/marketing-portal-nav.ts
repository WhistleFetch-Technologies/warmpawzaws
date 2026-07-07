/**
 * Marketing portal IA — flat sidebar under Marketing (tabs live on each hub page).
 */

export type MarketingPortalNavLink = {
  id: string;
  label: string;
  href: string;
  /** Nav item id from ADMIN_PORTAL_NAV_ITEMS used for RBAC visibility. */
  permissionNavId: string;
};

/** Flat links shown under Marketing in the admin sidebar. */
export const MARKETING_PORTAL_TOP_LINKS: MarketingPortalNavLink[] = [
  {
    id: 'marketing-hub',
    label: 'Marketing Hub',
    href: '/marketing',
    permissionNavId: 'marketing',
  },
  {
    id: 'promotion-center',
    label: 'Promotion Center',
    href: '/promotion-center',
    permissionNavId: 'promotions',
  },
  {
    id: 'notifications',
    label: 'Notification',
    href: '/notification-engine',
    permissionNavId: 'notification-engine',
  },
];

/** @deprecated Nested groups replaced by hub pages with top tabs. Kept for legacy UI flag. */
export type MarketingPortalNavGroup = {
  id: 'marketing-hub' | 'promotions' | 'notifications';
  label: string;
  links: MarketingPortalNavLink[];
};

/** @deprecated Use MARKETING_PORTAL_TOP_LINKS */
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
        label: 'Platform Promotions & Coupons',
        href: '/promotion-center?tab=platform',
        permissionNavId: 'promotions',
      },
      {
        id: 'promo-vendor',
        label: 'Vendor Promotions',
        href: '/promotion-center?tab=vendor',
        permissionNavId: 'marketing-vendor-promotions',
      },
      {
        id: 'promo-policy',
        label: 'Policy Center',
        href: '/promotion-center?tab=policy',
        permissionNavId: 'policy-center',
      },
      {
        id: 'promo-analytics',
        label: 'Analytics',
        href: '/promotion-center?tab=analytics',
        permissionNavId: 'marketing-analytics',
      },
      {
        id: 'promo-campaigns',
        label: 'Campaigns',
        href: '/promotion-center?tab=campaigns',
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
        href: '/notification-engine?view=history',
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
  const actual =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  for (const [key, value] of expected.entries()) {
    if (actual.get(key) !== value) return false;
  }
  return true;
}

export function marketingPortalTopLinkActive(
  link: MarketingPortalNavLink,
  pathname: string | null
): boolean {
  if (!pathname) return false;
  const [path] = link.href.split('?');
  if (link.id === 'marketing-hub') {
    return pathname === '/marketing' || pathname.startsWith('/marketing/');
  }
  if (link.id === 'promotion-center') {
    return (
      pathname === '/promotion-center' ||
      pathname.startsWith('/promotion-center/') ||
      pathname === '/promotions' ||
      pathname.startsWith('/promotions/') ||
      pathname === '/policy-center' ||
      pathname.startsWith('/policy-center/') ||
      (pathname.startsWith('/marketing/') &&
        (pathname.includes('vendor-promotions') ||
          pathname.includes('analytics') ||
          pathname.includes('campaigns')))
    );
  }
  if (link.id === 'notifications') {
    return (
      pathname === '/notification-engine' ||
      pathname.startsWith('/notification-engine/') ||
      pathname === '/notifications' ||
      pathname.startsWith('/notifications/')
    );
  }
  return pathname === path || pathname.startsWith(`${path}/`);
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
