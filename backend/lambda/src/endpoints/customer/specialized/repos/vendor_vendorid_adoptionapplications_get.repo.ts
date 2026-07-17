import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorVendoridAdoptionapplicationsGet0(applicationsQuery, params) {
  return await query(applicationsQuery, params)
}

