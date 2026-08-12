/**
 * Split vendor catalog rows into one-off services vs packages for discovery UI.
 */
import { isVendorServicePackageRow } from '@/lib/vendor-package-purchase-nav';

export function partitionVendorServicesForDiscovery<T extends Record<string, unknown>>(
  rows: T[] | null | undefined
): { services: T[]; packages: T[] } {
  const services: T[] = [];
  const packages: T[] = [];
  for (const row of rows || []) {
    if (!row || typeof row !== 'object') continue;
    if (isVendorServicePackageRow(row) || Boolean((row as { isPackage?: unknown }).isPackage)) {
      packages.push(row);
    } else {
      services.push(row);
    }
  }
  return { services, packages };
}

/** Packages first, then one-off services — omit empty sections. */
export function discoveryServiceSections<T extends Record<string, unknown>>(
  rows: T[] | null | undefined
): Array<{ title: 'Packages' | 'Available Services'; list: T[] }> {
  const { packages, services } = partitionVendorServicesForDiscovery(rows);
  const sections: Array<{ title: 'Packages' | 'Available Services'; list: T[] }> = [];
  if (packages.length > 0) sections.push({ title: 'Packages', list: packages });
  if (services.length > 0) sections.push({ title: 'Available Services', list: services });
  return sections;
}
