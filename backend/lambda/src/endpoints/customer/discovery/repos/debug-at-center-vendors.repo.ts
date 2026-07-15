import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbDebugAtCenterVendors0(v, r, vs) {
  return await query(`
        SELECT 
          v.id,
          v.business_name,
          v.status,
          v.is_active,
          r.name as role_name,
          COUNT(vs.id) as at_center_service_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        GROUP BY v.id, v.business_name, v.status, v.is_active, r.name
        ORDER BY v.business_name
        LIMIT 50
      `);
}

export async function dbDebugAtCenterVendors1(v, r, vs) {
  return await query(`
        SELECT 
          v.id,
          v.business_name,
          v.status,
          v.is_active,
          r.name as role_name,
          COUNT(vs.id) as at_center_service_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND v.is_active = true
          AND LOWER(r.name) NOT LIKE '%solo%'
          AND vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        GROUP BY v.id, v.business_name, v.status, v.is_active, r.name
        ORDER BY v.business_name
        LIMIT 50
      `);
}

export async function dbDebugAtCenterVendors2(v, r, vs) {
  return await query(`
        SELECT 
          v.id,
          v.business_name,
          v.status,
          v.is_active,
          r.name as role_name,
          COUNT(vs.id) as at_center_service_count
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND v.is_active = true
          AND LOWER(r.name) IN ('vet_clinic', 'veterinarian', 'vet')
          AND LOWER(r.name) NOT LIKE '%solo%'
          AND vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        GROUP BY v.id, v.business_name, v.status, v.is_active, r.name
        ORDER BY v.business_name
        LIMIT 50
      `);
}

export async function dbDebugAtCenterVendors3(text, uuid, va, v) {
  return await query(`
          SELECT 
            va.vendor_id,
            v.business_name,
            COUNT(va.id) as availability_slots,
            COUNT(CASE WHEN COALESCE(va.service_styles, ARRAY[]::text[]) && ARRAY['at_center', 'at_vendor', 'at_clinic']::text[] THEN 1 END) as matching_slots,
            COUNT(CASE WHEN COALESCE(va.service_styles, ARRAY[]::text[]) = ARRAY[]::text[] THEN 1 END) as empty_service_styles_slots
          FROM vendor_availability_v2 va
          INNER JOIN vendors v ON va.vendor_id = v.id
          WHERE va.vendor_id = ANY($1::uuid[])
            AND (va.is_available IS NULL OR va.is_available = true)
          GROUP BY va.vendor_id, v.business_name
        `, [vetIds]);
}

