import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbDiagnosticsVendorByPhone0(phone, v, r) {
  return await query(`
        SELECT 
          v.id, 
          v.business_name, 
          v.owner_name, 
          v.phone, 
          v.status, 
          v.is_active, 
          v.vendor_type,
          r.id as role_id,
          r.name as role_name, 
          r.display_name as role_display_name
        FROM vendors v 
        LEFT JOIN roles r ON v.role_id = r.id 
        WHERE v.phone LIKE $1 OR v.phone = $2
        ORDER BY v.created_at DESC 
        LIMIT 5
      `, [`%${phone}%`, phone]);
}

export async function dbDiagnosticsVendorByPhone1(vs, vendor) {
  return await query(`
        SELECT 
          vs.id, 
          vs.service_name, 
          vs.service_style, 
          vs.is_enabled, 
          vs.publish_status,
          vs.category,
          vs.price
        FROM vendor_services vs
        WHERE vs.vendor_id = $1
        ORDER BY vs.created_at DESC
      `, [vendor.id]);
}

