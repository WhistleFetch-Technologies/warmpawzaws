import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbGetAdminDeliveryFeePolicy0() {
  return await query(
      `SELECT setting_value, updated_at FROM platform_settings WHERE setting_key = $1 LIMIT 1`,
      [POLICY_KEY]
    );
}

