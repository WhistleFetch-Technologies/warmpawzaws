import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorFacilityUpload0(actualVendorId, vendorPatch) {
  return await update('vendors', { id: actualVendorId }, vendorPatch);
}

