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

/** True if this row should appear in the walker “walk options” modal (full-catalog fetch, client filter). */
export function rowQualifiesForWalkingModal(s: Record<string, any> | null | undefined): boolean {
  if (!s) return false;
  const meta = s.metadata && typeof s.metadata === 'object' ? (s.metadata as Record<string, unknown>) : {};
  const c = String(s.category ?? s.categorySlug ?? (meta.category as string) ?? '').toLowerCase();
  if (c.includes('groom') && !c.includes('walk')) return false;
  if ((c.includes('board') || c.includes('sitting')) && !c.includes('walk')) return false;
  if (c.includes('train') && !c.includes('walk')) return false;
  if (c.includes('vet') && !c.includes('walk')) return false;
  if (c.includes('walk') || c.includes('dog_walk') || c === 'walking' || c.includes('dog walking')) return true;
  const st = String(s.serviceStyle ?? s.service_style ?? (meta.serviceStyle as string) ?? '').toLowerCase();
  if (st === 'outdoor' || st === 'at_home' || st === 'home' || st === 'home_visit') return true;
  if (!st) {
    const n = String(s.name ?? s.service_name ?? s.serviceName ?? '').toLowerCase();
    if (/(walk|stroll|outing|dog park|park visit|leash|perimeter)/.test(n)) return true;
    return false;
  }
  return false;
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

/** Router: merge services + packages, filter by selected walk style (at_home / outdoor / …). */
export function getWalkerRouterOfferingsForStyle(
  svcRes: Record<string, any> | null | undefined,
  bookingStyle: string
): any[] {
  if (!svcRes || typeof svcRes !== 'object') return [];
  const all = mergeCustomerVendorServicesPayload(svcRes);
  return all.filter((s) => walkerOfferingMatchesRouterStyle(s, bookingStyle));
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
  const pd = (s.packageDetails || s.package_details || s.metadata?.packageDetails) as
    | { totalSessions?: number; sessionDuration?: number; validityDays?: number }
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
  const totalSessions = pd?.totalSessions ?? s.metadata?.totalSessions;
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
    priceLabel,
    subPriceHint,
    iconColor: iconColorForPackage(isPackage, bookingServiceStyle),
  };
}
