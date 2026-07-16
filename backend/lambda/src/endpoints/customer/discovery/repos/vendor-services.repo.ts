import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorServices0(customerId, resolvedVendorId, package_id) {
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

export async function dbVendorServices3(text) {
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

export async function dbVendorServices4(servicesQuery, queryParams) {
  return await query(servicesQuery, queryParams);
}

