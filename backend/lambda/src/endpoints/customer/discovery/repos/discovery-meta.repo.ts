import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbDiscoveryMeta0(r, v, vs) {
  return await query(`
        SELECT DISTINCT r.name AS roleName, r.display_name AS roleDisplayName
        FROM vendors v
        INNER JOIN roles r ON v.role_id = r.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
          AND v.is_active = true
          AND EXISTS (
            SELECT 1 FROM vendor_services vs
            WHERE vs.vendor_id = v.id AND vs.is_enabled = true
              AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
          )
        ORDER BY r.name
      `);
}

export async function dbDiscoveryMeta1(vs, v) {
  return await query(`
        SELECT DISTINCT vs.service_style AS serviceStyle
        FROM vendor_services vs
        INNER JOIN vendors v ON v.id = vs.vendor_id
        WHERE (v.status = 'approved' OR v.status = 'active') AND v.is_active = true
          AND ${sqlVendorOnlineForCustomerDiscovery('v')}
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published', 'auto_published', 'draft') OR vs.publish_status IS NULL)
          AND vs.service_style IS NOT NULL
        ORDER BY vs.service_style
      `);
}

