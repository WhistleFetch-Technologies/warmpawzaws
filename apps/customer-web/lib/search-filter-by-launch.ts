import {
  launchServiceIdFromCategory,
  getCatalogEntry,
  hasAnyLaunchedStyle,
  isStyleLaunchedForCustomer,
  type ServiceLaunchCatalogEntry,
} from '@/lib/customer-service-style-launch';
import { normalizeServiceStyleLaunchKey } from '@warmpawz/service-launch-mappings';
import { resolveStyleLaunchTargetForScreen } from '@/lib/customer-style-screen-launch';

function normalizeRowStyle(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  return normalizeServiceStyleLaunchKey(String(raw));
}

export function isSearchRowLaunchedForCustomer(
  catalog: ServiceLaunchCatalogEntry[],
  row: {
    category?: string;
    serviceType?: string;
    service_style?: string;
    serviceStyle?: string;
    type?: string;
    screen?: string;
    data?: Record<string, unknown>;
  }
): boolean {
  if (!catalog.length) return true;

  const category = String(
    row.category || row.serviceType || row.data?.categoryId || ''
  ).trim();
  const serviceId = launchServiceIdFromCategory(category);
  if (!serviceId || serviceId === 'unknown') return true;

  const explicitStyle =
    normalizeRowStyle(row.service_style) ||
    normalizeRowStyle(row.serviceStyle) ||
    normalizeRowStyle(row.data?.serviceStyle);

  if (explicitStyle) {
    return isStyleLaunchedForCustomer(catalog, serviceId, explicitStyle);
  }

  if (row.type === 'symptom' && row.data) {
    const styles = row.data.allowedServiceStyles;
    if (Array.isArray(styles) && styles.length > 0) {
      return styles.some((s) =>
        isStyleLaunchedForCustomer(catalog, serviceId, String(s))
      );
    }
  }

  const screen = String(row.screen || row.data?.screen || '').trim();
  if (screen) {
    const target = resolveStyleLaunchTargetForScreen(screen, row.data);
    if (target) {
      return isStyleLaunchedForCustomer(catalog, target.serviceId, target.serviceStyle);
    }
  }

  // Vendor rows from GET /search omit serviceStyle — keep when any style is launched for the hub
  // (do not assume at_center; Services tiles use the same parent-level visibility rule).
  if (!getCatalogEntry(catalog, serviceId)) return true;
  return hasAnyLaunchedStyle(catalog, serviceId);
}

export function filterSearchRowsByLaunch<T extends Record<string, unknown>>(
  catalog: ServiceLaunchCatalogEntry[],
  rows: T[]
): T[] {
  if (!catalog.length) return rows;
  return rows.filter((row) => isSearchRowLaunchedForCustomer(catalog, row as any));
}
