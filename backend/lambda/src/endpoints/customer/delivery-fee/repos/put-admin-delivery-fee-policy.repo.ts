import { query } from '../../../../database/rds-connection';

export async function dbPutAdminDeliveryFeePolicy0(policyKey: string) {
  return await query(
    `SELECT id FROM platform_settings WHERE setting_key = $1 LIMIT 1`,
    [policyKey]
  );
}

export async function dbPutAdminDeliveryFeePolicy1(jsonStr: string, policyKey: string) {
  return await query(
    `UPDATE platform_settings SET setting_value = $1::jsonb, updated_at = NOW() WHERE setting_key = $2`,
    [jsonStr, policyKey]
  );
}

export async function dbPutAdminDeliveryFeePolicy2(
  policyKey: string,
  jsonStr: string,
  description: string
) {
  return await query(
    `INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, is_public, created_at, updated_at)
     VALUES ($1, $2::jsonb, 'object', $3, true, NOW(), NOW())`,
    [policyKey, jsonStr, description]
  );
}
