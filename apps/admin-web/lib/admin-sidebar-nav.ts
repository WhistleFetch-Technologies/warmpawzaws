import { getAdminPortalNavItems, getFirstAllowedAdminRoute } from '@warmpawz/shared-types';
import { getStoredAdminPermissions } from './admin-permissions';

/** Map UnifiedAdminSidebar view id → app route (no dead /dashboard or bare /). */
export function hrefForAdminSidebarView(view: string): string {
  if (view === 'customer-admin') return '/customers';
  if (view === 'vendor-admin' || view === 'vendor-management') return '/vendors';
  if (view === 'catalog-and-services') return '/catalog';
  if (view === 'region-manager') return '/regions';
  if (view === 'warmpawz-pay-catalogue') return '/warmpawz-pay';

  const item = getAdminPortalNavItems().find((i) => i.id === view);
  if (item?.routeHint?.startsWith('/')) return item.routeHint;
  const path = item?.pathPrefixes?.[0];
  if (path) return path;

  return getFirstAllowedAdminRoute(getStoredAdminPermissions()) ?? '/';
}
