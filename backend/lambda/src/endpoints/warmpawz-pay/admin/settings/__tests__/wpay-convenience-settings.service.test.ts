import type { IWpayConvenienceSettingsRepository } from '../../../repositories/interfaces/IWpayConvenienceSettingsRepository';
import { WpayConvenienceSettingsService } from '../services/wpay-convenience-settings.service';

describe('WpayConvenienceSettingsService', () => {
  it('returns global convenience settings from the wpay category', async () => {
    const repository: IWpayConvenienceSettingsRepository = {
      getConvenienceSettings: jest.fn().mockResolvedValue({
        convenienceFee: 20,
        convenienceGstRate: 18,
        platformGstRate: 18,
      }),
      putConvenienceSettings: jest.fn(),
    };

    const service = new WpayConvenienceSettingsService(repository);
    await expect(service.getConvenienceSettings()).resolves.toEqual({
      convenienceFee: 20,
      convenienceGstRate: 18,
      platformGstRate: 18,
    });
  });

  it('writes the same three fields back through the repository', async () => {
    const input = { convenienceFee: 25, convenienceGstRate: 18, platformGstRate: 18 };
    const repository: IWpayConvenienceSettingsRepository = {
      getConvenienceSettings: jest.fn(),
      putConvenienceSettings: jest.fn().mockResolvedValue(input),
    };

    const service = new WpayConvenienceSettingsService(repository);
    await expect(service.putConvenienceSettings(input)).resolves.toEqual(input);
    expect(repository.putConvenienceSettings).toHaveBeenCalledWith(input);
  });
});
