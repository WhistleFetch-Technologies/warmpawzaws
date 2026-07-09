import {
  launchServiceIdFromCategory,
  isStyleLaunchedForCustomer,
  type ServiceLaunchCatalogEntry,
} from '@/lib/customer-service-style-launch';
import { normalizeServiceStyleLaunchKey } from '@warmpawz/service-launch-mappings';
import { hubSlugToDiscoveryContext } from '@/lib/search-hub-style-defaults';
import { resolveStyleLaunchTargetForScreen } from '@/lib/customer-style-screen-launch';

function defaultStyleForCategory(category: string | undefined | null): string | null {
  const hub = hubSlugToDiscoveryContext(category || '');
  return hub?.serviceStyle ?? null;
}

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

  const fallbackStyle = defaultStyleForCategory(category);
  if (fallbackStyle) {
    return isStyleLaunchedForCustomer(catalog, serviceId, fallbackStyle);
  }

  return true;
}

export function filterSearchRowsByLaunch<T extends Record<string, unknown>>(
  catalog: ServiceLaunchCatalogEntry[],
  rows: T[]
): T[] {
  if (!catalog.length) return rows;
  return rows.filter((row) => isSearchRowLaunchedForCustomer(catalog, row as any));
}
