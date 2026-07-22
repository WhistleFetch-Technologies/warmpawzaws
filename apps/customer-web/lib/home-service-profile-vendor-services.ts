import type { HomeServiceType } from '@/lib/home/service-configs';
import { rowQualifiesForWalkingModal } from '@/lib/walker-vendor-offerings';

const HOME_SERVICE_VENDOR_CATEGORY: Record<HomeServiceType, string> = {
  walker: 'walker',
  grooming: 'grooming',
  training: 'training',
  veterinary: 'vet',
  behaviourist: 'behaviourist',
  sitter: 'sitting',
  diagnostics: 'diagnostics',
};

/** Discovery query for paginated GET /customer/vendor/:id/services on home-service PFPs. */
export function homeServiceProfileVendorServicesQuery(serviceType: HomeServiceType): {
  category: string;
  serviceStyle: string;
} {
  return {
    category: HOME_SERVICE_VENDOR_CATEGORY[serviceType] ?? serviceType,
    serviceStyle: 'at_home',
  };
}

export function filterHomeServiceProfileVendorRows(
  serviceType: HomeServiceType,
  rows: unknown[]
): unknown[] {
  if (serviceType !== 'walker') return rows;
  return rows.filter((row) =>
    rowQualifiesForWalkingModal(row as Record<string, unknown>)
  );
}
