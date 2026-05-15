/**
 * Persisted fee configuration in admin_settings (matches migrations:
 * setting_category NOT NULL, setting_key, setting_value JSONB, UNIQUE(setting_category, setting_key)).
 * Legacy handlers used non-existent columns (service_type) and omitted setting_category → writes failed silently.
 */

import { query } from '../database/rds-connection';

export const FEE_SETTINGS_CATEGORY = 'fees';

const GLOBAL_FEE_KEYS = [
  'platform_fee_percentage',
  'platform_fee_flat',
  'max_platform_fee',
  'convenience_fee_booking',
  'convenience_fee_order',
  'convenience_fee_tele',
  'delivery_fee_base',
  'delivery_fee_per_km',
  'free_delivery_threshold',
  'max_delivery_distance',
  'packaging_fee_enabled',
  'packaging_fee_amount',
] as const;

/** Normalize JSONB cell from pg to a string for parseFloat / boolean checks. */
export function scalarFromJsonbSetting(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  return String(v);
}

export type FeeSettingRow = { setting_key: string; setting_value: unknown };

/**
 * All global + override rows for fee configuration (single source for GET /config/fees and admin finance).
 */
const GLOBAL_KEYS_SQL = GLOBAL_FEE_KEYS.map((k) => `'${k}'`).join(', ');

export async function listFeeSettingsFromDb(): Promise<FeeSettingRow[]> {
  const r = await query(
    `SELECT setting_key, setting_value
     FROM admin_settings
     WHERE setting_category = $1
       AND (
         setting_key IN (${GLOBAL_KEYS_SQL})
         OR setting_key LIKE 'fee_override_%'
       )`,
    [FEE_SETTINGS_CATEGORY]
  ).catch((err) => {
    console.error('[fee-settings-db] listFeeSettingsFromDb query failed:', err);
    return { rows: [] as FeeSettingRow[] };
  });
  return (r.rows || []) as FeeSettingRow[];
}

/** Non-override keys only → scalar strings (for pharmacy / meal legacy readers). */
export async function getFeeGlobalsMap(): Promise<Record<string, string>> {
  const rows = await listFeeSettingsFromDb();
  const m: Record<string, string> = {};
  for (const r of rows) {
    if (r.setting_key.startsWith('fee_override_')) continue;
    m[r.setting_key] = scalarFromJsonbSetting(r.setting_value);
  }
  return m;
}

/**
 * Upsert one fee row (JSONB value).
 */
export async function upsertFeeSetting(
  settingKey: string,
  value: unknown,
  description?: string | null
): Promise<void> {
  const jsonPayload = JSON.stringify(value);
  await query(
    `INSERT INTO admin_settings (setting_category, setting_key, setting_value, description, created_at, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, NOW(), NOW())
     ON CONFLICT (setting_category, setting_key)
     DO UPDATE SET
       setting_value = EXCLUDED.setting_value,
       updated_at = NOW(),
       description = COALESCE(EXCLUDED.description, admin_settings.description)`,
    [FEE_SETTINGS_CATEGORY, settingKey, jsonPayload, description ?? null]
  );
}
