import { WpayConvenienceSettingsRepository } from '../wpay-convenience-settings.repository';

describe('WpayConvenienceSettingsRepository', () => {
  it('reads only admin_settings category wpay', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        { setting_key: 'wpay_platform_fee', setting_value: 30 },
        { setting_key: 'wpay_platform_fee_gst_rate', setting_value: 18 },
        { setting_key: 'wpay_convenience_fee', setting_value: 20 },
        { setting_key: 'wpay_convenience_gst_rate', setting_value: 18 },
        { setting_key: 'wpay_platform_gst_rate', setting_value: 18 },
      ],
    });
    const repo = new WpayConvenienceSettingsRepository({ query });

    await expect(repo.getConvenienceSettings()).resolves.toEqual({
      platformFee: 30,
      platformFeeGstRate: 18,
      convenienceFee: 20,
      convenienceGstRate: 18,
      platformGstRate: 18,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('setting_category = $1'),
      [
        'wpay',
        [
          'wpay_platform_fee',
          'wpay_platform_fee_gst_rate',
          'wpay_convenience_fee',
          'wpay_convenience_gst_rate',
          'wpay_platform_gst_rate',
        ],
      ],
    );
  });

  it('defaults missing wpay rows to 0 / 18', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repo = new WpayConvenienceSettingsRepository({ query });

    await expect(repo.getConvenienceSettings()).resolves.toEqual({
      platformFee: 0,
      platformFeeGstRate: 18,
      convenienceFee: 0,
      convenienceGstRate: 18,
      platformGstRate: 18,
    });
  });
});
