import { query } from '../../../database/rds-connection';
import {
  WPAY_ALLOW_VENDOR_DATA_DOWNLOAD_KEY,
  WPAY_SETTINGS_CATEGORY,
} from '../constants/wpay-convenience-settings';
import type { VendorCatalogDbClient } from './vendor-catalog.repository';

function parseJsonbBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return fallback;
}

export interface IWpayVendorExportSettingsRepository {
  getAllowVendorDataDownload(): Promise<boolean>;
  putAllowVendorDataDownload(allowed: boolean): Promise<boolean>;
}

export class WpayVendorExportSettingsRepository implements IWpayVendorExportSettingsRepository {
  constructor(private readonly db: VendorCatalogDbClient = { query }) {}

  async getAllowVendorDataDownload(): Promise<boolean> {
    const result = await this.db.query(
      `SELECT setting_value
       FROM admin_settings
       WHERE setting_category = $1
         AND setting_key = $2
       LIMIT 1`,
      [WPAY_SETTINGS_CATEGORY, WPAY_ALLOW_VENDOR_DATA_DOWNLOAD_KEY],
    );
    const row = (result.rows as Array<{ setting_value?: unknown }>)[0];
    return parseJsonbBoolean(row?.setting_value, false);
  }

  async putAllowVendorDataDownload(allowed: boolean): Promise<boolean> {
    await this.db.query(
      `INSERT INTO admin_settings (setting_category, setting_key, setting_value, is_active, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, true, NOW(), NOW())
       ON CONFLICT (setting_category, setting_key)
       DO UPDATE SET
         setting_value = EXCLUDED.setting_value,
         is_active = true,
         updated_at = NOW()`,
      [WPAY_SETTINGS_CATEGORY, WPAY_ALLOW_VENDOR_DATA_DOWNLOAD_KEY, JSON.stringify(allowed)],
    );
    return this.getAllowVendorDataDownload();
  }
}

export const wpayVendorExportSettingsRepository = new WpayVendorExportSettingsRepository();
