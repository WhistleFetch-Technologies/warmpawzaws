import { select, upsert } from '../../database/rds-connection';
import type { CommerceConfiguration } from '../contracts/commerce-configuration';
import type { ConfigurationRepository } from '../contracts/configuration-provider';
import { COMMERCE_SWITCH_SETTING_KEY } from '../config/setting-keys';
import { parseCommerceConfiguration } from '../config/schema';

export class PlatformSettingsConfigurationRepository implements ConfigurationRepository {
  async getConfiguration(): Promise<CommerceConfiguration | null> {
    const rows = await select('platform_settings', { setting_key: COMMERCE_SWITCH_SETTING_KEY });
    if (!rows?.length) return null;
    const raw = rows[0]?.setting_value;
    if (raw == null) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parseCommerceConfiguration(parsed);
  }

  async saveConfiguration(config: CommerceConfiguration): Promise<CommerceConfiguration> {
    await upsert(
      'platform_settings',
      {
        setting_key: COMMERCE_SWITCH_SETTING_KEY,
        setting_value: config,
        setting_type: 'object',
        description: 'Platform Commerce Switch configuration (active commerce model)',
        is_public: false,
        updated_at: new Date(),
      },
      'setting_key'
    );
    return config;
  }
}
