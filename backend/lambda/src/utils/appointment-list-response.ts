import type { AppointmentVendorCardDTO } from './appointment-vendor-card-dto';
import { toAppointmentVendorCardDTOList } from './appointment-vendor-card-dto';

export type AppointmentVendorListResponseBody = {
  success: true;
  style?: string;
  vendors: AppointmentVendorCardDTO[];
  total: number;
  nextCursor: string | null;
  appliedFilters?: Record<string, unknown>;
  specializationApplied?: string | null;
};

export function buildAppointmentVendorListResponse(opts: {
  style?: string;
  enrichedCards: Record<string, unknown>[];
  nextCursor: string | null;
  appliedFilters?: Record<string, unknown>;
  specializationApplied?: string | null;
  serviceStyleNorm?: string;
}): AppointmentVendorListResponseBody {
  const vendors = toAppointmentVendorCardDTOList(opts.enrichedCards, opts.serviceStyleNorm);
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
