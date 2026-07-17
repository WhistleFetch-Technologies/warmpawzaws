import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbAdoptionPetsGet0(petQuery, params) {
  return await query(petQuery, params)
}

export async function dbAdoptionPetsGet1(countQuery) {
  return await query(countQuery, [])
}

