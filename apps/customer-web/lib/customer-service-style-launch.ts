'use client';

import {
  isComingSoonLaunchStatus,
  isLaunchedLaunchStatus,
  mapCatalogSlugToLaunchServiceId,
  normalizeServiceKey,
  normalizeServiceStyleLaunchKey,
  supportedStylesForLaunchServiceId,
  type LaunchStatusValue,
  type ServiceStyleLaunchKey,
} from '@warmpawz/service-launch-mappings';
import { apiClient } from '@/lib/api-client';
import { resolveCustomerLocation, type CustomerLocation } from '@/lib/customer-location';

export type StyleLaunchEntry = {
  effectiveStatus: LaunchStatusValue;
  effectiveRolloutPercentage?: number;
  inheritsParent?: boolean;
};

export type ServiceLaunchCatalogEntry = {
  serviceId: string;
  effectiveStatus?: LaunchStatusValue;
  supportedStyles?: ServiceStyleLaunchKey[];
  effectiveStyles?: Partial<Record<ServiceStyleLaunchKey, StyleLaunchEntry>>;
};

type LaunchCache = {
  locationKey: string;
  catalog: ServiceLaunchCatalogEntry[];
};

let cache: LaunchCache | null = null;
let inflight: Promise<LaunchCache | null> | null = null;
/** False when the last catalog fetch failed (401/network) — browse tiles stay visible. */
let lastCatalogFetchOk = false;

function locationKey(loc: CustomerLocation): string {
  return `${loc.state}|${loc.city}`.toLowerCase();
}

export function catalogByServiceId(
  catalog: ServiceLaunchCatalogEntry[]
): Map<string, ServiceLaunchCatalogEntry> {
  const map = new Map<string, ServiceLaunchCatalogEntry>();
  for (const entry of catalog) {
    const id = normalizeServiceKey(entry.serviceId);
    if (id) map.set(id, entry);
  }
  return map;
}

export function getCatalogEntry(
  catalog: ServiceLaunchCatalogEntry[],
  serviceId: string
): ServiceLaunchCatalogEntry | undefined {
  // Map category aliases (nutrition → nutritionist) to catalog keys before lookup.
  return catalogByServiceId(catalog).get(launchServiceIdFromCategory(serviceId));
}

/** True when style is launched or beta for the customer's resolved geo catalog. */
export function isStyleLaunchedForCustomer(
  catalog: ServiceLaunchCatalogEntry[],
  serviceId: string,
  serviceStyle: string
): boolean {
  const { status } = resolveServiceStyleLaunchFromCatalog(catalog, serviceId, serviceStyle);
  return isLaunchedLaunchStatus(status);
}

/** Parent tile visible when any supported style (or parent-only service) is launched/beta. */
export function hasAnyLaunchedStyle(
  catalog: ServiceLaunchCatalogEntry[],
  serviceId: string
): boolean {
  const svcKey = launchServiceIdFromCategory(serviceId);
  const entry = getCatalogEntry(catalog, svcKey);
  if (!entry) return false;

  const supported =
    entry.supportedStyles && entry.supportedStyles.length > 0
      ? entry.supportedStyles
      : supportedStylesForLaunchServiceId(svcKey);

  if (!supported.length) {
    return isLaunchedLaunchStatus(entry.effectiveStatus ?? 'hidden');
  }

  return supported.some((style) => isStyleLaunchedForCustomer(catalog, svcKey, style));
}

export type StyleLaunchFilterable = {
  launchServiceId?: string;
  serviceStyle?: string;
  discoverCategory?: string;
  category?: string;
};

/** Drop rows tied to a hidden style; keep parent-only / tele when launched. */
export function filterEntriesByStyleLaunch<T extends StyleLaunchFilterable>(
  catalog: ServiceLaunchCatalogEntry[],
  entries: T[]
): T[] {
  if (!catalog.length) return entries;
  return entries.filter((entry) => {
    const serviceId = normalizeServiceKey(
      entry.launchServiceId ||
        mapCatalogSlugToLaunchServiceId(entry.discoverCategory || entry.category || '')
    );
    const style = entry.serviceStyle;
    if (!style) {
      return hasAnyLaunchedStyle(catalog, serviceId);
    }
    return isStyleLaunchedForCustomer(catalog, serviceId, style);
  });
}

export function launchServiceIdFromCategory(category: string | undefined | null): string {
  return normalizeServiceKey(mapCatalogSlugToLaunchServiceId(String(category || '').trim()));
}

export async function loadCustomerServiceLaunchCatalog(
  phone: string,
  force = false
): Promise<ServiceLaunchCatalogEntry[]> {
  const location = await resolveCustomerLocation(phone);
  const key = locationKey(location);
  if (!force && cache && cache.locationKey === key) {
    return cache.catalog;
  }

  if (!force && inflight) {
    const pending = await inflight;
    return pending?.catalog || [];
  }

  inflight = (async (): Promise<LaunchCache | null> => {
    try {
      const params = new URLSearchParams();
      if (location.state) params.set('state', location.state);
      if (location.city) params.set('city', location.city);
      const res = await apiClient
        .get(`/config/service-launch/customer?${params.toString()}`)
        .catch(() => null);
      if (!res || (res as { success?: boolean }).success === false) {
        lastCatalogFetchOk = false;
        return null;
      }
      lastCatalogFetchOk = true;
      const catalog = ((res as any)?.services?.catalog || []) as ServiceLaunchCatalogEntry[];
      cache = { locationKey: key, catalog };
      return cache;
    } catch {
      lastCatalogFetchOk = false;
      return null;
    } finally {
      inflight = null;
    }
  })();

  const loaded = await inflight;
  return loaded?.catalog || [];
}

export function resolveServiceStyleLaunchFromCatalog(
  catalog: ServiceLaunchCatalogEntry[],
  serviceId: string,
  serviceStyle: string
): { status: LaunchStatusValue; inheritsParent: boolean } {
  const style = normalizeServiceStyleLaunchKey(serviceStyle);
  // Always resolve via launch-id aliases so category="nutrition" hits catalog "nutritionist".
  const svcKey = launchServiceIdFromCategory(serviceId);
  const entry = catalogByServiceId(catalog).get(svcKey);
  const parentStatus = (entry?.effectiveStatus || 'hidden') as LaunchStatusValue;

  if (!style || !entry?.effectiveStyles?.[style]) {
    return { status: parentStatus, inheritsParent: true };
  }

  const styleEntry = entry.effectiveStyles[style]!;
  return {
    status: styleEntry.effectiveStatus || parentStatus,
    inheritsParent: styleEntry.inheritsParent !== false,
  };
}

export async function resolveServiceStyleLaunch(
  phone: string,
  serviceId: string,
  serviceStyle: string
): Promise<{ status: LaunchStatusValue; inheritsParent: boolean }> {
  const catalog = await loadCustomerServiceLaunchCatalog(phone);
  return resolveServiceStyleLaunchFromCatalog(catalog, serviceId, serviceStyle);
}

/** Parent service tile must be launched/beta/coming_soon-visible; style gates navigation inside hub. */
export function isServiceStyleNavigable(status: LaunchStatusValue): boolean {
  return isLaunchedLaunchStatus(status);
}

export function isServiceStyleComingSoon(status: LaunchStatusValue): boolean {
  return isComingSoonLaunchStatus(status);
}

export function isServiceStyleHidden(status: LaunchStatusValue): boolean {
  return status === 'hidden';
}

/** Hide hub tiles only when catalog loaded successfully; failed fetch keeps tiles for guest browse. */
export function isServiceStyleHiddenForBrowse(status: LaunchStatusValue): boolean {
  if (!lastCatalogFetchOk) return false;
  return isServiceStyleHidden(status);
}

export const SERVICE_STYLE_LAUNCH_BLOCKED_MESSAGE =
  'This service is coming soon in your area.';

export const SERVICE_STYLE_HIDDEN_MESSAGE = 'This service is not available in your area.';

/** Launched/beta → allow navigation; vendor discovery empty state handles zero providers. */
export function shouldBlockServiceStyleNavigation(status: LaunchStatusValue): boolean {
  return isServiceStyleHidden(status) || isServiceStyleComingSoon(status);
}

export function serviceStyleLaunchBlockMessage(status: LaunchStatusValue): string {
  if (isServiceStyleComingSoon(status)) return SERVICE_STYLE_LAUNCH_BLOCKED_MESSAGE;
  if (isServiceStyleHidden(status)) return SERVICE_STYLE_HIDDEN_MESSAGE;
  return '';
}

export function clearCustomerServiceLaunchCache(): void {
  cache = null;
  inflight = null;
  lastCatalogFetchOk = false;
}

/** Returns true when navigation may proceed (launched/beta). False when hidden/coming_soon. */
export async function gateServiceStyleNavigation(
  phone: string,
  serviceId: string,
  serviceStyle: string,
  notify: (message: string) => void = () => {}
): Promise<boolean> {
  if (!lastCatalogFetchOk) return true;
  const { status } = await resolveServiceStyleLaunch(phone, serviceId, serviceStyle);
  if (shouldBlockServiceStyleNavigation(status)) {
    notify(serviceStyleLaunchBlockMessage(status));
    return false;
  }
  return true;
}
