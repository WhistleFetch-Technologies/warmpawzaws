import { query } from '../../../../database/rds-connection';
import { POLICY_KEY } from '../constants';

export async function dbPutAdminDeliveryFeePolicy0() {
  return await query(
    `SELECT id FROM platform_settings WHERE setting_key = $1 LIMIT 1`,
    [POLICY_KEY]
  );
}

export async function dbPutAdminDeliveryFeePolicy1(jsonStr: string) {
  return await query(
    `UPDATE platform_settings SET setting_value = $1::jsonb, updated_at = NOW() WHERE setting_key = $2`,
    [jsonStr, POLICY_KEY]
  );
}

export async function dbPutAdminDeliveryFeePolicy2(jsonStr: string, description: string) {
  return await query(
    `INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, is_public, created_at, updated_at)
     VALUES ($1, $2::jsonb, 'object', $3, true, NOW(), NOW())`,
    [POLICY_KEY, jsonStr, description]
  );
}
