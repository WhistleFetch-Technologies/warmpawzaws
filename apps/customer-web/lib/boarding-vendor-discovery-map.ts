/**
 * Maps GET /customer/discover-services (and by-style fallback) rows into
 * {@link BoardingListVendor} — shared by the boarding hub and View All list.
 */

import {
  type BoardingServiceSlug,
  vendorOffersBoardingSlug,
} from '@/lib/boarding-service-types';

export interface BoardingPlanRow {
  rowId: string;
  serviceId?: string;
  name: string;
  price: number;
  duration?: number;
  serviceStyle?: string;
  description?: string;
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
    const price = parseFloat(String(s.price ?? s.custom_price ?? s.base_price ?? '0')) || 0;
    const desc = pickBestDescription(s);
    out.push({
      rowId,
      serviceId: (s.serviceId || s.service_id) as string | undefined,
      name: name || 'Boarding',
      price,
      duration: (s.duration || s.duration_minutes) as number | undefined,
      serviceStyle: (s.serviceStyle || s.service_style) as string | undefined,
      description: desc || undefined,
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
    services = servicesData.services;
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
    mapped.push({
      rowId,
      serviceId: s.serviceId || s.service_id,
      name: s.serviceName || s.name || s.service_name || 'Boarding',
      price: parseFloat(String(s.price || '0')) || 0,
      duration: s.duration || s.duration_minutes,
      serviceStyle: s.serviceStyle || s.service_style,
      description: desc || undefined,
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
    const vendorId = String(service.vendorId || service.id || '');
    if (!vendorId) return;

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
      service.priceRange ||
      service.price_range ||
      (service.price ? `₹${service.price}` : '') ||
      (service.priceMin ? `From ₹${service.priceMin}` : '') ||
      (service.basePrice ? `₹${service.basePrice}` : '₹800+');

    const distKm = service.distance != null && service.distance !== '' ? Number(service.distance) : null;
    const distanceStr =
      distKm != null && Number.isFinite(distKm) ? `${distKm.toFixed(1)} km` : null;

    if (!vendorMap.has(vendorId)) {
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

      vendorMap.set(vendorId, {
        id: vendorId,
        name: venueName,
        address:
          service.vendorLocation?.address ||
          service.address ||
          `${service.city || ''}${service.city ? ', ' : ''}${service.pincode || ''}`.trim() ||
          'Location on booking',
        rating: parseFloat(service.vendorRating || service.rating || service.avgRating || '4.6'),
        review_count: parseInt(service.vendorReviewCount || service.reviewsCount || service.review_count || '0', 10),
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
      const v = vendorMap.get(vendorId)!;
      for (const lbl of planLabels) {
        if (!v.services.includes(lbl)) v.services.push(lbl);
      }
      v.planRows = mergePlanRows(v.planRows, fromNested);
      v.needsServiceFetch = v.planRows.length === 0;
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
