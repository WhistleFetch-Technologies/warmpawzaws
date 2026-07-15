import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbClinicVendorServices0() {
  return await query(
        `SELECT COALESCE(is_online, true) AS is_online FROM vendors WHERE id = $1 LIMIT 1`,
        [vendorId]
      )
}

export async function dbClinicVendorServices1(servicesQuery, params) {
  return await query(servicesQuery, params);
}

