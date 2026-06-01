/**
 * Maps URL path prefixes to required admin portal permissions.
 * Longer prefixes are matched first (see getAdminRouteGateRule).
 * Align with UnifiedAdminSidebar + app routes.
 */

export type AdminRouteGateRule = {
  pathPrefix: string;
  /** Passed to hasAdminPortalPermission — array means OR. */
  permission: string | string[];
  /** Optional copy for the access-denied panel */
  hint?: string;
};

const RULES: AdminRouteGateRule[] = [
  { pathPrefix: '/enterprise/logic-tab', permission: 'admin.governance' },
  { pathPrefix: '/support/settings', permission: 'admin.support' },
  { pathPrefix: '/support', permission: 'admin.support' },
  { pathPrefix: '/roles', permission: 'admin.roles', hint: 'RBAC management requires admin.roles (or full admin access).' },
  { pathPrefix: '/platform-settings', permission: 'admin.platform_settings' },
  { pathPrefix: '/database-seeding', permission: 'admin.platform_settings' },
  { pathPrefix: '/regions', permission: 'admin.platform_settings' },
  { pathPrefix: '/pet-info', permission: 'admin.catalog' },
  { pathPrefix: '/catalog', permission: 'admin.catalog' },
  {
    pathPrefix: '/finance',
    permission: ['admin.settlements', 'admin.logistics'],
  },
  { pathPrefix: '/payment-refund', permission: ['admin.settlements', 'admin.logistics'] },
  { pathPrefix: '/product-analytics', permission: 'admin.analytics' },
  { pathPrefix: '/analytics', permission: 'admin.analytics' },
  { pathPrefix: '/enterprise', permission: 'admin.governance' },
  { pathPrefix: '/ecommerce', permission: 'admin.ecommerce' },
  { pathPrefix: '/notification-engine', permission: 'admin.notifications.view' },
  { pathPrefix: '/marketing', permission: 'admin.integrations' },
  { pathPrefix: '/loyalty', permission: 'admin.integrations' },
  { pathPrefix: '/banners', permission: 'admin.integrations' },
  { pathPrefix: '/notifications', permission: 'admin.integrations' },
  { pathPrefix: '/promotions', permission: 'admin.integrations' },
  { pathPrefix: '/webhooks', permission: 'admin.integrations' },
  { pathPrefix: '/integrations', permission: 'admin.integrations' },
  { pathPrefix: '/tiers', permission: 'admin.integrations' },
  { pathPrefix: '/subscriptions', permission: 'admin.integrations' },
  { pathPrefix: '/events', permission: 'admin.events' },
  { pathPrefix: '/content', permission: 'admin.governance' },
  { pathPrefix: '/governance', permission: 'admin.governance' },
  { pathPrefix: '/sellers', permission: 'admin.vendors' },
  { pathPrefix: '/vendors', permission: 'admin.vendors' },
  { pathPrefix: '/customers', permission: 'admin.customers' },
  { pathPrefix: '/settlements', permission: 'admin.settlements' },
  { pathPrefix: '/refunds', permission: 'admin.refunds' },
  { pathPrefix: '/logistics', permission: 'admin.logistics' },
  { pathPrefix: '/reports', permission: 'admin.reports' },
  { pathPrefix: '/problem-grid', permission: 'admin.catalog' },
];

const SORTED = [...RULES].sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);

/**
 * Returns the gate rule for this pathname, or null if no explicit rule (allow).
 */
export function getAdminRouteGateRule(pathname: string): AdminRouteGateRule | null {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  for (const rule of SORTED) {
    if (p === rule.pathPrefix || p.startsWith(`${rule.pathPrefix}/`)) {
      return rule;
    }
  }
  return null;
}

export function formatRequiredPermissions(rule: AdminRouteGateRule): string {
  const perm = rule.permission;
  if (typeof perm === 'string') return perm;
  return perm.join(' · ');
}
