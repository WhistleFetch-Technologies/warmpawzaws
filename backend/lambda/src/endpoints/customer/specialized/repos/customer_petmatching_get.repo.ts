import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPetmatchingGet0(matchQuery, params) {
  return await query(matchQuery, params)
}

