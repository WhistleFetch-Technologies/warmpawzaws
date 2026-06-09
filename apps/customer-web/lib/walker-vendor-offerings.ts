/**
 * Parity: WalkerService modal + WalkerBookingRouter both consume
 * GET /customer/vendor/:vendorId/services { services, packages }.
 */

import { mergeCustomerVendorServicesPayload } from './customer-vendor-services-merge';

const WALK_BOOKING_HOME_STYLES = new Set(['at_home', 'home', 'home_visit']);

export function vendorServiceRowDedupeKey(
  r: Record<string, any> | null | undefined,
  listIndex?: number
): string {
  if (!r) return listIndex != null ? `vs_idx:${listIndex}` : '';
  if (r.id != null && String(r.id).trim() !== '') return `vs:${String(r.id).trim()}`;
  const sid = (
    r.serviceId ??
    r.service_id ??
    r.catalogServiceId ??
    r.catalog_service_id
  ).toString().trim();
  if (sid) return `vs_sid:${sid}`;
  if (listIndex != null) return `vs_idx:${listIndex}`;
  const n = String(r.name ?? r.service_name ?? r.serviceName ?? '').slice(0, 64);
  const p = String(r.price ?? r.custom_price ?? '');
  if (n || p) return `vs_fb:${n}:${p}`;
  return '';
}

/** First linked catalog/service id on a `service_packages` row (for dedupe vs vendor_services). */
export function firstServiceIdFromServicePackageRow(r: Record<string, any> | null | undefined): string {
  if (!r) return '';
  const direct = (r.service_id ?? r.serviceId ?? '').toString().trim();
  if (direct) return direct;
  const ids = r.service_ids;
  if (Array.isArray(ids) && ids.length > 0 && ids[0] != null) return String(ids[0]).trim();
  if (typeof ids === 'string' && ids.trim()) {
    try {
      const parsed = JSON.parse(ids) as unknown;
      if (Array.isArray(parsed) && parsed[0] != null) return String(parsed[0]).trim();
    } catch {
      return ids.trim();
    }
  }
  return '';
}

/** Modal: at-home style filter (legacy Walk options dialog). */
export function walkerOfferingMatchesBookingHomeStyle(s: Record<string, any> | null | undefined): boolean {
  if (!s) return false;
  const st = (s.serviceStyle ?? s.service_style ?? '') as string;
  const t = String(st).trim().toLowerCase();
  if (!t) return true;
  return WALK_BOOKING_HOME_STYLES.has(t);
}

/**
 * Full booking flow: include rows for the active walk style; empty/unknown style matches any tab
 * so category=walking does not drop mis-labeled rows.
 */
export function walkerOfferingMatchesRouterStyle(
  s: Record<string, any> | null | undefined,
  style: string
): boolean {
  if (!s) return false;
  const st = (s.serviceStyle ?? s.service_style ?? '').toString().trim().toLowerCase();
  if (!st) return true;
  const want = style.trim().toLowerCase();
  if (want === 'outdoor') return st === 'outdoor';
  if (want === 'at_home' || want === 'home') {
    return WALK_BOOKING_HOME_STYLES.has(st) || st === 'at_home';
  }
  return st === want;
}

function servicesPayloadRoot(svcRes: Record<string, any>): Record<string, any> {
  const d = (svcRes as { data?: unknown }).data;
  if (d && typeof d === 'object' && !Array.isArray(d)) return d as Record<string, any>;
  return svcRes;
}

const NON_WALKER_CATEGORY_HINTS = [
  'groom',
  'train',
  'vet',
  'veterinar',
  'diagnostic',
  'nutrition',
  'meal',
  'ambulance',
  'board',
  'sitting',
  'sitter',
  'daycare',
  'cafe',
  'counsel',
  'behavi',
];

const NON_WALKER_NAME_HINTS = [
  'endocrine',
  'fluid',
  ' iv ',
  'surgery',
  'vaccin',
  'x-ray',
  'xray',
  'blood',
  'dental',
  'dermat',
  'cardio',
  'neuro',
  'ortho',
];

function categoryLooksLikeWalking(category: string): boolean {
  const c = category.replace(/-/g, ' ').trim().toLowerCase();
  if (!c) return false;
  if (/\b(board|boarding)\b/.test(c)) return false;
  if (/\b(walking|dog walking|dog walker|dog_walker|dog_walk|pet walker|pet walking)\b/.test(c)) {
    return true;
  }
  if (/\bwalker\b/.test(c) && !/\bvet\b/.test(c)) return true;
  if (/\bwalk\b/.test(c) && !/\bboard/.test(c)) return true;
  return false;
}

function nameLooksLikeWalk(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (!n || n.includes('walk-in')) return false;
  return /(dog\s*walk|pet\s*walk|\bwalk\b|stroll|outing|dog park|park visit|leash|perimeter)/.test(n);
}

/** True if this row should appear in the walker “walk options” modal (full-catalog fetch, client filter). */
export function rowQualifiesForWalkingModal(s: Record<string, any> | null | undefined): boolean {
  if (!s) return false;
  const meta = s.metadata && typeof s.metadata === 'object' ? (s.metadata as Record<string, unknown>) : {};
  const c = String(s.category ?? s.categorySlug ?? (meta.category as string) ?? '')
    .trim()
    .toLowerCase();
  const n = String(s.name ?? s.service_name ?? s.serviceName ?? '').trim().toLowerCase();
  const metaHub = String(
    meta.bookingHub ?? meta.booking_hub ?? meta.serviceHub ?? meta.service_hub ?? ''
  )
    .trim()
    .toLowerCase();

  if (c && NON_WALKER_CATEGORY_HINTS.some((h) => c.includes(h)) && !categoryLooksLikeWalking(c)) {
    return false;
  }
  if (NON_WALKER_NAME_HINTS.some((h) => n.includes(h)) && !nameLooksLikeWalk(n)) {
    return false;
  }
  if (categoryLooksLikeWalking(c)) return true;
  if (metaHub.includes('walk')) return true;
  if (nameLooksLikeWalk(n)) return true;

  if (isWalkerVendorServicePackageRow(s)) {
    return categoryLooksLikeWalking(c) || nameLooksLikeWalk(n) || metaHub.includes('walk');
  }

  return false;
}

/** Legacy `service_packages` rows use package_name / package category field names. */
export function servicePackageQualifiesForWalkingModal(
  r: Record<string, any> | null | undefined
): boolean {
  if (!r) return false;
  return rowQualifiesForWalkingModal({
    ...r,
    name: r.name ?? r.package_name ?? r.packageName,
    category: r.category ?? r.package_category ?? r.packageCategory,
  });
}

/**
 * Single list: vendor `services` + `packages` for the Walk options modal.
 * Unwraps `{ data: { services, packages } }` if present.
 */
export function mergeWalkerModalVendorOfferings(svcRes: Record<string, any> | null | undefined): any[] {
  if (!svcRes || typeof svcRes !== 'object') return [];
  const root = servicesPayloadRoot(svcRes);
  return mergeCustomerVendorServicesPayload(root);
}

export function isWalkerVendorServicePackageRow(
  s: Record<string, any> | null | undefined
): boolean {
  if (!s) return false;
  const meta =
    s.metadata && typeof s.metadata === 'object' && !Array.isArray(s.metadata)
      ? (s.metadata as Record<string, unknown>)
      : undefined;
  return Boolean(
    s.isPackage ||
      s.is_package ||
      meta?.isPackage ||
      meta?.type === 'package'
  );
}

/** Split merged vendor rows for WalkerBookingRouter `{ services, packages }` payload. */
export function splitWalkerVendorCatalogRows(rows: any[]): { services: any[]; packages: any[] } {
  const services: any[] = [];
  const packages: any[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    if (isWalkerVendorServicePackageRow(r as Record<string, any>)) packages.push(r);
    else services.push(r);
  }
  return { services, packages };
}

/**
 * Walker booking + modal parity: merge `category=walking` with full-catalog rows that qualify as walks.
 * `category=walking` SQL matches `%walking%` in category text, not labels like "Dog Walker".
 */
export async function fetchWalkerVendorCatalogMerged(
  get: (url: string) => Promise<unknown>,
  vendorId: string,
  phone?: string
): Promise<{ services: any[]; packages: any[] }> {
  const phoneQuery =
    phone && phone.trim()
      ? `customerPhone=${encodeURIComponent(phone)}&phone=${encodeURIComponent(phone)}`
      : '';
  const baseCustomerServices = `/customer/vendor/${encodeURIComponent(vendorId)}/services`;
  const withWalkingCategory = phoneQuery
    ? `${baseCustomerServices}?category=walking&${phoneQuery}`
    : `${baseCustomerServices}?category=walking`;
  const fullCatalog = phoneQuery ? `${baseCustomerServices}?${phoneQuery}` : baseCustomerServices;

  const walkFilter = rowQualifiesForWalkingModal;
  const [fromWalkingCategory, fromFullRaw] = await Promise.all([
    fetchVendorServicesRows(get, withWalkingCategory, vendorId, { filterRow: walkFilter }),
    fetchVendorServicesRows(get, fullCatalog, vendorId, { filterRow: walkFilter }),
  ]);

  const fromFullFiltered: any[] = fromFullRaw;

  const merged: any[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < fromWalkingCategory.length; i += 1) {
    const r = fromWalkingCategory[i];
    if (!r || !rowQualifiesForWalkingModal(r)) continue;
    const key = vendorServiceRowDedupeKey(r, i);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }
  for (let j = 0; j < fromFullFiltered.length; j += 1) {
    const r = fromFullFiltered[j];
    if (!r) continue;
    const key = vendorServiceRowDedupeKey(r, 1000 + j);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(r);
  }

  return splitWalkerVendorCatalogRows(merged);
}

/** Router: merge services + packages, filter by selected walk style (at_home / outdoor / …). */
export function getWalkerRouterOfferingsForStyle(
  svcRes: Record<string, any> | null | undefined,
  bookingStyle: string
): any[] {
  if (!svcRes || typeof svcRes !== 'object') return [];
  const all = mergeCustomerVendorServicesPayload(svcRes);
  return all.filter((s) => walkerOfferingMatchesRouterStyle(s, bookingStyle));
}

/** Profile / walk picker: walk-like rows; optional strict style match for booking wizard. */
export function getWalkerDisplayOfferings(
  svcRes: Record<string, any> | null | undefined,
  bookingStyle: string,
  opts?: { requireStyleMatch?: boolean }
): any[] {
  if (!svcRes || typeof svcRes !== 'object') return [];
  const requireStyle = opts?.requireStyleMatch !== false;
  const all = mergeCustomerVendorServicesPayload(svcRes);
  return all.filter((row) => {
    if (!rowQualifiesForWalkingModal(row)) return false;
    if (!requireStyle) return true;
    return walkerOfferingMatchesRouterStyle(row, bookingStyle);
  });
}

async function fetchVendorServicesRows(
  get: (url: string) => Promise<unknown>,
  customerUrl: string,
  vendorId: string,
  opts?: { filterRow?: (r: Record<string, any>) => boolean }
): Promise<any[]> {
  const filterRow = opts?.filterRow;
  const seen = new Set<string>();
  const out: any[] = [];
  const pushRows = (rows: any[], indexOffset = 0) => {
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      if (!r) continue;
      if (filterRow && !filterRow(r)) continue;
      const key = vendorServiceRowDedupeKey(r, indexOffset + i);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  };

  try {
    const res = (await get(customerUrl)) as Record<string, any>;
    if (res?.success !== false) {
      pushRows(mergeWalkerModalVendorOfferings(res));
    }
  } catch {
    /* customer route may 404 when vendor is_offline — fall through to legacy */
  }

  try {
    const legacy = (await get(`/vendor/${encodeURIComponent(vendorId)}/services`)) as Record<string, any>;
    pushRows(mergeWalkerModalVendorOfferings(legacy), 5000);
  } catch {
    /* ignore */
  }

  return out;
}

export type WalkerServiceOption = {
  id: string;
  serviceId: string;
  name: string;
  price: number;
  duration: number;
  desc: string;
  serviceStyle: string;
  isPackage: boolean;
  totalSessions?: number;
  /** From packageDetails / metadata when row is a multi-session bundle. */
  sessionsPerDay?: number;
  sessionIntervalDays?: number;
  priceLabel: string;
  subPriceHint?: string;
  iconColor: 'green' | 'orange' | 'purple' | 'blue';
};

function iconColorForPackage(isPackage: boolean, style: string): WalkerServiceOption['iconColor'] {
  if (isPackage) return 'purple';
  return style === 'outdoor' ? 'green' : 'orange';
}

/** Normalize API service/package row to WalkerBookingRouter card shape. */
export function mapWalkerApiRowToOption(
  s: Record<string, any>,
  bookingServiceStyle: string
): WalkerServiceOption {
  const isPackage = Boolean(
    s.isPackage ||
      s.is_package ||
      s.metadata?.isPackage ||
      s.metadata?.type === 'package'
  );
  const metaObj =
    s.metadata && typeof s.metadata === 'object' && !Array.isArray(s.metadata)
      ? (s.metadata as Record<string, unknown>)
      : undefined;
  const pd = (s.packageDetails || s.package_details || metaObj?.packageDetails) as
    | {
        totalSessions?: number;
        sessionDuration?: number;
        validityDays?: number;
        sessionsPerDay?: number;
        sessions_per_day?: number;
        sessionIntervalDays?: number;
        session_interval_days?: number;
        frequencyDays?: number;
      }
    | undefined;
  const name =
    s.name || s.service_name || s.serviceName || (isPackage ? 'Walk bundle' : 'Walk');
  const basePrice = Number(
    s.price ?? s.custom_price ?? s.base_price ?? s.package_price ?? 0
  );
  const duration = Number(
    s.duration ??
      s.durationMinutes ??
      s.duration_minutes ??
      pd?.sessionDuration ??
      30
  );
  const stRaw = s.serviceStyle || s.service_style;
  const normalizedStyle =
    typeof stRaw === 'string' && stRaw.trim()
      ? String(stRaw).trim()
      : bookingServiceStyle;
  const totalSessions = pd?.totalSessions ?? metaObj?.totalSessions;
  const sessionsPerDay = Math.max(
    1,
    Math.min(
      24,
      Number(
        pd?.sessionsPerDay ??
          pd?.sessions_per_day ??
          metaObj?.sessionsPerDay ??
          metaObj?.sessions_per_day
      ) || 1
    )
  );
  const sessionIntervalDays = Math.max(
    1,
    Math.min(
      366,
      Number(
        pd?.sessionIntervalDays ??
          pd?.session_interval_days ??
          pd?.frequencyDays ??
          metaObj?.sessionIntervalDays ??
          metaObj?.frequencyDays
      ) || 7
    )
  );
  let priceLabel: string;
  let subPriceHint: string | undefined;
  if (isPackage && totalSessions != null && totalSessions > 1) {
    priceLabel = `₹${basePrice.toLocaleString('en-IN')} total`;
    const per = Math.round(basePrice / totalSessions);
    subPriceHint = `${totalSessions} sessions · ~₹${per.toLocaleString('en-IN')} / walk equiv.`;
  } else if (isPackage) {
    priceLabel = `₹${basePrice.toLocaleString('en-IN')} (bundle)`;
  } else {
    priceLabel = `₹${basePrice.toLocaleString('en-IN')}`;
  }
  return {
    id: String(s.id || s.serviceId || s.service_id || ''),
    serviceId: String(s.serviceId || s.service_id || s.id || ''),
    name,
    price: basePrice,
    duration,
    desc: String(
      s.shortDescription || s.description || s.desc || s.longDescription || (isPackage ? 'Session bundle' : '')
    ),
    serviceStyle: normalizedStyle,
    isPackage,
    totalSessions: totalSessions != null ? Number(totalSessions) : undefined,
    sessionsPerDay: isPackage ? sessionsPerDay : undefined,
    sessionIntervalDays: isPackage ? sessionIntervalDays : undefined,
    priceLabel,
    subPriceHint,
    iconColor: iconColorForPackage(isPackage, bookingServiceStyle),
  };
}
