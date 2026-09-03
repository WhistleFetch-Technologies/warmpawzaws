import type { IWpayConvenienceSettingsRepository } from '../../../repositories/interfaces/IWpayConvenienceSettingsRepository';
import { WpayConvenienceSettingsService } from '../services/wpay-convenience-settings.service';

const sample = {
  platformFee: 30,
  platformFeeGstRate: 18,
  convenienceFee: 20,
  convenienceGstRate: 18,
  platformGstRate: 18,
};

describe('WpayConvenienceSettingsService', () => {
  it('returns global fee settings from the wpay category', async () => {
    const repository: IWpayConvenienceSettingsRepository = {
      getConvenienceSettings: jest.fn().mockResolvedValue(sample),
      putConvenienceSettings: jest.fn(),
    };

    const service = new WpayConvenienceSettingsService(repository);
    await expect(service.getConvenienceSettings()).resolves.toEqual(sample);
  });

  it('writes all fee fields back through the repository', async () => {
    const input = { ...sample, convenienceFee: 25 };
    const repository: IWpayConvenienceSettingsRepository = {
      getConvenienceSettings: jest.fn(),
      putConvenienceSettings: jest.fn().mockResolvedValue(input),
    };

    const service = new WpayConvenienceSettingsService(repository);
    await expect(service.putConvenienceSettings(input)).resolves.toEqual(input);
    expect(repository.putConvenienceSettings).toHaveBeenCalledWith(input);
  });
});
