import type { IWpayConvenienceSettingsRepository } from '../../../repositories/interfaces/IWpayConvenienceSettingsRepository';
import { WpayConvenienceSettingsService } from '../services/wpay-convenience-settings.service';

const sample = {
  platformFee: 30,
  platformFeeMode: 'fixed' as const,
  platformFeeGstRate: 18,
  convenienceFee: 20,
  convenienceFeeMode: 'fixed' as const,
  convenienceGstRate: 18,
  platformGstRate: 18,
  burnMode: false,
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

  it('writes platform fee fields and burnMode, always persisting convenience fee as 0', async () => {
    const input = { ...sample, convenienceFee: 25, convenienceFeeMode: 'percent' as const, burnMode: true };
    const persisted = { ...input, convenienceFee: 0, convenienceFeeMode: 'fixed' as const };
    const repository: IWpayConvenienceSettingsRepository = {
      getConvenienceSettings: jest.fn(),
      putConvenienceSettings: jest.fn().mockResolvedValue(persisted),
    };

    const service = new WpayConvenienceSettingsService(repository);
    await expect(service.putConvenienceSettings(input)).resolves.toEqual(persisted);
    expect(repository.putConvenienceSettings).toHaveBeenCalledWith(persisted);
  });

  it('accepts requests without legacy convenience fields', async () => {
    const repository: IWpayConvenienceSettingsRepository = {
      getConvenienceSettings: jest.fn(),
      putConvenienceSettings: jest.fn().mockImplementation(async (row) => row),
    };

    const service = new WpayConvenienceSettingsService(repository);
    const saved = await service.putConvenienceSettings({
      platformFee: 10,
      platformFeeMode: 'fixed',
      platformFeeGstRate: 18,
      platformGstRate: 18,
      burnMode: false,
    });
    expect(saved.convenienceFee).toBe(0);
    expect(saved.convenienceGstRate).toBe(18);
  });
});
