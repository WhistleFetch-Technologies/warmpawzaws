import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerServices0(vendorQuery, params) {
  return await query(vendorQuery, params);
}

export async function dbCustomerServices1(styleClause, params) {
  return await query(
            `SELECT vs.id as vs_id, vs.service_id, vs.service_name as vs_service_name, vs.custom_price, vs.custom_duration, vs.service_style, vs.category,
                    s.id as s_id, s.name as s_name, s.price as s_price, s.duration_minutes as s_duration,
                    sc.id as sc_id, sc.service_name as sc_service_name, sc.base_price as sc_price, sc.duration_minutes as sc_duration
             FROM vendor_services vs
             LEFT JOIN services s ON vs.service_id = s.id
             LEFT JOIN service_catalog sc ON vs.service_id = sc.id
             WHERE vs.vendor_id = $1 AND vs.is_enabled = true AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)${styleClause}
             ORDER BY COALESCE(vs.service_name, sc.service_name, s.name)`,
            params
          );
}

