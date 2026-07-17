import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbBreederPuppiesGet0(puppyQuery, params) {
  return await query(puppyQuery, params)
}

