import type { IWpayConvenienceSettingsRepository } from '../../../repositories/interfaces/IWpayConvenienceSettingsRepository';
import { wpayConvenienceSettingsRepository } from '../../../repositories/wpay-convenience-settings.repository';
import type { UpdateConvenienceSettingsRequest } from '../dto/convenience.requests';
import type { ConvenienceSettingsDTO } from '../dto/convenience.responses';

export const WARMPAWZ_PAY_CONVENIENCE_LOG_PREFIX = '[warmpawz-pay-convenience]';

export class WpayConvenienceSettingsService {
  constructor(
    private readonly settingsRepository: IWpayConvenienceSettingsRepository = wpayConvenienceSettingsRepository,
  ) {}

  async getConvenienceSettings(): Promise<ConvenienceSettingsDTO> {
    return this.settingsRepository.getConvenienceSettings();
  }

  async putConvenienceSettings(input: UpdateConvenienceSettingsRequest): Promise<ConvenienceSettingsDTO> {
    return this.settingsRepository.putConvenienceSettings(input);
  }
}
