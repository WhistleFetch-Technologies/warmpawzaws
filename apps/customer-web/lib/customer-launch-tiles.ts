import {
  mapCatalogCategoryIdToCustomerHomeScreen,
  mapCatalogSlugToLaunchServiceId,
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
  /** Catalog `service_categories.category_id` row this launch service is tied to (from admin launch config). */
  categoryId?: string;
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

/**
 * Launch tiles may only appear when the admin catalog still has an active category row backing them.
 * Uses launch config `categoryId` when present; otherwise any active pool tile mapped to the launch id.
 */
export function hasActiveCatalogBackingForLaunch(
  entry: Pick<LaunchCatalogEntry, 'serviceId' | 'categoryId'>,
  tilePool: QuickServiceTile[]
): boolean {
  const poolCategoryIds = new Set(
    tilePool.map((t) => normalizeServiceKey(t.categoryId || '')).filter(Boolean)
  );
  if (!poolCategoryIds.size) return false;

  const pinnedCategoryId = normalizeServiceKey(entry.categoryId);
  if (pinnedCategoryId) {
    if (poolCategoryIds.has(pinnedCategoryId)) return true;
    const pinnedLaunchId = normalizeServiceKey(mapCatalogSlugToLaunchServiceId(pinnedCategoryId));
    return [...poolCategoryIds].some(
      (poolCatId) => normalizeServiceKey(mapCatalogSlugToLaunchServiceId(poolCatId)) === pinnedLaunchId
    );
  }

  const launchId = normalizeServiceKey(entry.serviceId);
  return [...poolCategoryIds].some(
    (catalogId) => normalizeServiceKey(mapCatalogSlugToLaunchServiceId(catalogId)) === launchId
  );
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
      categoryId: c.categoryId,
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

    if (!hasActiveCatalogBackingForLaunch(entry, allTilePool)) continue;

    const preferScreen = mapLaunchServiceIdToAllServicesTileScreen(svcId);
    const matchingTile = findMatchingTileForLaunchId(svcId, allTilePool, {
      preferTileScreen: preferScreen,
    });
    if (!matchingTile) continue;

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
