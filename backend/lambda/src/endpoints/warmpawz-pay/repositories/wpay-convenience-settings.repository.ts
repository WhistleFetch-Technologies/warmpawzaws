import { query } from '../../../database/rds-connection';
import {
  WPAY_CONVENIENCE_DEFAULTS,
  WPAY_CONVENIENCE_FEE_KEY,
  WPAY_CONVENIENCE_GST_RATE_KEY,
  WPAY_PLATFORM_GST_RATE_KEY,
  WPAY_SETTINGS_CATEGORY,
} from '../constants/wpay-convenience-settings';
import type {
  IWpayConvenienceSettingsRepository,
  WpayConvenienceSettingsRow,
} from './interfaces/IWpayConvenienceSettingsRepository';
import type { VendorCatalogDbClient } from './vendor-catalog.repository';

const SETTING_KEYS = [
  WPAY_CONVENIENCE_FEE_KEY,
  WPAY_CONVENIENCE_GST_RATE_KEY,
  WPAY_PLATFORM_GST_RATE_KEY,
] as const;

function parseJsonbNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function mapSettings(
  rows: ReadonlyArray<{ setting_key: string; setting_value: unknown }>,
): WpayConvenienceSettingsRow {
  const byKey = new Map(rows.map((row) => [row.setting_key, row.setting_value]));
  return {
    convenienceFee: parseJsonbNumber(byKey.get(WPAY_CONVENIENCE_FEE_KEY), WPAY_CONVENIENCE_DEFAULTS.convenienceFee),
    convenienceGstRate: parseJsonbNumber(
      byKey.get(WPAY_CONVENIENCE_GST_RATE_KEY),
      WPAY_CONVENIENCE_DEFAULTS.convenienceGstRate,
    ),
    platformGstRate: parseJsonbNumber(
      byKey.get(WPAY_PLATFORM_GST_RATE_KEY),
      WPAY_CONVENIENCE_DEFAULTS.platformGstRate,
    ),
  };
}

export class WpayConvenienceSettingsRepository implements IWpayConvenienceSettingsRepository {
  constructor(private readonly db: VendorCatalogDbClient = { query }) {}

  async getConvenienceSettings(): Promise<WpayConvenienceSettingsRow> {
    const result = await this.db.query(
      `SELECT setting_key, setting_value
       FROM admin_settings
       WHERE setting_category = $1
         AND setting_key = ANY($2::text[])`,
      [WPAY_SETTINGS_CATEGORY, [...SETTING_KEYS]],
    );
    return mapSettings(result.rows as Array<{ setting_key: string; setting_value: unknown }>);
  }

  async putConvenienceSettings(input: WpayConvenienceSettingsRow): Promise<WpayConvenienceSettingsRow> {
    const pairs: ReadonlyArray<{ key: string; value: number }> = [
      { key: WPAY_CONVENIENCE_FEE_KEY, value: input.convenienceFee },
      { key: WPAY_CONVENIENCE_GST_RATE_KEY, value: input.convenienceGstRate },
      { key: WPAY_PLATFORM_GST_RATE_KEY, value: input.platformGstRate },
    ];

    for (const pair of pairs) {
      await this.db.query(
        `INSERT INTO admin_settings (setting_category, setting_key, setting_value, is_active, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, true, NOW(), NOW())
         ON CONFLICT (setting_category, setting_key)
         DO UPDATE SET
           setting_value = EXCLUDED.setting_value,
           is_active = true,
           updated_at = NOW()`,
        [WPAY_SETTINGS_CATEGORY, pair.key, JSON.stringify(pair.value)],
      );
    }

    return this.getConvenienceSettings();
  }
}

export const wpayConvenienceSettingsRepository = new WpayConvenienceSettingsRepository();
