/**
 * Single coordinator for customer home critical / dynamic / deferred loading.
 * Paint from cache first; one in-flight refresh per phone (deduped via api-client GET map).
 */

import { apiClient } from '@/lib/api-client';
import { resolveCustomerLocation } from '@/lib/customer-location';
import type { CustomerLocation } from '@/lib/customer-location';
import {
  HOME_CRITICAL_GET_RETRY,
  HOME_CRITICAL_TIMEOUT_MS,
  parsePetsFromApiResponse,
  readCachedProfileName,
} from '@/components/customer/home/hooks/useHomePageData';
import {
  readCachedPetsForPhone,
  writeCachedPetsForPhone,
} from '@/lib/customer-pets-cache';
import type { Pet } from '@/components/customer/homepage/constants/interface';
import {
  readHomeSessionCache,
  writeHomeSessionCache,
  type CachedHomeDynamicContent,
} from '@/lib/home-session-cache';
import { scheduleIdleWork } from '@/lib/schedule-idle';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { applyUnifiedProfileToCustomerLocalStorage } from '@/lib/customer-flow-guards';

let activePhone: string | null = null;
let criticalInflight: Promise<{ profile: Record<string, unknown> | null; pets: Pet[] }> | null =
  null;
let bootstrapReadyPromise: Promise<void> | null = null;
let bootstrapReadyResolve: (() => void) | null = null;
let lastCriticalRefresh: {
  phone: string;
  at: number;
  result: { profile: Record<string, unknown> | null; pets: Pet[] };
} | null = null;

const CRITICAL_REFRESH_COOLDOWN_MS = 30_000;

function ensureBootstrapReadyPromise(): Promise<void> {
  if (!bootstrapReadyPromise) {
    bootstrapReadyPromise = new Promise<void>((resolve) => {
      bootstrapReadyResolve = resolve;
    });
  }
  return bootstrapReadyPromise;
}

function markBootstrapReady(): void {
  if (bootstrapReadyResolve) {
    bootstrapReadyResolve();
    bootstrapReadyResolve = null;
  }
}

export function resetHomeBootstrapForPhone(phone: string | null): void {
  activePhone = phone;
  criticalInflight = null;
  bootstrapReadyPromise = null;
  bootstrapReadyResolve = null;
  if (!phone) {
    lastCriticalRefresh = null;
  }
  if (phone) {
    ensureBootstrapReadyPromise();
  }
}

/** Resolves when critical profile + pets refresh has completed (or failed gracefully). */
export function getHomeBootstrapReady(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!activePhone && !bootstrapReadyPromise) return Promise.resolve();
  return ensureBootstrapReadyPromise();
}

export function readCachedCustomerProfile(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('customerData');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function readCachedCustomerPets(): Pet[] {
  const phone =
    typeof window !== 'undefined'
      ? localStorage.getItem('customerPhone') ||
        localStorage.getItem('customer_phone') ||
        localStorage.getItem('phone')
      : null;
  return readCachedPetsForPhone(phone);
}

function persistProfileToLocalStorage(profile: Record<string, unknown>, phone: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readCachedCustomerProfile() ?? {};
    const { pets: _profilePets, ...profileWithoutPets } = profile;
    const { pets: _existingPets, ...existingWithoutPets } = existing;
    const merged = { ...existingWithoutPets, ...profileWithoutPets, phone };
    localStorage.setItem('customerData', JSON.stringify(merged));
    persistCustomerDatabaseId(merged);
  } catch {
    /* ignore */
  }
}

async function fetchProfileAndPets(phone: string): Promise<{
  profile: Record<string, unknown> | null;
  pets: Pet[];
}> {
  const [profileResult, petsResult] = await Promise.allSettled([
    apiClient.get(
      `/customer/profile?phone=${encodeURIComponent(phone)}`,
      HOME_CRITICAL_GET_RETRY,
      HOME_CRITICAL_TIMEOUT_MS
    ),
    apiClient.get(
      `/customer/pets/${encodeURIComponent(phone)}`,
      HOME_CRITICAL_GET_RETRY,
      HOME_CRITICAL_TIMEOUT_MS
    ),
  ]);

  let profile: Record<string, unknown> | null = readCachedCustomerProfile();
  let pets: Pet[] = readCachedPetsForPhone(phone);

  if (profileResult.status === 'fulfilled') {
    const profileResp = profileResult.value as Record<string, unknown>;
    if (profileResp && (profileResp.success || profileResp.profile)) {
      profile = (profileResp.profile || profileResp) as Record<string, unknown>;
      persistProfileToLocalStorage(profile, phone);
    }
  }

  if (petsResult.status === 'fulfilled') {
    pets = parsePetsFromApiResponse(petsResult.value);
    writeCachedPetsForPhone(phone, pets);
  }

  return { profile, pets };
}

/** Non-critical: enrich localStorage from unified profile after critical profile+pets refresh. */
function scheduleUnifiedProfileEnrichment(phone: string): void {
  void apiClient
    .getOrUndefinedIfNotFound<{ profile?: Record<string, unknown> }>(
      `/customer/profile/unified/${encodeURIComponent(phone)}`
    )
    .then((resp) => {
      const unified = resp?.profile;
      if (!unified) return;
      const cachedPets = readCachedPetsForPhone(phone);
      const merged: Record<string, unknown> = { ...unified, phone };
      if (cachedPets.length > 0) {
        merged.pets = cachedPets;
      }
      persistProfileToLocalStorage(merged, phone);
      applyUnifiedProfileToCustomerLocalStorage(
        unified,
        phone.replace(/\D/g, '').slice(-10)
      );
    })
    .catch(() => {
      /* optional background enrichment */
    });
}

/**
 * Returns cached profile/pets immediately; starts one shared refresh if needed.
 */
export function ensureCustomerProfileAndPets(
  phone: string,
  options?: { force?: boolean }
): {
  profile: Record<string, unknown> | null;
  pets: Pet[];
  refreshPromise: Promise<{ profile: Record<string, unknown> | null; pets: Pet[] }>;
} {
  if (typeof window === 'undefined') {
    return {
      profile: null,
      pets: [],
      refreshPromise: Promise.resolve({ profile: null, pets: [] }),
    };
  }

  if (activePhone !== phone || options?.force) {
    if (options?.force && activePhone === phone) {
      criticalInflight = null;
      bootstrapReadyPromise = null;
      bootstrapReadyResolve = null;
    }
    resetHomeBootstrapForPhone(phone);
    activePhone = phone;
    ensureBootstrapReadyPromise();
  }

  const cached = {
    profile: readCachedCustomerProfile(),
    pets: readCachedCustomerPets(),
  };

  const recent =
    !options?.force &&
    lastCriticalRefresh?.phone === phone &&
    Date.now() - lastCriticalRefresh.at < CRITICAL_REFRESH_COOLDOWN_MS
      ? lastCriticalRefresh.result
      : null;

  if (recent && !criticalInflight) {
    markBootstrapReady();
    return {
      ...cached,
      profile: recent.profile ?? cached.profile,
      pets: recent.pets.length > 0 ? recent.pets : cached.pets,
      refreshPromise: Promise.resolve(recent),
    };
  }

  if (!criticalInflight) {
    criticalInflight = fetchProfileAndPets(phone)
      .then((result) => {
        lastCriticalRefresh = { phone, at: Date.now(), result };
        scheduleUnifiedProfileEnrichment(phone);
        return result;
      })
      .catch(() => ({
        profile: readCachedCustomerProfile(),
        pets: readCachedCustomerPets(),
      }))
      .finally(() => {
        markBootstrapReady();
        criticalInflight = null;
      });
  }

  return {
    ...cached,
    refreshPromise: criticalInflight,
  };
}

function dedupeBannerList(rawList: unknown[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  return (rawList as unknown[]).filter((item) => {
    const id =
      item && typeof item === 'object' && 'id' in item && (item as { id: unknown }).id != null
        ? String((item as { id: unknown }).id)
        : '';
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }) as Record<string, unknown>[];
}

/** Read session cache, then refresh banners / articles / announcements / adoption stats. */
export async function refreshHomeDynamicContent(
  phone: string,
  location?: CustomerLocation
): Promise<CachedHomeDynamicContent> {
  const cached =
    readHomeSessionCache<CachedHomeDynamicContent>(phone, 'dynamic_content') ?? {};
  const loc = location ?? (await resolveCustomerLocation(phone));
  const { city: customerCity, state: customerState } = loc;

  const bannerQuery = new URLSearchParams({ limit: '20' });
  if (customerState) bannerQuery.append('state', customerState);
  if (customerCity) bannerQuery.append('city', customerCity);
  const homeTopQuery = new URLSearchParams(bannerQuery);
  homeTopQuery.append('position', 'home_top');
  const homeMiddleQuery = new URLSearchParams(bannerQuery);
  homeMiddleQuery.append('position', 'home_middle');
  const homeLowerQuery = new URLSearchParams(bannerQuery);
  homeLowerQuery.append('position', 'home_lower');

  const [bannersResp, middleBannersResp, lowerBannersResp, articlesResp, announcementsResp, adoptionResp] =
    await Promise.allSettled([
      apiClient.get(`/customer/banners?${homeTopQuery.toString()}`),
      apiClient.get(`/customer/banners?${homeMiddleQuery.toString()}`),
      apiClient.get(`/customer/banners?${homeLowerQuery.toString()}`),
      apiClient.getCustomerArticlesList('/customer/articles?limit=3'),
      apiClient.get('/customer/announcements?limit=3'),
      apiClient.get('/customer/adoption-stats'),
    ]);

  const extractBanners = (resp: PromiseSettledResult<unknown>): Record<string, unknown>[] => {
    if (resp.status !== 'fulfilled') return [];
    const v = resp.value as Record<string, unknown> | null | undefined;
    const rawList =
      (Array.isArray(v?.banners) && v.banners) ||
      (Array.isArray((v?.data as Record<string, unknown>)?.banners) &&
        (v!.data as { banners: unknown[] }).banners) ||
      [];
    return rawList.length > 0 ? dedupeBannerList(rawList) : [];
  };

  const next: CachedHomeDynamicContent = { ...cached };
  const top = extractBanners(bannersResp);
  if (top.length > 0) next.dynamicBanners = top;
  const middle = extractBanners(middleBannersResp);
  if (middle.length > 0) next.dynamicMiddleBanners = middle;
  const lower = extractBanners(lowerBannersResp);
  if (lower.length > 0) next.dynamicLowerBanners = lower;

  if (articlesResp.status === 'fulfilled') {
    const articles = (articlesResp.value as { articles?: Record<string, unknown>[] })?.articles;
    if (articles?.length) next.dynamicArticles = articles;
  }
  if (announcementsResp.status === 'fulfilled') {
    const announcements = (announcementsResp.value as { announcements?: Record<string, unknown>[] })
      ?.announcements;
    if (announcements?.length) next.dynamicAnnouncements = announcements;
  }
  if (adoptionResp.status === 'fulfilled') {
    const s = (adoptionResp.value as { stats?: Record<string, unknown> })?.stats;
    if (s) {
      const ap = Number(s.adoptablePets);
      const rh = Number(s.rehomingListings);
      next.adoptionStats = {
        adoptablePets: Number.isFinite(ap) ? ap : (cached.adoptionStats?.adoptablePets ?? 0),
        rehomingListings: Number.isFinite(rh) ? rh : (cached.adoptionStats?.rehomingListings ?? 0),
      };
    }
  }

  writeHomeSessionCache(phone, 'dynamic_content', next);
  return next;
}

export interface HomeDeferredWorkHandlers {
  loadNotifications?: () => void | Promise<void>;
  loadBookings?: () => void | Promise<void>;
  loadBackground?: () => void | Promise<void>;
}

/** Schedule non-critical home work after idle (notifications, bookings, etc.). */
export function scheduleHomeDeferredWork(
  handlers: HomeDeferredWorkHandlers,
  timeoutMs = 2500
): () => void {
  return scheduleIdleWork(() => {
    void handlers.loadNotifications?.();
    void handlers.loadBookings?.();
    void handlers.loadBackground?.();
  }, timeoutMs);
}

/** Profile display name from cache (for header fallbacks). */
export function readCachedCustomerDisplayName(phone: string): string {
  return readCachedProfileName(phone).name;
}
