import { query } from '../../../../database/rds-connection';

/** Count vendors with enabled at_center-style services (no PII rows). */
export async function dbDebugAtCenterVendors0() {
  return await query(`
        SELECT COUNT(DISTINCT v.id)::text AS c
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
      `);
}

/** Count approved/active non-solo vendors with at_center-style services. */
export async function dbDebugAtCenterVendors1() {
  return await query(`
        SELECT COUNT(DISTINCT v.id)::text AS c
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        INNER JOIN vendor_services vs ON vs.vendor_id = v.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND v.is_active = true
          AND LOWER(r.name) NOT LIKE '%solo%'
          AND vs.service_style IN ('at_center', 'at_vendor', 'at_clinic')
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
      `);
}

/** Vet vendor ids only (for availability count); no business names. */
export async function dbDebugAtCenterVendors2() {
  return await query(`
        SELECT DISTINCT v.id
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
        LIMIT 50
      `);
}

/** Count distinct vet vendors that have availability rows (no names/slots dump). */
export async function dbDebugAtCenterVendors3(vetIds: string[]) {
  return await query(
    `
          SELECT COUNT(DISTINCT va.vendor_id)::text AS c
          FROM vendor_availability_v2 va
          WHERE va.vendor_id = ANY($1::uuid[])
            AND (va.is_available IS NULL OR va.is_available = true)
        `,
    [vetIds],
  );
}
