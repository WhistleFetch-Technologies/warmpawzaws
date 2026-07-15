import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbAccountStatus0(uuid, username, phone, password_hash, profile_completed, onboarding_status) {
  return await query(
    `SELECT id, username, phone, password_hash, profile_completed, onboarding_status, password_set_at
     FROM customers WHERE id = $1::uuid LIMIT 1`,
    [customerId]
  );
}

