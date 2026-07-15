import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerFacility0(r, v) {
  return await query(
        `SELECT v.*, r.name as role_name, r.display_name as role_display_name,
                r.config as role_config
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.id = $1`,
        [vendorId]
      );
}

export async function dbCustomerFacility1() {
  return await query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
         FROM reviews WHERE vendor_id = $1`,
        [vendorId]
      );
}

export async function dbCustomerFacility2(c, r) {
  return await query(
        `SELECT r.*, c.full_name as customer_name
         FROM reviews r
         LEFT JOIN customers c ON r.customer_id = c.id
         WHERE r.vendor_id = $1
         ORDER BY r.created_at DESC LIMIT 5`,
        [vendorId]
      );
}

export async function dbCustomerFacility3(name, role, experience_years) {
  return await query(
        `SELECT id, name, role, experience_years, is_active
         FROM staff WHERE vendor_id = $1 AND is_active = true`,
        [vendorId]
      );
}

