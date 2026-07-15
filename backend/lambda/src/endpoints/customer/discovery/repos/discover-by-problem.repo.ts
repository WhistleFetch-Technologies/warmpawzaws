import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbDiscoverByProblem0(queryText, params) {
  return await query(queryText, params);
}

export async function dbDiscoverByProblem1() {
  return await query(`SELECT AVG(rating) as avg_rating, COUNT(*) as c FROM reviews WHERE vendor_id = $1 AND is_approved = true`, [vendorId]);
}

export async function dbDiscoverByProblem2() {
  return await query(`SELECT specialization FROM vendor_specializations WHERE vendor_id = $1`, [vendorId]);
}

