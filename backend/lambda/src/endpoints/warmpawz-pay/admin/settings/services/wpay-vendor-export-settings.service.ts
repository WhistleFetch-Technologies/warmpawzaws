import {
  wpayVendorExportSettingsRepository,
  type IWpayVendorExportSettingsRepository,
} from '../../../repositories/wpay-vendor-export-settings.repository';
import type { UpdateVendorExportSettingsRequest } from '../dto/vendor-export.requests';

export const WARMPAWZ_PAY_VENDOR_EXPORT_LOG_PREFIX = '[warmpawz-pay-vendor-export]';

export class WpayVendorExportSettingsService {
  constructor(
    private readonly settingsRepository: IWpayVendorExportSettingsRepository = wpayVendorExportSettingsRepository,
  ) {}

  async getVendorExportSettings(): Promise<{ allowDataDownload: boolean }> {
    return {
      allowDataDownload: await this.settingsRepository.getAllowVendorDataDownload(),
    };
  }

  async putVendorExportSettings(
    input: UpdateVendorExportSettingsRequest,
  ): Promise<{ allowDataDownload: boolean }> {
    return {
      allowDataDownload: await this.settingsRepository.putAllowVendorDataDownload(
        input.allowDataDownload,
      ),
    };
  }
}
