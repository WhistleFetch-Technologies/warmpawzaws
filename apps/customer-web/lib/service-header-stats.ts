import type { StatCard } from '@/components/customer/shared/ServiceDashboardHeader';

/**
 * Service hubs, nested flows, specialization lists, and booking screens must not
 * show header stat chips until product asks for them again. Vendor profile pages
 * may pass real per-vendor stats (e.g. rating via vendorRatingHeaderStat).
 */
export const EMPTY_SERVICE_HEADER_STATS: StatCard[] = [];

export function vendorProfileHeaderStats(
  ratingEntry: StatCard | null,
  extras: StatCard[] = []
): StatCard[] {
  return [...(ratingEntry ? [ratingEntry] : []), ...extras];
}
