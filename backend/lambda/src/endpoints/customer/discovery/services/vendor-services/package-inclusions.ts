import { resolveCustomerIdFromPhone } from '../../../../../utils/customer-coordinates';
import * as vendorServicesRepo from '../../repos/vendor-services.repo';

export type VendorServicePackageInclusions = {
  includedVendorServiceIds: Set<string>;
  includedLegacyServiceIds: Set<string>;
  vendorServiceIdToPackagePurchaseId: Map<string, string>;
};

export async function loadVendorServicePackageInclusions(
  customerPhone: string | null | undefined,
  resolvedVendorId: string
): Promise<VendorServicePackageInclusions> {
  const includedVendorServiceIds = new Set<string>();
  const includedLegacyServiceIds = new Set<string>();
  const vendorServiceIdToPackagePurchaseId = new Map<string, string>();

  if (!customerPhone) {
    return { includedVendorServiceIds, includedLegacyServiceIds, vendorServiceIdToPackagePurchaseId };
  }

  try {
    const customerId = await resolveCustomerIdFromPhone(customerPhone);
    if (!customerId) {
      return { includedVendorServiceIds, includedLegacyServiceIds, vendorServiceIdToPackagePurchaseId };
    }

    await vendorServicesRepo.dbSeedFinitePackagesForCustomerVendor(customerId, resolvedVendorId);
    const purchases = await vendorServicesRepo.dbVendorServices0(customerId, resolvedVendorId);

    for (const pp of purchases.rows || []) {
      const snapshot =
        pp.package_snapshot &&
        (typeof pp.package_snapshot === 'string'
          ? JSON.parse(pp.package_snapshot)
          : pp.package_snapshot);
      const inc = snapshot?.includedServices;
      if (Array.isArray(inc) && inc.length > 0) {
        inc.forEach((s: { id?: string; vendor_service_id?: string }) => {
          const id = s.id || s.vendor_service_id;
          if (id) {
            includedVendorServiceIds.add(id);
            vendorServiceIdToPackagePurchaseId.set(id, pp.id);
          }
        });
        continue;
      }

      const vsRow = await vendorServicesRepo.dbVendorServices1(resolvedVendorId, pp);
      if (vsRow.rows?.length > 0) {
        const meta = vsRow.rows[0].metadata;
        const parsed = typeof meta === 'string' ? (meta ? JSON.parse(meta) : {}) : meta || {};
        const details = parsed?.packageDetails || parsed;
        const arr = details?.includedServices || details?.included_services;
        if (Array.isArray(arr)) {
          arr.forEach((s: { id?: string; vendor_service_id?: string }) => {
            const id = s.id || s.vendor_service_id;
            if (id) {
              includedVendorServiceIds.add(id);
              vendorServiceIdToPackagePurchaseId.set(id, pp.id);
            }
          });
        }
      } else {
        const psRows = await vendorServicesRepo.dbVendorServices2(pp);
        for (const r of psRows.rows || []) {
          if (r.service_id) includedLegacyServiceIds.add(r.service_id);
        }
      }
    }
  } catch {
    /* non-fatal */
  }

  return { includedVendorServiceIds, includedLegacyServiceIds, vendorServiceIdToPackagePurchaseId };
}
