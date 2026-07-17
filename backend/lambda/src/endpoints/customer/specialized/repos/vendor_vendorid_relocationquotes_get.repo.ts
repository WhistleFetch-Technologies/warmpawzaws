import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorVendoridRelocationquotesGet0(vendorId, quotesQuery) {
  return await query(quotesQuery, [vendorId]);
}

