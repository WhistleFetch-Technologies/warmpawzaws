import type { VendorCardDTO } from './discovery-vendor-card-dto';
import { toVendorCardDTOList } from './discovery-vendor-card-dto';

export type VendorListResponseBody = {
  success: true;
  style?: string;
  vendors: VendorCardDTO[];
  total: number;
  nextCursor: string | null;
  appliedFilters?: Record<string, unknown>;
  specializationApplied?: string | null;
};

export function buildVendorListResponse(opts: {
  style?: string;
  enrichedCards: Record<string, unknown>[];
  nextCursor: string | null;
  appliedFilters?: Record<string, unknown>;
  specializationApplied?: string | null;
  serviceStyleNorm?: string;
  warmpawzAppointments?: boolean;
}): VendorListResponseBody {
  const vendors = toVendorCardDTOList(opts.enrichedCards, opts.serviceStyleNorm, {
    warmpawzAppointments: opts.warmpawzAppointments,
  });
  return {
    success: true,
    ...(opts.style != null ? { style: opts.style } : {}),
    vendors,
    total: vendors.length,
    nextCursor: opts.nextCursor,
    ...(opts.appliedFilters ? { appliedFilters: opts.appliedFilters } : {}),
    ...(opts.specializationApplied !== undefined
      ? { specializationApplied: opts.specializationApplied }
      : {}),
  };
}

/** Price sort for cards-only lists (uses priceMin, not nested services). */
export function discoveryCardPriceSortValue(card: Record<string, unknown>): number {
  if (card.priceMin != null && Number(card.priceMin) > 0) return Number(card.priceMin);
  const services = card.services as Array<{ price?: number }> | undefined;
  if (Array.isArray(services) && services[0]?.price != null) return Number(services[0].price);
  return 0;
}
