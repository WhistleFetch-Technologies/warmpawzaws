/**
 * Single source of truth for admin portal sidebar items, RBAC assignable permissions,
 * and URL route gates.
 *
 * When adding a sidebar entry, add one row to ADMIN_PORTAL_NAV_ITEMS — it will
 * automatically appear in Create Role permissions and route guards.
 */

export type AdminPortalNavSection = 'main' | 'footer' | 'marketing-child';

export type AdminPortalNavItem = {
  /** Stable nav id (matches UnifiedAdminSidebar activeView where applicable). */
  id: string;
  /** Sidebar label shown to admins. */
  label: string;
  /** Stored in role_permissions.permission_name and checked client-side. */
  permissionId: string;
  /** OR-logic visibility when multiple legacy permission strings apply. */
  permissionsAny?: string[];
  /** URL prefixes guarded by AdminRouteGuard (longest match wins). */
  pathPrefixes?: string[];
  section: AdminPortalNavSection;
  /** Shown in RBAC Create Role modal (default true). */
  assignable?: boolean;
  description?: string;
  routeHint?: string;
  sortOrder: number;
};

export type AdminPortalRouteGateRule = {
  pathPrefix: string;
  permission: string | string[];
  hint?: string;
};

export type AdminPortalRbacCapability = {
  /** Unique key for UI (nav id or extra capability id). */
  navKey: string;
  /** Permission string persisted on the role. */
  permissionId: string;
  name: string;
  category: string;
  description: string;
  permissionsAny?: string[];
};

/** Extra assignable capabilities not tied to a sidebar row. */
export const ADMIN_PORTAL_EXTRA_RBAC_CAPABILITIES: Omit<
  AdminPortalRbacCapability,
  'navKey' | 'permissionsAny'
>[] = [
  {
    permissionId: 'admin.notifications.create',
    name: 'Notifications — Create',
    category: 'Admin Portal — Notification Engine',
    description: 'Create notification campaigns',
  },
  {
    permissionId: 'admin.notifications.edit',
    name: 'Notifications — Edit',
    category: 'Admin Portal — Notification Engine',
    description: 'Edit notification campaigns',
  },
  {
    permissionId: 'admin.notifications.approve',
    name: 'Notifications — Approve',
    category: 'Admin Portal — Notification Engine',
    description: 'Approve notification campaigns',
  },
  {
    permissionId: 'admin.notifications.send',
    name: 'Notifications — Send',
    category: 'Admin Portal — Notification Engine',
    description: 'Send or schedule notification campaigns',
  },
  {
    permissionId: 'admin.notifications.analytics',
    name: 'Notifications — Analytics',
    category: 'Admin Portal — Notification Engine',
    description: 'View notification campaign analytics',
  },
  {
    permissionId: 'admin.logistics',
    name: 'Logistics',
    category: 'Admin Portal — Finance',
    description: 'Logistics operations (also grants Finance & Logistics sidebar when combined with settlements)',
  },
  {
    permissionId: 'admin.settlements',
    name: 'Settlements',
    category: 'Admin Portal — Finance',
    description: 'Settlements and finance payouts (also grants Finance & Logistics sidebar)',
  },
  {
    permissionId: 'admin.integrations',
    name: 'Integrations',
    category: 'Admin Portal — Marketing',
    description: 'Integrations, webhooks, and marketing tooling not covered by a dedicated sidebar item',
  },
  {
    permissionId: 'admin.ai_copilot',
    name: 'Admin AI copilot',
    category: 'Admin Portal — Platform',
    description: 'Bedrock assistant with read-only tools (assign with care)',
  },
  {
    permissionId: 'admin.warmpawz_appointments.catalogue.view',
    name: 'Warmpawz Appointments — Catalogue view',
    category: 'Admin Portal — Warmpawz Appointments',
    description: 'View appointment vendor catalogue',
  },
  {
    permissionId: 'admin.warmpawz_appointments.catalogue.create',
    name: 'Warmpawz Appointments — Catalogue create',
    category: 'Admin Portal — Warmpawz Appointments',
    description: 'Add vendors to appointment catalogue',
  },
  {
    permissionId: 'admin.warmpawz_appointments.catalogue.fee.write',
    name: 'Warmpawz Appointments — Fee write',
    category: 'Admin Portal — Warmpawz Appointments',
    description: 'Update appointment fee and bulk fee',
  },
  {
    permissionId: 'admin.warmpawz_appointments.catalogue.publish',
    name: 'Warmpawz Appointments — Publish',
    category: 'Admin Portal — Warmpawz Appointments',
    description: 'Publish appointment catalogue entries',
  },
  {
    permissionId: 'admin.warmpawz_appointments.catalogue.unpublish',
    name: 'Warmpawz Appointments — Unpublish',
    category: 'Admin Portal — Warmpawz Appointments',
    description: 'Unpublish appointment catalogue entries',
  },
  {
    permissionId: 'admin.warmpawz_appointments.catalogue.delete',
    name: 'Warmpawz Appointments — Delete',
    category: 'Admin Portal — Warmpawz Appointments',
    description: 'Delete appointment catalogue entries',
  },
  {
    permissionId: 'admin.warmpawz_appointments.catalogue.bulk',
    name: 'Warmpawz Appointments — Bulk operations',
    category: 'Admin Portal — Warmpawz Appointments',
    description: 'Bulk publish, unpublish, and delete catalogue entries',
  },
  {
    permissionId: 'admin.full_access',
    name: 'Full admin access',
    category: 'Admin Portal — Platform',
    description: 'All admin sections including RBAC',
  },
];

/**
 * Routes that require permissions but are not represented as their own sidebar row.
 * Prefer adding pathPrefixes on ADMIN_PORTAL_NAV_ITEMS when the page maps to a sidebar item.
 */
export const ADMIN_PORTAL_ROUTE_ONLY_RULES: AdminPortalRouteGateRule[] = [
  { pathPrefix: '/enterprise/logic-tab', permission: 'admin.governance' },
  { pathPrefix: '/governance', permission: 'admin.governance' },
  { pathPrefix: '/logistics', permission: 'admin.logistics' },
  { pathPrefix: '/integrations', permission: 'admin.integrations' },
  { pathPrefix: '/webhooks', permission: 'admin.integrations' },
  { pathPrefix: '/notifications', permission: 'admin.integrations' },
  { pathPrefix: '/banners', permission: 'admin.integrations' },
  { pathPrefix: '/tiers', permission: 'admin.integrations' },
  { pathPrefix: '/subscriptions', permission: 'admin.integrations' },
  { pathPrefix: '/sellers', permission: 'admin.vendors' },
  { pathPrefix: '/settlements', permission: 'admin.settlements' },
  { pathPrefix: '/payment-refund', permission: ['admin.settlements', 'admin.logistics'] },
];

/**
 * Admin sidebar entries — keep in sync with UnifiedAdminSidebar labels/order.
 * Add new sidebar items here only; RBAC + route guards derive from this list.
 */
export const ADMIN_PORTAL_NAV_ITEMS: AdminPortalNavItem[] = [
  {
    id: 'analytics',
    label: 'Analytics & Insights',
    permissionId: 'admin.analytics',
    pathPrefixes: ['/analytics'],
    section: 'main',
    sortOrder: 20,
    description: 'Analytics and metrics',
  },
  {
    id: 'product-analytics',
    label: 'Product analytics',
    permissionId: 'admin.analytics',
    pathPrefixes: ['/product-analytics'],
    section: 'main',
    sortOrder: 30,
    description: 'Product analytics dashboards',
  },
  {
    id: 'enterprise',
    label: 'Enterprise & Revenue',
    permissionId: 'admin.governance',
    pathPrefixes: ['/enterprise'],
    section: 'main',
    sortOrder: 40,
    description: 'Enterprise and revenue management',
  },
  {
    id: 'vendors',
    label: 'Vendor Administration',
    permissionId: 'admin.vendors',
    pathPrefixes: ['/vendors'],
    section: 'main',
    sortOrder: 50,
    description: 'Vendors list, approval, and vendor management',
  },
  {
    id: 'customers',
    label: 'Customer Administration',
    permissionId: 'admin.customers',
    pathPrefixes: ['/customers'],
    section: 'main',
    sortOrder: 60,
    description: 'Customer accounts, lifecycle, and insights',
  },
  {
    id: 'ecommerce',
    label: 'E-Commerce',
    permissionId: 'admin.ecommerce',
    pathPrefixes: ['/ecommerce'],
    section: 'main',
    sortOrder: 70,
    description: 'E-commerce and seller setup',
  },
  {
    id: 'warmpawz-pay-catalogue',
    label: 'Warmpawz Pay',
    permissionId: 'admin.warmpawz_pay',
    pathPrefixes: ['/warmpawz-pay'],
    section: 'main',
    sortOrder: 75,
    description: 'Warmpawz Pay vendor catalogue administration',
    routeHint: '/warmpawz-pay',
  },
  {
    id: 'warmpawz-appointments-catalogue',
    label: 'Warmpawz Appointments',
    permissionId: 'admin.warmpawz_appointments',
    permissionsAny: [
      'admin.warmpawz_appointments',
      'admin.warmpawz_appointments.catalogue.view',
    ],
    pathPrefixes: ['/warmpawz-appointments'],
    section: 'main',
    sortOrder: 76,
    description: 'Warmpawz Appointments vendor catalogue and flat-fee booking',
    routeHint: '/warmpawz-appointments/catalogue',
  },
  {
    id: 'shop-refunds',
    label: 'Shop Refunds',
    permissionId: 'admin.ecommerce',
    pathPrefixes: ['/shop-refunds'],
    section: 'main',
    sortOrder: 77,
    description: 'Shop order refunds and retry',
  },
  {
    id: 'regions',
    label: 'Region Manager',
    permissionId: 'admin.platform_settings',
    pathPrefixes: ['/regions'],
    section: 'main',
    sortOrder: 80,
    description: 'Regional configuration',
  },
  {
    id: 'loyalty',
    label: 'Loyalty & Rewards',
    permissionId: 'admin.integrations',
    pathPrefixes: ['/loyalty'],
    section: 'main',
    sortOrder: 90,
    description: 'Loyalty and rewards programs',
  },
  {
    id: 'support',
    label: 'Support & CRM',
    permissionId: 'admin.support',
    pathPrefixes: ['/support'],
    section: 'main',
    sortOrder: 100,
    description: 'Support tickets and CRM',
  },
  {
    id: 'catalog',
    label: 'Catalog & Services',
    permissionId: 'admin.catalog',
    pathPrefixes: ['/catalog', '/problem-grid'],
    section: 'main',
    sortOrder: 110,
    description: 'Service catalog management',
  },
  {
    id: 'database-seeding',
    label: 'Database Seeding',
    permissionId: 'admin.platform_settings',
    pathPrefixes: ['/database-seeding'],
    section: 'main',
    sortOrder: 120,
    description: 'Database seeding tools',
  },
  {
    id: 'events',
    label: 'Event Management',
    permissionId: 'admin.events',
    pathPrefixes: ['/events'],
    section: 'main',
    sortOrder: 130,
    description: 'Events management',
  },
  {
    id: 'content',
    label: 'Content Management',
    permissionId: 'admin.governance',
    pathPrefixes: ['/content'],
    section: 'main',
    sortOrder: 140,
    description: 'Content pages and governance content',
  },
  {
    id: 'pet-info',
    label: 'Pet Info Management',
    permissionId: 'admin.catalog',
    pathPrefixes: ['/pet-info'],
    section: 'main',
    sortOrder: 150,
    description: 'Pet information catalog',
  },
  {
    id: 'finance',
    label: 'Finance & Logistics',
    permissionId: 'admin.settlements',
    permissionsAny: ['admin.settlements', 'admin.logistics'],
    pathPrefixes: ['/finance'],
    section: 'main',
    sortOrder: 160,
    description: 'Finance, settlements, and logistics hub',
  },
  {
    id: 'refunds',
    label: 'Refunds',
    permissionId: 'admin.refunds',
    pathPrefixes: ['/refunds'],
    section: 'main',
    sortOrder: 170,
    description: 'Refunds management',
  },
  {
    id: 'roles',
    label: 'Role & User Management',
    permissionId: 'admin.roles',
    pathPrefixes: ['/roles'],
    section: 'main',
    sortOrder: 180,
    description: 'Create roles, create users, assign roles',
    routeHint: 'RBAC management requires admin.roles (or full admin access).',
  },
  {
    id: 'marketing',
    label: 'Marketing Hub',
    permissionId: 'admin.integrations',
    permissionsAny: ['admin.integrations', 'admin.notifications.view'],
    pathPrefixes: ['/marketing'],
    section: 'marketing-child',
    sortOrder: 190,
    description: 'Banners, spotlight, articles, and dashboard UI configuration',
  },
  {
    id: 'promotions',
    label: 'Promotions',
    permissionId: 'admin.integrations',
    permissionsAny: ['admin.integrations', 'admin.notifications.view'],
    pathPrefixes: ['/promotions'],
    section: 'marketing-child',
    sortOrder: 195,
    description: 'Platform promotions and coupons (Promotion Hub)',
  },
  {
    id: 'marketing-vendor-promotions',
    label: 'Vendor Promotions',
    permissionId: 'admin.integrations',
    permissionsAny: ['admin.integrations', 'admin.notifications.view'],
    pathPrefixes: ['/marketing/vendor-promotions'],
    section: 'marketing-child',
    sortOrder: 196,
    description: 'Service vendor-created promotions and coupons',
  },
  {
    id: 'policy-center',
    label: 'Policy Center',
    permissionId: 'admin.integrations',
    permissionsAny: ['admin.integrations', 'admin.notifications.view'],
    pathPrefixes: ['/policy-center'],
    section: 'marketing-child',
    sortOrder: 197,
    description: 'Discount engine priority, stack, funding, and limit configuration',
  },
  {
    id: 'marketing-analytics',
    label: 'Analytics',
    permissionId: 'admin.integrations',
    permissionsAny: ['admin.integrations', 'admin.notifications.view'],
    pathPrefixes: ['/marketing/analytics'],
    section: 'marketing-child',
    sortOrder: 198,
    description: 'Promotion and coupon analytics (Discount Engine Phase 9)',
  },
  {
    id: 'marketing-campaigns',
    label: 'Campaigns',
    permissionId: 'admin.integrations',
    permissionsAny: ['admin.integrations', 'admin.notifications.view'],
    pathPrefixes: ['/marketing/campaigns'],
    section: 'marketing-child',
    sortOrder: 199,
    description: 'Commercial campaign orchestration (Discount Engine Phase 10)',
  },
  {
    id: 'notification-engine',
    label: 'Notification Engine',
    permissionId: 'admin.notifications.view',
    pathPrefixes: ['/notification-engine'],
    section: 'marketing-child',
    sortOrder: 200,
    description: 'View and manage notification campaigns',
  },
  {
    id: 'reports',
    label: 'Reports',
    permissionId: 'admin.reports',
    pathPrefixes: ['/reports'],
    section: 'footer',
    sortOrder: 210,
    description: 'Reports',
  },
  {
    id: 'platform-settings',
    label: 'Platform Settings',
    permissionId: 'admin.platform_settings',
    pathPrefixes: ['/platform-settings'],
    section: 'footer',
    sortOrder: 220,
    description: 'Platform-wide settings',
  },
];

function navPermissionRequirement(item: AdminPortalNavItem): string | string[] {
  if (item.permissionsAny?.length) return item.permissionsAny;
  return item.permissionId;
}

/** Sorted nav items for sidebar rendering. */
export function getAdminPortalNavItems(): AdminPortalNavItem[] {
  return [...ADMIN_PORTAL_NAV_ITEMS].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getAdminPortalMainNavItems(): AdminPortalNavItem[] {
  return getAdminPortalNavItems().filter((i) => i.section === 'main');
}

export function getAdminPortalFooterNavItems(): AdminPortalNavItem[] {
  return getAdminPortalNavItems().filter((i) => i.section === 'footer');
}

export function getAdminPortalMarketingNavItems(): AdminPortalNavItem[] {
  return getAdminPortalNavItems().filter((i) => i.section === 'marketing-child');
}

/** Capabilities shown in RBAC Create/Edit Role — one row per sidebar item + extras. */
export function getAdminPortalRbacCapabilities(): AdminPortalRbacCapability[] {
  const fromNav: AdminPortalRbacCapability[] = ADMIN_PORTAL_NAV_ITEMS.filter(
    (item) => item.assignable !== false
  ).map((item) => ({
    navKey: item.id,
    permissionId: item.permissionId,
    name: item.label,
    category: 'Admin Portal',
    description: item.description ?? `Access to ${item.label}`,
    permissionsAny: item.permissionsAny,
  }));

  const extras: AdminPortalRbacCapability[] = ADMIN_PORTAL_EXTRA_RBAC_CAPABILITIES.map((cap) => ({
    navKey: cap.permissionId,
    permissionId: cap.permissionId,
    name: cap.name,
    category: cap.category,
    description: cap.description,
  }));

  return [...fromNav, ...extras];
}

/** API shape consumed by GET /admin/admin-capabilities. */
export function getAdminPortalCapabilitiesApiPayload(): {
  id: string;
  permissionId: string;
  navKey: string;
  name: string;
  category: string;
  description: string;
}[] {
  return getAdminPortalRbacCapabilities().map((cap) => ({
    id: cap.permissionId,
    permissionId: cap.permissionId,
    navKey: cap.navKey,
    name: cap.name,
    category: cap.category,
    description: cap.description,
  }));
}

export function getAdminPortalRouteGateRules(): AdminPortalRouteGateRule[] {
  const fromNav: AdminPortalRouteGateRule[] = ADMIN_PORTAL_NAV_ITEMS.flatMap((item) => {
    const permission = navPermissionRequirement(item);
    return (item.pathPrefixes ?? []).map((pathPrefix) => ({
      pathPrefix,
      permission,
      hint: item.routeHint,
    }));
  });

  return [...fromNav, ...ADMIN_PORTAL_ROUTE_ONLY_RULES];
}

export function getAllAdminPermissionIds(): string[] {
  const ids = new Set<string>();
  for (const item of ADMIN_PORTAL_NAV_ITEMS) {
    ids.add(item.permissionId);
    item.permissionsAny?.forEach((p) => ids.add(p));
  }
  for (const cap of ADMIN_PORTAL_EXTRA_RBAC_CAPABILITIES) {
    ids.add(cap.permissionId);
  }
  return [...ids].sort();
}

export function userHasNavPermission(
  userPermissions: string[],
  item: AdminPortalNavItem
): boolean {
  if (userPermissions.includes('admin.full_access') || userPermissions.includes('*')) {
    return true;
  }
  if (item.permissionsAny?.length) {
    return item.permissionsAny.some((p) => userPermissions.includes(p));
  }
  return userPermissions.includes(item.permissionId);
}

/**
 * First sidebar-linked route the user may open after login (never returns `/` — login shell).
 */
export function getFirstAllowedAdminRoute(userPermissions: string[]): string | null {
  if (!userPermissions.length) return null;
  for (const item of getAdminPortalNavItems()) {
    const path = item.pathPrefixes?.[0];
    if (!path || path === '/') continue;
    if (userHasNavPermission(userPermissions, item)) {
      return path;
    }
  }
  return null;
}

export function adminPortalNavItemVisible(
  item: AdminPortalNavItem,
  userPermissions: string[]
): boolean {
  if (userPermissions.includes('admin.full_access') || userPermissions.includes('*')) {
    return true;
  }
  const required = navPermissionRequirement(item);
  const need = Array.isArray(required) ? required : [required];
  return need.some((p) => userPermissions.includes(p));
}

const SORTED_ROUTE_RULES = [...getAdminPortalRouteGateRules()].sort(
  (a, b) => b.pathPrefix.length - a.pathPrefix.length
);

export function getAdminPortalRouteGateRule(pathname: string): AdminPortalRouteGateRule | null {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  for (const rule of SORTED_ROUTE_RULES) {
    if (p === rule.pathPrefix || p.startsWith(`${rule.pathPrefix}/`)) {
      return rule;
    }
  }
  return null;
}

export function formatAdminRouteRequiredPermissions(rule: AdminPortalRouteGateRule): string {
  const perm = rule.permission;
  if (typeof perm === 'string') return perm;
  return perm.join(' · ');
}
