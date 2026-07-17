import { query, select, insert, update } from '../../../../database/rds-connection';
import { fetchDiscoveryListStatsForVendors } from '../../../../utils/discovery-list-stats';

export async function dbFetchDiscoveryListStatsForVendors(
  vendorIds: string[],
  opts: Parameters<typeof fetchDiscoveryListStatsForVendors>[2]
) {
  return fetchDiscoveryListStatsForVendors(query, vendorIds, opts);
}

export async function dbDiscoverServices0() {
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

export async function dbDiscoverServices1() {
  return await query(
          `SELECT id::text FROM service_categories
           WHERE COALESCE(is_active, true) = true
             AND (
               LOWER(TRIM(category_id)) = ANY($1::text[])
               OR LOWER(TRIM(name)) = ANY($1::text[])
             )`,
          [['training', 'pet training', 'dog training']]
        )
}

export async function dbDiscoverServices2(sql, params) {
  return await query(sql, params)
}

export async function dbDiscoverServices3(vendorSql, vendorParamsDiscover) {
  return await query(vendorSql, vendorParamsDiscover);
}

