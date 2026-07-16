import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorVendoridHolidaycustomrequestsGet0(vendorId, c, hcr) {
  return await query(`
        SELECT 
          hcr.*,
          c.full_name as customer_name,
          c.phone as customer_phone
        FROM holiday_custom_requests hcr
        LEFT JOIN customers c ON hcr.customer_id = c.id
        WHERE hcr.status = 'pending_quote'
        OR hcr.vendor_id = $1
        ORDER BY hcr.created_at DESC
      `, [vendorId]);
}

