import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerContentPagesGet0(pagesQuery, params) {
  return await query(pagesQuery, params)
}

