import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorsList0(vendorQuery, params) {
  return await query(vendorQuery, params);
}

