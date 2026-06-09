/**
 * Align GET /search hub browse (and category-scoped keyword search) with
 * GET /customer/discover-services radius, service_style, and is_online rules.
 */

import { query } from '../database/rds-connection';
import { getDiscoveryRules, type DiscoveryRuleSet } from './rule-engine';
import { expandSearchCategoryNormalizedTokens } from '../utils/search-category-aliases';
import { normalizeCategoryToken } from '@warmpawz/service-launch-mappings';
import { DistanceResolver } from './utils/vendor-customer-distance';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type HubDiscoveryContext = {
  discoverCategory: string;
  serviceStyle: 'at_center' | 'at_home' | 'tele';
  roleId?: string;
  /** Pet sitting: keep full list when radius would hide every sitter. */
  sittingDiscoveryRelaxed?: boolean;
};

const STYLE_ALIASES: Record<string, string> = {
  at_clinic: 'at_center',
  at_vendor: 'at_center',
  at_center: 'at_center',
  home_visit: 'at_home',
  at_home: 'at_home',
  video_consultation: 'tele',
  online: 'tele',
  tele: 'tele',
};

export function normalizeServiceStyle(style: string | null | undefined): string | null {
  if (!style) return null;
  const key = String(style).toLowerCase().trim().replace(/\s+/g, '_');
  return STYLE_ALIASES[key] || key;
}

export function acceptableStylesForService(serviceStyle: string | null | undefined): string[] {
  const normalized = normalizeServiceStyle(serviceStyle || '') || '';
  if (!normalized) return [];
  if (normalized === 'at_center') return ['at_center', 'at_vendor', 'at_clinic'];
  if (normalized === 'tele') return ['tele', 'online', 'video_consultation'];
  if (normalized === 'at_home') return ['at_home', 'home_visit'];
  return [normalized];
}

function parsePositiveKm(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function vendorHomeServiceRadiusKm(row: {
  service_radius?: unknown;
  service_distance_km?: unknown;
}): number | null {
  return parsePositiveKm(row.service_radius) ?? parsePositiveKm(row.service_distance_km);
}

/** PG/client may return boolean or 't'/'f'. Unknown/null → treat as online. */
export function vendorRowIsOnline(isOnline: unknown): boolean {
  if (isOnline === false || isOnline === 'f' || isOnline === 'false' || isOnline === 0 || isOnline === '0') {
    return false;
  }
  return true;
}

export function discoveryCustomerRadiusKm(opts: {
  rules: DiscoveryRuleSet;
  serviceStyleNorm: string;
  radiusFromQuery?: string | null;
}): number | null {
  if (opts.radiusFromQuery) {
    const n = parseInt(opts.radiusFromQuery, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (opts.serviceStyleNorm === 'at_home') return null;
  if (opts.serviceStyleNorm === 'tele') return opts.rules.discovery_radius_km_tele ?? 0;
  return opts.rules.discovery_radius_km ?? 50;
}

/** Customer device coordinates — mirrors discover-services query aliases. */
export function parseUserCoordsFromSearchQuery(
  qs?: Record<string, string | undefined> | null
): { lat: number; lng: number } | null {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const raw = qs?.[k];
      if (raw == null || raw === '') continue;
      const n = parseFloat(String(raw));
      if (Number.isFinite(n)) return n;
    }
    return NaN;
  };
  const lat = pick('userLat', 'lat', 'latitude');
  const lng = pick('userLng', 'lng', 'lon', 'longitude');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Hub slug (search chips) → discover-services query shape.
 * Aligned with apps/customer-web service hubs + defaultServiceStyleForCategory.
 */
const HUB_QUERY_HINTS: Record<string, string[]> = {
  vet: ['vet', 'veterinar', 'doctor', 'clinic', 'animal hosp', 'pet hosp'],
  grooming: ['groom', 'salon', 'spa', 'bath', 'haircut', 'trim', 'nail'],
  training: ['train', 'obedi', 'behavior', 'coach', 'agility', 'training', 'trainer'],
  boarding: ['board', 'kennel', 'daycare', 'hostel'],
  walker: ['walk', 'walker', 'dog walk', 'pet walk', 'stroll', 'exercise'],
  cafe: ['cafe', 'coffee', 'pet cafe', 'café', 'bistro', 'lounge'],
  resort: ['resort', 'holiday', 'vacation', 'lodge', 'hotel', 'staycation', 'getaway'],
  pharmacy: ['pharma', 'medicine', 'meds', 'drug', 'prescription', 'chemist', 'dispens', 'tablet', 'rx'],
  nutritionist: ['nutrition', 'nutritionist', 'diet', 'meal plan', 'pet food', 'feeding', 'weight'],
};

function hubMatchesSearchText(hubId: string, searchQuery: string): boolean {
  const q = (searchQuery || '').toLowerCase().trim();
  if (!q) return false;
  const hints = HUB_QUERY_HINTS[hubId];
  if (hints?.some((h) => q.includes(h))) return true;
  return q.includes(hubId);
}

/** e.g. "dog walker" → walker so /search applies discover parity + hub category filter. */
export function inferHubSlugFromSearchQuery(searchQuery: string): string | null {
  const q = (searchQuery || '').trim();
  if (!q) return null;
  const order = [
    'nutritionist',
    'pharmacy',
    'grooming',
    'training',
    'boarding',
    'walker',
    'resort',
    'cafe',
    'vet',
  ] as const;
  for (const hub of order) {
    if (hubMatchesSearchText(hub, q)) return hub;
  }
  return null;
}

function hubMatchesResultName(hubId: string, name: string | undefined, searchQuery: string): boolean {
  const n = (name || '').toLowerCase().trim();
  if (!n) return false;
  const hints = HUB_QUERY_HINTS[hubId];
  if (hints?.some((h) => n.includes(h))) return true;
  if (n.includes(hubId)) return true;
  if (searchQuery && hubMatchesSearchText(hubId, searchQuery)) return true;
  return false;
}

export function hubSlugToDiscoveryContext(categorySlug: string | undefined): HubDiscoveryContext | null {
  const slug = String(categorySlug || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (!slug) return null;

  switch (slug) {
    case 'vet':
    case 'veterinary':
      return { discoverCategory: 'vet', serviceStyle: 'at_center', roleId: 'veterinarian' };
    case 'grooming':
    case 'groomer':
      return { discoverCategory: 'grooming', serviceStyle: 'at_center', roleId: 'pet_groomer' };
    case 'training':
    case 'trainer':
      return { discoverCategory: 'training', serviceStyle: 'at_center', roleId: 'trainer_center' };
    case 'boarding':
    case 'pet_boarding':
      return { discoverCategory: 'boarding', serviceStyle: 'at_center', roleId: 'pet_boarding' };
    case 'walker':
    case 'walking':
    case 'walk':
      return { discoverCategory: 'walker', serviceStyle: 'at_home', roleId: 'walker' };
    case 'cafe':
    case 'pet_cafe':
      return { discoverCategory: 'cafe', serviceStyle: 'at_center', roleId: 'pet_cafe' };
    case 'resort':
    case 'pet_resort':
      return { discoverCategory: 'resort', serviceStyle: 'at_center', roleId: 'pet_resort' };
    case 'pharmacy':
    case 'pet_pharmacy':
      return { discoverCategory: 'pharmacy', serviceStyle: 'at_home', roleId: 'pet_pharmacy' };
    case 'nutritionist':
    case 'nutrition':
    case 'wellness':
      return { discoverCategory: 'nutritionist', serviceStyle: 'tele', roleId: 'nutritionist' };
    case 'sitting':
    case 'pet_sitter':
    case 'sitter':
      return {
        discoverCategory: 'sitting',
        serviceStyle: 'at_home',
        roleId: 'pet_sitter',
        sittingDiscoveryRelaxed: true,
      };
    case 'shop':
    case 'pet_shop':
    case 'marketplace':
      return { discoverCategory: 'shop', serviceStyle: 'at_center', roleId: 'pet_shop' };
    default:
      return null;
  }
}

const columnExistsCache = new Map<string, boolean>();

async function columnExists(table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  if (columnExistsCache.has(key)) return columnExistsCache.get(key)!;
  try {
    const res = await query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
      ) AS exists`,
      [table, column]
    );
    const exists = !!res.rows[0]?.exists;
    columnExistsCache.set(key, exists);
    return exists;
  } catch {
    columnExistsCache.set(key, false);
    return false;
  }
}

export async function loadVendorRadiusMetaByIds(
  vendorIds: string[]
): Promise<Map<string, { service_radius?: unknown; service_distance_km?: unknown; is_online?: unknown }>> {
  const map = new Map<string, { service_radius?: unknown; service_distance_km?: unknown; is_online?: unknown }>();
  if (vendorIds.length === 0) return map;
  const hasDist = await columnExists('vendors', 'service_distance_km');
  const distSelect = hasDist ? 'service_distance_km' : 'NULL::numeric AS service_distance_km';
  const { rows } = await query(
    `SELECT id::text AS id, service_radius, ${distSelect}, is_online
     FROM vendors WHERE id = ANY($1::uuid[])`,
    [vendorIds]
  );
  for (const row of rows) {
    map.set(String(row.id), {
      service_radius: row.service_radius,
      service_distance_km: row.service_distance_km,
      is_online: row.is_online,
    });
  }
  return map;
}

export type SearchVendorRow = {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  is_online?: unknown;
  isOnline?: unknown;
};

export type SearchServiceRow = {
  vendorId?: string;
  vendorLatitude?: number | null;
  vendorLongitude?: number | null;
  distanceKm?: number | null;
};

function resolveDistanceKm(
  userCoords: { lat: number; lng: number },
  lat: number | null,
  lng: number | null,
  existing?: number | null
): number | null {
  if (existing != null && Number.isFinite(existing)) return existing;
  if (lat == null || lng == null) return null;
  return haversineKm(userCoords.lat, userCoords.lng, lat, lng);
}

function withinDiscoveryRadius(opts: {
  distanceKm: number | null;
  capKm: number;
  sittingRelaxed: boolean;
}): boolean {
  if (opts.distanceKm == null) return true;
  return opts.distanceKm <= opts.capKm;
}

/** Geocode vendors without lat/lng before radius filter — same as discover-services enrichVendor. */
export async function enrichSearchVendorsWithDistance<T extends SearchVendorRow>(
  vendors: T[],
  userCoords: { lat: number; lng: number } | null,
  customerApproximate = false
): Promise<T[]> {
  if (!userCoords) return vendors;
  const resolver = new DistanceResolver(
    userCoords.lat,
    userCoords.lng,
    customerApproximate,
    false
  );
  return Promise.all(
    vendors.map(async (v) => {
      const dist = await resolver.resolve({
        id: v.id,
        latitude: v.latitude,
        longitude: v.longitude,
        address: (v as { address?: string }).address,
        city: (v as { city?: string }).city,
        state: (v as { state?: string }).state,
        pincode: (v as { pincode?: string }).pincode,
      });
      return { ...v, distanceKm: dist?.km ?? v.distanceKm ?? null };
    })
  );
}

/**
 * Post-fetch filter: offline vendors + radius caps (discover-services parity).
 */
export function filterSearchResultsByDiscoveryRules<T extends SearchVendorRow, S extends SearchServiceRow>(opts: {
  vendors: T[];
  services: S[];
  userCoords: { lat: number; lng: number } | null;
  hub: HubDiscoveryContext;
  rules: DiscoveryRuleSet;
  radiusFromQuery?: string | null;
  maxDistanceFromQuery?: string | null;
  vendorRadiusById: Map<string, { service_radius?: unknown; service_distance_km?: unknown; is_online?: unknown }>;
}): { vendors: T[]; services: S[] } {
  const styleNorm = normalizeServiceStyle(opts.hub.serviceStyle) || opts.hub.serviceStyle;
  const platformHome = opts.rules.discovery_radius_km_home ?? 10;
  const queryRadius = discoveryCustomerRadiusKm({
    rules: opts.rules,
    serviceStyleNorm: styleNorm,
    radiusFromQuery: opts.radiusFromQuery,
  });
  const maxDistanceKm = opts.maxDistanceFromQuery
    ? parseFloat(opts.maxDistanceFromQuery)
    : null;

  let vendors = opts.vendors.filter((v) => {
    const meta = opts.vendorRadiusById.get(v.id);
    const onlineRaw = v.is_online ?? v.isOnline ?? meta?.is_online;
    return vendorRowIsOnline(onlineRaw);
  });

  if (opts.userCoords) {
    const enriched = vendors.map((v) => {
      const meta = opts.vendorRadiusById.get(v.id);
      const lat = v.latitude ?? null;
      const lng = v.longitude ?? null;
      const distanceKm = resolveDistanceKm(opts.userCoords!, lat, lng, v.distanceKm ?? null);
      return { ...v, distanceKm };
    });

    if (styleNorm === 'at_home') {
      const within = enriched.filter((v) => {
        const meta = opts.vendorRadiusById.get(v.id) || {};
        const vendorCap = vendorHomeServiceRadiusKm(meta) ?? platformHome;
        const cap =
          maxDistanceKm != null && Number.isFinite(maxDistanceKm)
            ? Math.min(maxDistanceKm, vendorCap)
            : queryRadius != null && queryRadius > 0
              ? Math.min(queryRadius, vendorCap)
              : vendorCap;
        return withinDiscoveryRadius({
          distanceKm: v.distanceKm ?? null,
          capKm: cap,
          sittingRelaxed: !!opts.hub.sittingDiscoveryRelaxed,
        });
      });
      if (within.length > 0) {
        vendors = within;
      } else if (!opts.hub.sittingDiscoveryRelaxed) {
        vendors = within;
      } else {
        vendors = enriched;
      }
    } else {
      const teleNoLimit = styleNorm === 'tele' && (queryRadius === 0 || queryRadius == null);
      if (!teleNoLimit) {
        const effectiveMaxKm =
          maxDistanceKm ?? (queryRadius != null && queryRadius > 0 ? queryRadius : null);
        if (effectiveMaxKm != null) {
          const within = enriched.filter((v) =>
            withinDiscoveryRadius({
              distanceKm: v.distanceKm ?? null,
              capKm: effectiveMaxKm,
              sittingRelaxed: !!opts.hub.sittingDiscoveryRelaxed,
            })
          );
          if (within.length > 0) {
            vendors = within;
          } else if (!opts.hub.sittingDiscoveryRelaxed) {
            vendors = within;
          } else {
            vendors = enriched;
          }
        } else {
          vendors = enriched;
        }
      } else {
        vendors = enriched;
      }
    }
  }

  const allowedVendorIds = new Set(vendors.map((v) => v.id));

  let services = opts.services;
  if (opts.userCoords) {
    services = services.map((s) => {
      const lat = s.vendorLatitude ?? null;
      const lng = s.vendorLongitude ?? null;
      const distanceKm = resolveDistanceKm(opts.userCoords!, lat, lng, s.distanceKm ?? null);
      return { ...s, distanceKm };
    });
  }

  services = services.filter((s) => {
    const vid = String(s.vendorId || '').trim();
    if (!vid) return true;
    return allowedVendorIds.has(vid);
  });

  return { vendors, services };
}

/**
 * Availability check mirroring discover-services `sqlVendorAvailabilityOrNotConfigured`:
 * vendor has available slots  OR  has never configured availability at all.
 * Stricter "EXISTS only" in search caused walkers without availability config to be excluded.
 */
export function sqlVendorAvailabilityForSearch(vAlias = 'v'): string {
  return `(
    EXISTS (
      SELECT 1 FROM vendor_availability_v2 va
      WHERE (va.vendor_id = ${vAlias}.id OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = ${vAlias}.id OR phone = ${vAlias}.phone))
        AND COALESCE(va.is_available, true) = true
    )
    OR NOT EXISTS (
      SELECT 1 FROM vendor_availability_v2 va0
      WHERE va0.vendor_id = ${vAlias}.id
         OR va0.vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id = ${vAlias}.id OR phone = ${vAlias}.phone)
    )
  )`;
}

export async function resolveSearchUserCoords(
  qs: Record<string, string | undefined> | undefined
): Promise<{ lat: number; lng: number } | null> {
  const direct = parseUserCoordsFromSearchQuery(qs);
  if (direct) return direct;
  const phone = qs?.customerPhone || qs?.phone;
  if (!phone?.trim()) return null;
  const { getCustomerCoordinates } = await import('../utils/customer-coordinates');
  const coords = await getCustomerCoordinates(phone.trim());
  if (!coords) return null;
  const lat = parseFloat(String(coords.latitude));
  const lng = parseFloat(String(coords.longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function filterSearchResultsByHubCategory<T extends SearchVendorRow, S extends SearchServiceRow>(
  vendors: T[],
  services: S[],
  hubSlug: string,
  searchQuery: string
): { vendors: T[]; services: S[] } {
  const allowed = new Set(expandSearchCategoryNormalizedTokens(hubSlug));
  const q = (searchQuery || '').trim();
  const strictHubBrowse = !q;

  // Strict hub-browse trusts upstream SQL EXISTS / OpenSearch terms (which gate on
  // vendor_services.category). When the vendor's primary `vendors.category` column
  // is empty but they passed upstream, treat as pass — only reject when a category
  // is explicitly set AND it's outside the hub aliases. Keyword search keeps the
  // legacy name-hint fallback for legacy rows.
  const vendorOk = (category: string | null | undefined, businessName?: string | null) => {
    const c = normalizeCategoryToken(category || '');
    if (c && allowed.has(c)) return true;
    if (c && !allowed.has(c)) return false;
    if (strictHubBrowse) return true;
    return hubMatchesResultName(hubSlug, businessName || undefined, searchQuery);
  };

  const filteredVendors = vendors.filter((v) =>
    vendorOk(
      (v as { category?: string }).category ?? (v as { search_role_name?: string }).search_role_name,
      (v as { businessName?: string }).businessName
    )
  );
  const allowedIds = new Set(filteredVendors.map((v) => v.id));
  const filteredServices = services.filter((s) => {
    const vid = String(s.vendorId || '').trim();
    if (vid && !allowedIds.has(vid)) return false;
    return vendorOk(
      (s as { category?: string }).category,
      (s as { vendorName?: string }).vendorName
    );
  });
  return { vendors: filteredVendors, services: filteredServices };
}

/**
 * Hub filter for entity search — explicit ?category= only (Phase 1).
 * Taxonomy keyword matches enrich the response as categories[] but do not auto-apply a hub filter.
 */
export function resolveEffectiveSearchCategory(category?: string): string | undefined {
  const explicit = String(category || '').trim();
  return explicit || undefined;
}

export async function applySearchDiscoveryParity<T extends SearchVendorRow, S extends SearchServiceRow>(opts: {
  vendors: T[];
  services: S[];
  category?: string;
  searchQuery?: string;
  queryString?: Record<string, string | undefined>;
}): Promise<{ vendors: T[]; services: S[]; discoveryApplied: boolean }> {
  const effectiveCategory = resolveEffectiveSearchCategory(opts.category);
  const hub = hubSlugToDiscoveryContext(effectiveCategory);
  if (!hub) return { vendors: opts.vendors, services: opts.services, discoveryApplied: false };

  const qs = opts.queryString;
  const roleOverride = qs?.roleId?.trim();
  if (roleOverride) hub.roleId = roleOverride;

  const userCoords = await resolveSearchUserCoords(qs);
  const rules = await getDiscoveryRules(
    hub.roleId || hub.discoverCategory || 'all',
    'discover',
    hub.serviceStyle,
    hub.discoverCategory
  );

  const vendorIds = [
    ...new Set([
      ...opts.vendors.map((v) => v.id),
      ...opts.services.map((s) => String(s.vendorId || '').trim()).filter(Boolean),
    ]),
  ];
  const vendorRadiusById = await loadVendorRadiusMetaByIds(vendorIds);

  const vendorsEnriched = await enrichSearchVendorsWithDistance(opts.vendors, userCoords);

  let filtered = filterSearchResultsByDiscoveryRules({
    vendors: vendorsEnriched,
    services: opts.services,
    userCoords,
    hub,
    rules,
    radiusFromQuery: qs?.radius,
    maxDistanceFromQuery: qs?.maxDistance,
    vendorRadiusById,
  });

  // Keyword + hub mode: the app-level category filter still helps disambiguate
  // free-text searches that drag in wrong-vertical vendors via business name
  // matching. Hub-only browse trusts the upstream SQL/OpenSearch gate (which
  // mirrors discover-services), so re-filtering here would diverge from home —
  // e.g. home includes a vet vendor with a dog-walk service in the walker hub
  // (via walkerCategoryDiscoveryOr), and we want search to show the same set.
  const hubBrowseOnly = !(opts.searchQuery || '').trim();
  if (effectiveCategory && !hubBrowseOnly) {
    filtered = filterSearchResultsByHubCategory(
      filtered.vendors,
      filtered.services,
      effectiveCategory,
      opts.searchQuery || ''
    );
  }

  return { ...filtered, discoveryApplied: true };
}
