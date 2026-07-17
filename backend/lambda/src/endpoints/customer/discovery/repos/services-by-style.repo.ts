import { query, select, insert, update } from '../../../../database/rds-connection';
import { fetchDiscoveryListStatsForVendors } from '../../../../utils/discovery-list-stats';

export async function dbFetchDiscoveryListStatsForVendors(
  vendorIds: string[],
  opts: Parameters<typeof fetchDiscoveryListStatsForVendors>[2]
) {
  return fetchDiscoveryListStatsForVendors(query, vendorIds, opts);
}

export async function dbServicesByStyle0(strictFromText) {
  return await query(
          `SELECT id::text FROM service_categories
           WHERE COALESCE(is_active, true) = true
             AND (
               LOWER(TRIM(category_id)) = ANY($1::text[])
               OR LOWER(TRIM(name)) = ANY($1::text[])
             )`,
          [strictFromText]
        );
}

export async function dbServicesByStyle1() {
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

export async function dbServicesByStyle2(sql, params) {
  return await query(sql, params)
}

export async function dbServicesByStyle3(vendorSql, vendorParamsByStyle) {
  return await query(vendorSql, vendorParamsByStyle);
}

