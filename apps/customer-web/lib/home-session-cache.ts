import { quickServices } from '@/components/customer/homepage/constants';

const PREFIX = 'warmpawz_home_';

function scopedKey(phone: string, suffix: string): string {
  const clean = (phone || '').replace(/\D/g, '') || 'guest';
  return `${PREFIX}${clean}_${suffix}`;
}

export function readHomeSessionCache<T>(phone: string, suffix: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(scopedKey(phone, suffix));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeHomeSessionCache(phone: string, suffix: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(scopedKey(phone, suffix), JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export interface CachedLaunchTile {
  screen: string;
  categoryId?: string;
  label?: string;
  color?: string;
  isComingSoon?: boolean;
}

export interface CachedHomeDynamicContent {
  dynamicBanners?: Record<string, unknown>[];
  dynamicMiddleBanners?: Record<string, unknown>[];
  dynamicLowerBanners?: Record<string, unknown>[];
  dynamicArticles?: Record<string, unknown>[];
  dynamicAnnouncements?: Record<string, unknown>[];
  adoptionStats?: { adoptablePets: number; rehomingListings: number };
}

export interface CachedHomeServices {
  groomingServices?: Record<string, unknown>[];
  vetServicesData?: Record<string, unknown>[];
  hotDeals?: Record<string, unknown>[];
}

/** Reattach React icon components from the static quick-service catalog. */
export function rehydrateLaunchTilesFromCache(
  cached: CachedLaunchTile[] | undefined,
  extraPool: Array<Record<string, unknown>> = []
): Record<string, unknown>[] {
  if (!cached?.length) return [];
  const pool = [...extraPool, ...quickServices];
  const result: Record<string, unknown>[] = [];
  for (const entry of cached) {
    const screen = String(entry.screen || '').toLowerCase();
    const catId = String(entry.categoryId || '').toLowerCase();
    const match = pool.find((tile) => {
      const tScreen = String(tile.screen || '').toLowerCase();
      const tCat = String(tile.categoryId || '').toLowerCase();
      return (screen && tScreen === screen) || (catId && tCat === catId);
    });
    if (!match) continue;
    result.push({
      ...match,
      label: entry.label || match.label,
      color: entry.color || match.color,
      isComingSoon: entry.isComingSoon ?? ('isComingSoon' in match ? Boolean(match.isComingSoon) : undefined),
    });
  }
  return result;
}

export function serializeLaunchTiles(tiles: Array<Record<string, unknown>>): CachedLaunchTile[] {
  return tiles.map((t) => ({
    screen: String(t.screen || ''),
    categoryId: t.categoryId != null ? String(t.categoryId) : undefined,
    label: t.label != null ? String(t.label) : undefined,
    color: t.color != null ? String(t.color) : undefined,
    isComingSoon: Boolean(t.isComingSoon),
  }));
}

const GLOBAL_TRENDING_KEY = `${PREFIX}global_trending`;

export function readTrendingCache<T>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(GLOBAL_TRENDING_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeTrendingCache(data: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(GLOBAL_TRENDING_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}
