import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorFacilityGet0(information_schema) {
  return await query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'services' AND column_name = 'is_global'`
      );
}

export async function dbVendorFacilityGet1(vs, s, vendor) {
  return await query(
        `SELECT s.*, vs.custom_price, vs.custom_duration, vs.is_enabled, vs.service_style
         FROM services s
         LEFT JOIN vendor_services vs ON s.id = vs.service_id AND vs.vendor_id = $1
         WHERE (vs.vendor_id = $1${hasIsGlobal ? ' OR s.is_global = true' : ''})
         AND s.is_active = true
         AND (vs.is_enabled IS NULL OR vs.is_enabled = true)
         ORDER BY s.name`,
        [vendor.id]
      );
}

export async function dbVendorFacilityGet2(vendor) {
  return await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
         FROM reviews
         WHERE vendor_id = $1 AND is_approved = true`,
        [vendor.id]
      );
}

export async function dbVendorFacilityGet3(c, r, vendor) {
  return await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1 AND r.is_approved = true
         ORDER BY r.created_at DESC
         LIMIT 5`,
        [vendor.id]
      );
}

