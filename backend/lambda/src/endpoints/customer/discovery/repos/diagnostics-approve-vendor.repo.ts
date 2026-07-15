import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbDiagnosticsApproveVendor0(business_name, phone, status) {
  return await query(`
        UPDATE vendors 
        SET 
          status = 'approved',
          approved_at = NOW(),
          is_active = true,
          updated_at = NOW()
        WHERE id = $1
        RETURNING id, business_name, phone, status, is_active
      `, [vendorId]);
}

