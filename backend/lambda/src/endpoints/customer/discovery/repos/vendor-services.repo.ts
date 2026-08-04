import { query, select, insert, update } from '../../../../database/rds-connection';
import { sqlPackagePurchaseActiveForListing } from '../../../../utils/package-session-eligibility';
import { seedFinitePackagesMissingSessionsForScope } from '../../../../utils/package-session-sync';

export async function dbSeedFinitePackagesForCustomerVendor(customerId: string, vendorId: string) {
  await seedFinitePackagesMissingSessionsForScope({ query }, { customerId, vendorId });
}

export async function dbVendorServices0(customerId, resolvedVendorId) {
  return await query(
              `SELECT id, package_id, package_snapshot FROM package_purchases
               WHERE customer_id = $1 AND vendor_id = $2 AND status = 'active'
                 AND (expires_at IS NULL OR expires_at > NOW())
                 AND (${sqlPackagePurchaseActiveForListing('package_purchases')})`,
              [customerId, resolvedVendorId]
            );
}

export async function dbVendorServices1(resolvedVendorId, pp) {
  return await query(
                  `SELECT id, metadata FROM vendor_services WHERE id = $1 AND vendor_id = $2`,
                  [pp.package_id, resolvedVendorId]
                );
}

export async function dbVendorServices2(pp) {
  return await query(
                    `SELECT service_id FROM package_services WHERE package_id = $1`,
                    [pp.package_id]
                  );
}

export async function dbVendorServices3() {
  return await query(
              `SELECT id::text FROM service_categories
               WHERE COALESCE(is_active, true) = true
                 AND (
                   LOWER(TRIM(category_id)) = ANY($1::text[])
                   OR LOWER(TRIM(name)) = ANY($1::text[])
                 )`,
              [['boarding', 'pet_boarding', 'pet boarding']]
            )
}
