import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbRelocationServicesGet0(serviceQuery, params) {
  return await query(serviceQuery, params)
}

