import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorFacilityPut0(vendor) {
  return await select('roles', { id: vendor.role_id });
}

export async function dbVendorFacilityPut1(actualVendorId, disclaimerPoints) {
  return await query(
              `UPDATE vendors SET boarding_disclaimer = $2, boarding_disclaimer_points = $3::jsonb, updated_at = NOW() WHERE id = $1::uuid`,
              [actualVendorId, disclaimerPoints.join('\n'), JSON.stringify(disclaimerPoints)]
            );
}

export async function dbVendorFacilityPut2() {
  return await query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'vendors' AND column_name = 'metadata'`
          );
}

export async function dbVendorFacilityPut3() {
  return await query('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS metadata JSONB');
}

export async function dbVendorFacilityPut4(actualVendorId, updateData) {
  return await update('vendors', { id: actualVendorId }, updateData);
}

export async function dbVendorFacilityPut5(actualVendorId) {
  return await query('DELETE FROM vendor_specializations WHERE vendor_id = $1', [actualVendorId]);
}

export async function dbVendorFacilityPut6(actualVendorId, specialization) {
  return await insert('vendor_specializations', { vendor_id: actualVendorId, specialization });
}

