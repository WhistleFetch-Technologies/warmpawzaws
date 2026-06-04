import {
  mapCatalogCategoryIdToCustomerHomeScreen,
  mapLaunchServiceIdToAllServicesTileScreen,
  mapLaunchServiceIdToCustomerHomeScreen,
  normalizeServiceKey,
  serviceScreenMap,
} from '@warmpawz/service-launch-mappings';
import type { QuickServiceTile } from '@/components/customer/home/types';

/** Placeholder when synthesizing a tile without a catalog icon. */
const FallbackServiceIcon = () => null;

export type LaunchStatusBucket = 'launched' | 'beta' | 'coming_soon' | 'hidden';

export interface LaunchCatalogEntry {
  serviceId: string;
  displayName?: string;
  effectiveStatus?: LaunchStatusBucket | string;
}

export interface LaunchBucketEntry {
  serviceId?: string;
  status?: string;
}

export interface BuildCustomerLaunchTilesOptions {
  tilePool: QuickServiceTile[];
  /** Full admin-aligned catalog (preferred). */
  catalog?: LaunchCatalogEntry[];
  visible?: LaunchBucketEntry[];
  comingSoon?: LaunchBucketEntry[];
  hidden?: LaunchBucketEntry[];
  /** All Services: show geo-hidden tiles as non-navigable Soon. */
  includeHiddenAsComingSoon?: boolean;
  /** All Services: one tile per launch serviceId (diagnostics + vet both show). */
  dedupeByLaunchServiceId?: boolean;
}

function screensForLaunchId(launchId: string): string[] {
  const key = normalizeServiceKey(launchId);
  const fromMap = serviceScreenMap[key];
  if (fromMap?.length) return [...fromMap];
  const tile = mapLaunchServiceIdToAllServicesTileScreen(launchId);
  const home = mapLaunchServiceIdToCustomerHomeScreen(launchId);
  const out = new Set<string>();
  if (tile) out.add(tile);
  if (home && home !== tile) out.add(home);
  if (!out.size && key) out.add(key);
  return [...out];
}

export function findMatchingTileForLaunchId(
  svcIdRaw: string,
  allTilePool: QuickServiceTile[],
  options?: { preferTileScreen?: string }
): QuickServiceTile | undefined {
  const svcId = normalizeServiceKey(svcIdRaw);
  const targetScreens = new Set(
    [
      options?.preferTileScreen,
      mapLaunchServiceIdToAllServicesTileScreen(svcId),
      mapLaunchServiceIdToCustomerHomeScreen(svcId),
      ...screensForLaunchId(svcId),
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase())
  );

  if (options?.preferTileScreen) {
    const prefer = normalizeServiceKey(options.preferTileScreen);
    const direct = allTilePool.find((tile) => normalizeServiceKey(tile.screen || '') === prefer);
    if (direct) return direct;
  }

  return allTilePool.find((tile) => {
    const catId = normalizeServiceKey(tile.categoryId || '');
    const tileScreen = normalizeServiceKey(tile.screen || '');
    const catalogScreen = normalizeServiceKey(
      mapCatalogCategoryIdToCustomerHomeScreen(tile.categoryId || '')
    );
    const screenAsCatalog = normalizeServiceKey(
      mapCatalogCategoryIdToCustomerHomeScreen(tile.screen || '')
    );
    const launchFromCat = normalizeServiceKey(
      mapLaunchServiceIdToCustomerHomeScreen(tile.categoryId || '')
    );

    if (catId === svcId || tileScreen === svcId) return true;
    for (const target of targetScreens) {
      if (
        catalogScreen === target ||
        screenAsCatalog === target ||
        launchFromCat === target ||
        tileScreen === target
      ) {
        return true;
      }
    }
    return false;
  });
}

function synthesizeTileForLaunchEntry(entry: LaunchCatalogEntry): QuickServiceTile {
  const serviceId = normalizeServiceKey(entry.serviceId);
  const screen = mapLaunchServiceIdToAllServicesTileScreen(serviceId) || serviceId;
  return {
    icon: FallbackServiceIcon,
    label: entry.displayName?.trim() || serviceId,
    color: 'bg-gray-100 text-gray-600',
    screen,
    categoryId: serviceId,
  };
}

function isLaunchedStatus(status: string | undefined): boolean {
  return status === 'launched' || status === 'beta';
}

function orderedLaunchEntries(options: BuildCustomerLaunchTilesOptions): Array<{
  serviceId: string;
  displayName?: string;
  effectiveStatus: string;
}> {
  if (options.catalog?.length) {
    return options.catalog.map((c) => ({
      serviceId: c.serviceId,
      displayName: c.displayName,
      effectiveStatus: String(c.effectiveStatus || 'hidden'),
    }));
  }

  const out: Array<{ serviceId: string; displayName?: string; effectiveStatus: string }> = [];
  for (const e of options.visible || []) {
    if (e.serviceId) out.push({ serviceId: e.serviceId, effectiveStatus: e.status || 'launched' });
  }
  for (const e of options.comingSoon || []) {
    if (e.serviceId) out.push({ serviceId: e.serviceId, effectiveStatus: 'coming_soon' });
  }
  if (options.includeHiddenAsComingSoon) {
    for (const e of options.hidden || []) {
      if (e.serviceId) out.push({ serviceId: e.serviceId, effectiveStatus: 'hidden' });
    }
  }
  return out;
}

/**
 * Builds customer home / All Services tiles from launch config + category tile pool.
 */
export function buildCustomerLaunchTiles(
  options: BuildCustomerLaunchTilesOptions
): QuickServiceTile[] {
  const entries = orderedLaunchEntries(options);
  if (!entries.length) return [];

  const allTilePool = options.tilePool;
  const seen = new Set<string>();
  const resultTiles: QuickServiceTile[] = [];

  for (const entry of entries) {
    const svcId = normalizeServiceKey(entry.serviceId);
    if (!svcId || svcId === 'general' || svcId === 'unknown') continue;

    const status = entry.effectiveStatus;
    if (status === 'hidden' && !options.includeHiddenAsComingSoon) continue;

    const isComingSoon =
      status === 'coming_soon' || (status === 'hidden' && options.includeHiddenAsComingSoon);

    if (!isLaunchedStatus(status) && !isComingSoon) continue;

    const preferScreen = mapLaunchServiceIdToAllServicesTileScreen(svcId);
    let matchingTile = findMatchingTileForLaunchId(svcId, allTilePool, {
      preferTileScreen: preferScreen,
    });
    if (!matchingTile) {
      matchingTile = synthesizeTileForLaunchEntry({
        serviceId: svcId,
        displayName: entry.displayName,
      });
    }

    const dedupeKey = options.dedupeByLaunchServiceId
      ? svcId
      : normalizeServiceKey(matchingTile.screen || preferScreen || svcId);

    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    resultTiles.push({
      ...matchingTile,
      label: entry.displayName?.trim() || matchingTile.label,
      screen: preferScreen || matchingTile.screen,
      categoryId: matchingTile.categoryId || svcId,
      isComingSoon,
      launchServiceId: svcId,
    } as QuickServiceTile & { launchServiceId?: string });
  }

  return resultTiles;
}
