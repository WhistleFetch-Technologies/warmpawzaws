import { query } from '../../../../database/rds-connection';

export async function dbCustomerAdoptionstatsGet0() {
  return await query(`SELECT COUNT(*) as count FROM adoption_pets WHERE status = 'available'`);
}

export async function dbCustomerAdoptionstatsGet1() {
  return await query(`SELECT COUNT(*) as count FROM vendors WHERE vendor_type = 'breeder' AND status = 'approved'`);
}

export async function dbCustomerAdoptionstatsGet2() {
  return await query(
    `SELECT COUNT(*) as count FROM adoption_pets WHERE listing_type = 'rehoming' AND status = 'available'`
  );
}
