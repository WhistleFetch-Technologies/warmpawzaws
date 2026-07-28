/**
 * Maps GET /customer/discover-services (and by-style fallback) rows into
 * {@link BoardingListVendor} — shared by the boarding hub and View All list.
 */

import {
  type BoardingServiceSlug,
  vendorOffersBoardingSlug,
} from '@/lib/boarding-service-types';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { pickProviderDistanceKm } from '@/lib/distance-display';
import { isVendorServicePackageRow } from '@/lib/vendor-package-purchase-nav';
import { applyResolvedRatingToStoredFields } from '@/lib/resolve-vendor-rating';
import { resolveServiceCategoryDisplayLabel } from '@/lib/filter-hub-services';

export interface BoardingPlanRow {
  rowId: string;
  serviceId?: string;
  vendorServiceId?: string;
  name: string;
  price?: number;
  duration?: number;
  serviceStyle?: string;
  description?: string;
  /** Per-service category for badges (e.g. Boarding, Dog walking). Falls back to hub `planBadgeLabel` when absent. */
  categoryLabel?: string;
  /** Vendor multi-session bundle — pass through from discovery APIs for Package badge + booking routing */
  isPackage?: boolean;
  packageDetails?: unknown;
  metadata?: unknown;
}

function parsePlanRowPrice(s: Record<string, unknown>): number | undefined {
  const raw = s.price ?? s.custom_price ?? s.base_price;
  if (raw === null || raw === undefined || raw === '') return undefined;
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseMetadataIfString(meta: unknown): Record<string, unknown> | undefined {
  if (meta == null) return undefined;
  if (typeof meta === 'object' && !Array.isArray(meta)) return meta as Record<string, unknown>;
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function packageFieldsFromServiceRow(s: Record<string, unknown>): {
  isPackage: boolean;
  packageDetails?: unknown;
  metadata?: unknown;
} {
  const parsedMeta = parseMetadataIfString(s.metadata);
  const packageDetails = s.packageDetails ?? parsedMeta?.packageDetails;
  const normalizedForCheck: Record<string, unknown> = {
    ...s,
    metadata: parsedMeta ?? s.metadata,
    packageDetails,
    isPackage: s.isPackage ?? parsedMeta?.isPackage,
  };
  return {
    isPackage: isVendorServicePackageRow(normalizedForCheck),
    packageDetails,
    metadata: parsedMeta ?? s.metadata,
  };
}

/** Map stored category slugs / short names to customer-facing badge text. */
export function humanizeServiceCategoryBadge(raw: string | undefined | null): string | undefined {
  if (raw == null || typeof raw !== 'string') return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  const norm = t.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const map: Record<string, string> = {
    boarding: 'Boarding',
    sitting: 'Pet sitting',
    pet_sitting: 'Pet sitting',
    pet_sitter: 'Pet sitting',
    'pet-sitter': 'Pet sitting',
    walking: 'Dog walking',
    walker: 'Dog walking',
    dog_walking: 'Dog walking',
    'dog-walking': 'Dog walking',
    veterinary: 'Veterinary',
    vet: 'Veterinary',
    grooming: 'Grooming',
    training: 'Training',
    diagnostics: 'Diagnostics',
    behaviourist: 'Behaviourist',
    nutritionist: 'Nutritionist',
    daycare: 'Daycare',
    transport: 'Transport',
  };
  if (map[norm]) return map[norm];
  if (/^[a-z0-9_-]+$/i.test(t) && !/\s/.test(t)) {
    return t
      .split(/[-_]/g)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return t;
}

function categoryLabelFromServiceRow(s: Record<string, unknown>): string | undefined {
  const resolved = resolveServiceCategoryDisplayLabel({
    category: s.category as string | undefined,
    categoryName: (s.category_name ?? s.categoryName) as string | undefined,
    categorySlug: s.categorySlug as string | undefined,
    catalogCategoryId: (s.catalogCategoryId ?? s.catalog_category_id) as string | undefined,
    catalogServiceSlug: (s.catalogServiceId ?? s.catalog_service_id) as string | undefined,
    serviceId: (s.serviceId ?? s.service_id) as string | undefined,
    resolved_category: s.resolved_category as string | undefined,
  });
  if (resolved) return resolved;
  const raw = String(
    s.category_name ?? s.categoryName ?? s.category ?? s.service_category ?? ''
  ).trim();
  return humanizeServiceCategoryBadge(raw);
}

export interface BoardingVendorCard {
  id: string;
  name: string;
  address: string;
  rating: number;
  review_count: number;
  distance?: string | null;
  distanceKm: number | null;
  timing: string;
  services: string[];
  price_label: string;
  is_open?: boolean;
  photo?: string;
  raw?: Record<string, unknown>;
}

export interface BoardingListVendor extends BoardingVendorCard {
  planRows: BoardingPlanRow[];
  needsServiceFetch: boolean;
  isVerified?: boolean;
}

/**
 * Resolve a hub/list row when the UI passes {@link pickCustomerVendorAccountId} (chevron)
 * or legacy list key `v.id` — avoids silent misses from `vendors.find((x) => x.id === id)` only.
 */
export function findBoardingListVendorByProfileKey(
  list: BoardingListVendor[],
  key: string
): BoardingListVendor | undefined {
  const k = String(key ?? '').trim();
  if (!k) return undefined;
  return list.find((x) => {
    const raw = (x.raw ?? {}) as Record<string, unknown>;
    const canonical = pickCustomerVendorAccountId(raw) || x.id;
    return canonical === k || x.id === k;
  });
}

export function collectPublishedPlanLabels(row: any): string[] {
  const labels: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t && !labels.includes(t)) labels.push(t);
  };
  const arr = row?.services;
  if (Array.isArray(arr)) {
    for (const item of arr) {
      if (item == null) continue;
      if (typeof item === 'string') {
        push(item);
        continue;
      }
      const label =
        item.name ||
        item.serviceName ||
        item.service_name ||
        item.displayName ||
        item.title ||
        '';
      if (label) push(String(label));
    }
  }
  const top =
    row?.serviceName ||
    row?.service_name ||
    (typeof row?.service === 'string' ? row.service : '') ||
    '';
  if (top) push(String(top));

  return labels;
}

function pickBestDescription(p: Record<string, unknown>): string {
  const candidates: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
  };
  push(p.longDescription);
  push(p.long_description);
  push(p.description);
  push(p.custom_description);
  push(p.customDescription);
  push(p.shortDescription);
  if (candidates.length === 0) return '';
  return candidates.reduce((a, b) => (b.length > a.length ? b : a), '');
}

function resolveVendorAddress(service: any): string {
  const candidateStrings = [
    service?.vendorLocation?.address,
    service?.address,
    service?.location?.address,
  ];
  for (const value of candidateStrings) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }

  const city =
    typeof service?.city === 'string' && service.city.trim() ? service.city.trim() : '';
  const pincode =
    typeof service?.pincode === 'string' && service.pincode.trim() ? service.pincode.trim() : '';
  const cityPincode = [city, pincode].filter(Boolean).join(', ');
  if (cityPincode) return cityPincode;

  return 'Location on booking';
}

export function planRowsFromDiscoveryServices(services: unknown[] | undefined): BoardingPlanRow[] {
  if (!Array.isArray(services)) return [];
  const out: BoardingPlanRow[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < services.length; i++) {
    const s = services[i] as Record<string, unknown> | string | null;
    if (s == null || typeof s === 'string') continue;
    const rowId = String(s.id ?? s.vendorServiceId ?? s.serviceId ?? '');
    const name = String(s.serviceName || s.name || s.service_name || '').trim();
    if (!rowId || !name) continue;
    if (seen.has(rowId)) continue;
    seen.add(rowId);
    const price = parsePlanRowPrice(s);
    const desc = pickBestDescription(s);
    const pkg = packageFieldsFromServiceRow(s);
    out.push({
      rowId,
      serviceId: (s.serviceId || s.service_id) as string | undefined,
      vendorServiceId: String(s.vendorServiceId ?? s.vendor_service_id ?? s.id ?? '').trim() || undefined,
      name: name || 'Boarding',
      price,
      duration: (s.duration || s.duration_minutes) as number | undefined,
      serviceStyle: (s.serviceStyle || s.service_style) as string | undefined,
      description: desc || undefined,
      categoryLabel: categoryLabelFromServiceRow(s),
      isPackage: pkg.isPackage,
      packageDetails: pkg.packageDetails,
      metadata: pkg.metadata,
    });
  }
  return out;
}

function mergePlanRows(a: BoardingPlanRow[], b: BoardingPlanRow[]): BoardingPlanRow[] {
  const seen = new Set<string>();
  const out: BoardingPlanRow[] = [];
  for (const row of [...a, ...b]) {
    if (!row.rowId || seen.has(row.rowId)) continue;
    seen.add(row.rowId);
    out.push(row);
  }
  return out;
}

export function mapServicesApiResponseToPlanRows(servicesResponse: any): BoardingPlanRow[] {
  let services: any[] = [];
  const servicesData = servicesResponse as any;
  if (servicesData?.services && Array.isArray(servicesData.services)) {
    services = mergeCustomerVendorServicesPayload(servicesData);
  } else if (servicesData?.services?.at_center) {
    services = servicesData.services.at_center?.services || [];
  } else if (Array.isArray(servicesData)) {
    services = servicesData;
  }
  const seen = new Set<string>();
  const mapped: BoardingPlanRow[] = [];
  for (const s of services) {
    const rowId = String(s.id ?? s.vendorServiceId ?? s.serviceId ?? '');
    if (!rowId || seen.has(rowId)) continue;
    seen.add(rowId);
    const desc = pickBestDescription(s);
    const src = (s as Record<string, unknown>) || {};
    const pkg = packageFieldsFromServiceRow(src);
    mapped.push({
      rowId,
      serviceId: s.serviceId || s.service_id,
      vendorServiceId: String(s.vendorServiceId ?? s.vendor_service_id ?? s.id ?? '').trim() || undefined,
      name: s.serviceName || s.name || s.service_name || 'Boarding',
      price: parsePlanRowPrice(s as Record<string, unknown>),
      duration: s.duration || s.duration_minutes,
      serviceStyle: s.serviceStyle || s.service_style,
      description: desc || undefined,
      categoryLabel: categoryLabelFromServiceRow(s as Record<string, unknown>),
      isPackage: pkg.isPackage,
      packageDetails: pkg.packageDetails,
      metadata: pkg.metadata,
    });
  }
  return mapped;
}

export function buildBoardingVendorListFromRows(
  rows: any[],
  serviceSlug: BoardingServiceSlug
): { list: BoardingListVendor[]; relaxedFilter: boolean } {
  const vendorMap = new Map<string, BoardingListVendor>();

  rows.forEach((service: any) => {
    const pt = String(service.providerType || service.provider_type || '').toLowerCase();
    const explicitVendor = String(service.vendorId || service.vendor_id || '').trim();
    const vendorAsProvider =
      pt === 'vendor'
        ? String(service.providerId || service.provider_id || service.id || '').trim()
        : '';
    const vendorId = (explicitVendor || vendorAsProvider || '').trim();
    const groupKey =
      vendorId ||
      String(service.providerId || service.provider_id || service.id || '').trim();
    if (!groupKey) return;

    const planLabels = collectPublishedPlanLabels(service);
    const fromNested = planRowsFromDiscoveryServices(service.services);

    const timing =
      (() => {
        if (service.operatingHours && typeof service.operatingHours === 'object') {
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const today = days[new Date().getDay()];
          const todayHours = service.operatingHours[today];
          if (todayHours?.isOpen) return `${todayHours.open} - ${todayHours.close}`;
        }
        return service.businessHours || service.timing || '9 AM - 8 PM';
      })() || '9 AM - 8 PM';

    const basePrice =
      service.warmpawzAppointments === true
        ? ''
        : service.priceRange ||
      service.price_range ||
      (service.price ? `₹${service.price}` : '') ||
      (service.priceMin ? `From ₹${service.priceMin}` : '') ||
      (service.basePrice ? `₹${service.basePrice}` : '₹800+');

    const distKm = pickProviderDistanceKm(service);
    const distanceStr =
      distKm != null && Number.isFinite(distKm) ? `${distKm.toFixed(1)} km` : null;

    if (!vendorMap.has(groupKey)) {
      const venueName =
        service.vendorName ||
        service.businessName ||
        service.business_name ||
        service.name ||
        'Boarding center';
      const serviceLabelsForCard =
        planLabels.length > 0
          ? planLabels
          : service.name && String(service.name) !== String(venueName)
            ? [String(service.name)]
            : [];

      const ratingFields = applyResolvedRatingToStoredFields(
        { ...service, vendorId, vendor_id: vendorId },
        vendorId || groupKey
      );
      vendorMap.set(groupKey, {
        id: vendorId || groupKey,
        name: venueName,
        address: resolveVendorAddress(service),
        rating: ratingFields.rating,
        review_count: ratingFields.review_count,
        distance: distanceStr,
        distanceKm: distKm != null && Number.isFinite(distKm) ? distKm : null,
        timing,
        services: serviceLabelsForCard,
        price_label: basePrice,
        is_open:
          service.is_open !== undefined
            ? service.is_open
            : service.isAvailableToday !== undefined
              ? service.isAvailableToday
              : true,
        photo: service.vendorPhoto || service.photo || service.photoUrl || service.vendorProfileImage || service.businessPhoto,
        raw: { ...service },
        planRows: fromNested,
        needsServiceFetch: fromNested.length === 0,
        isVerified: !!service.isVerified,
      });
    } else {
      const v = vendorMap.get(groupKey)!;
      for (const lbl of planLabels) {
        if (!v.services.includes(lbl)) v.services.push(lbl);
      }
      v.planRows = mergePlanRows(v.planRows, fromNested);
      v.needsServiceFetch = v.planRows.length === 0;
      const mergedRating = applyResolvedRatingToStoredFields(
        { ...service, vendorId, vendor_id: vendorId },
        vendorId || groupKey
      );
      if (mergedRating.review_count > v.review_count) {
        v.review_count = mergedRating.review_count;
        v.rating = mergedRating.rating;
      } else if (
        mergedRating.review_count > 0 &&
        mergedRating.rating > 0 &&
        v.rating <= 0
      ) {
        v.rating = mergedRating.rating;
        v.review_count = mergedRating.review_count;
      }
      if (v.distanceKm == null || !Number.isFinite(v.distanceKm)) {
        const fillKm = pickProviderDistanceKm(service);
        if (fillKm != null && Number.isFinite(fillKm)) {
          v.distanceKm = fillKm;
          v.distance = `${fillKm.toFixed(1)} km`;
        }
      }
    }
  });

  let list = Array.from(vendorMap.values());
  const filtered = list.filter((v) => {
    const raw = v.raw as Record<string, unknown>;
    const servicesForMatch = v.services.length > 0 ? v.services : raw?.services;
    return vendorOffersBoardingSlug({ ...raw, services: servicesForMatch }, serviceSlug);
  });

  let relaxedFilter = false;
  if (filtered.length === 0 && list.length > 0) {
    relaxedFilter = true;
  } else {
    list = filtered;
  }

  return { list, relaxedFilter };
}
