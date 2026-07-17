import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorVendoridAdoptionPetsGet0(petsQuery, params) {
  return await query(petsQuery, params)
}

