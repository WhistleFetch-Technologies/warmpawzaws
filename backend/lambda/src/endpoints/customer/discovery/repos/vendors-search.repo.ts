import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbVendorsSearch0(vendorQuery, params) {
  return await query(vendorQuery, params);
}

export async function dbVendorsSearch1(customerId) {
  return await query(
              `SELECT DISTINCT vendor_id FROM package_purchases
               WHERE customer_id = $1 AND status = 'active'
                 AND (expires_at IS NULL OR expires_at > NOW())
                 AND (${sqlPackagePurchaseActiveForListing('package_purchases')})`,
              [customerId]
            );
}

export async function dbVendorsSearch2(vendor) {
  return await query(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
             FROM reviews 
             WHERE vendor_id = $1 AND is_approved = true`,
            [vendor.id]
          );
}

export async function dbVendorsSearch3(vendor) {
  return await query(`SELECT specialization FROM vendor_specializations WHERE vendor_id = $1`, [vendor.id]);
}

export async function dbVendorsSearch4(vs, vendor) {
  return await query(
            `SELECT COUNT(*) as count FROM vendor_services vs WHERE vs.vendor_id = $1 AND vs.is_enabled = true AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)`,
            [vendor.id]
          );
}

export async function dbVendorsSearch5(vendor) {
  return await query(
            `SELECT MIN(COALESCE(custom_price, price)) as min_price FROM vendor_services WHERE vendor_id = $1 AND is_enabled = true AND (publish_status IN ('published','auto_published') OR publish_status IS NULL)`,
            [vendor.id]
          );
}

export async function dbVendorsSearch6(roleId, limit, staffQuery) {
  return await query(staffQuery, [roleId, limit]);
}

