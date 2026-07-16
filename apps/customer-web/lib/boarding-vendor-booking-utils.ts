import {
  type BoardingServiceSlug,
  boardingSlugMatchesText,
  serviceNameLooksLikeSwimming,
} from '@/lib/boarding-service-types';
import type { BoardingListVendor, BoardingPlanRow } from '@/lib/boarding-vendor-discovery-map';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';

export function minPriceForVendor(v: BoardingListVendor): number | null {
  if (v.planRows.length > 0) {
    return Math.min(...v.planRows.map((p) => p.price));
  }
  // Slim discover cards: use aggregated priceMin until expand fetches planRows
  const raw = (v.raw || {}) as Record<string, unknown>;
  const fromCard = Number(raw.priceMin ?? raw.price_min ?? raw.price ?? 0);
  return Number.isFinite(fromCard) && fromCard > 0 ? fromCard : null;
}

export function priceForCard(v: BoardingListVendor, slug: BoardingServiceSlug): string {
  for (const s of v.services) {
    if (boardingSlugMatchesText(slug, s)) {
      return v.price_label;
    }
  }
  return v.price_label;
}

export function buildFacilityPayload(v: BoardingListVendor): {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  rating: number;
  review_count: number;
  timing: string;
  photos: string[];
  amenities: string[];
} {
  const raw = (v.raw || {}) as Record<string, unknown>;
  return {
    id: v.id,
    name: v.name,
    description: (typeof raw.description === 'string' && raw.description) || '',
    address: v.address,
    city: String(raw.city || ''),
    pincode: String(raw.pincode || ''),
    phone: String(raw.phone || ''),
    rating: v.rating,
    review_count: v.review_count,
    timing: v.timing,
    photos: v.photo ? [v.photo] : [],
    amenities: Array.isArray(raw.amenities) ? (raw.amenities as string[]) : [],
  };
}

export function boardingPlanRowForPackageCheck(plan: BoardingPlanRow): Record<string, unknown> {
  return {
    id: plan.rowId,
    vendorServiceId: plan.vendorServiceId ?? plan.rowId,
    serviceId: plan.serviceId,
    name: plan.name,
    price: plan.price,
    duration: plan.duration,
    serviceStyle: plan.serviceStyle,
    isPackage: plan.isPackage,
    packageDetails: plan.packageDetails,
    metadata: plan.metadata,
  };
}

/** Package plans → purchase-package (stack preserves caller); others → boarding-booking wizard. */
export function navigateBoardingPlanBooking(
  onNavigate: (screen: string, data?: Record<string, unknown>) => void,
  vendor: BoardingListVendor,
  plan: BoardingPlanRow,
): void {
  const rawRow = boardingPlanRowForPackageCheck(plan);
  if (isVendorServicePackageRow(rawRow)) {
    const nav = buildWalkerServiceDataForVendorPackagePurchase({
      vendorId: vendor.id,
      vendorName: vendor.name,
      serviceRow: rawRow,
      serviceTypeCategory: 'boarding',
      serviceStyle: plan.serviceStyle || 'at_center',
    });
    if (nav) {
      onNavigate('purchase-package', nav);
      return;
    }
  }
  onNavigate('boarding-booking', buildBoardingBookPlanPayload(vendor, plan) as Record<string, unknown>);
}

export function buildBoardingBookPlanPayload(
  v: BoardingListVendor,
  plan: BoardingPlanRow
): {
  vendorId: string;
  serviceType: string;
  serviceId: string;
  serviceName: string;
  price: number;
  duration: number;
  serviceStyle: string;
  flowVariant?: 'boarding' | 'swimming';
  facility: ReturnType<typeof buildFacilityPayload>;
} {
  const isSwimming =
    boardingSlugMatchesText('swimming', plan.name) ||
    serviceNameLooksLikeSwimming(plan.name);
  return {
    vendorId: v.id,
    serviceType: isSwimming ? 'swimming' : 'boarding',
    serviceId: plan.rowId,
    serviceName: plan.name,
    price: plan.price,
    duration: plan.duration || (isSwimming ? 60 : 1440),
    serviceStyle: plan.serviceStyle || 'at_center',
    ...(isSwimming ? { flowVariant: 'swimming' as const } : {}),
    facility: buildFacilityPayload(v),
  };
}
