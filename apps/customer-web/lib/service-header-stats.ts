import type { StatCard } from '@/components/customer/shared/ServiceDashboardHeader';

/**
 * Service hubs, nested flows, specialization lists, and booking screens may pass
 * stats when product asks for them. Vendor profile pages must use
 * `VendorProfileDashboardHeader`, which never shows header stat chips.
 */
export const EMPTY_SERVICE_HEADER_STATS: StatCard[] = [];

/** @deprecated Vendor profiles no longer show header stat chips. */
export function vendorProfileHeaderStats(
  ratingEntry: StatCard | null,
  extras: StatCard[] = []
): StatCard[] {
  return [...(ratingEntry ? [ratingEntry] : []), ...extras];
}
