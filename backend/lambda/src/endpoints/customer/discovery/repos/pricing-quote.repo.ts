import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbPricingQuote0(uuid, vs, vendor) {
  return await query(
        `SELECT vs.id, vs.service_id, vs.price, vs.custom_price, vs.category, vs.metadata
         FROM vendor_services vs
         WHERE (vs.id = $1::uuid OR (vs.service_id = $1 AND vs.vendor_id = $2::uuid))
           AND vs.vendor_id = $2::uuid AND vs.is_enabled = true`,
        [serviceId, vendor.id]
      );
}

export async function dbPricingQuote1(uuid, base_price, category_id) {
  return await query(
          `SELECT id, base_price, category_id, category_name FROM service_catalog WHERE (service_id = $1 OR id = $1::uuid) AND status = 'active'`,
          [serviceId]
        );
}

