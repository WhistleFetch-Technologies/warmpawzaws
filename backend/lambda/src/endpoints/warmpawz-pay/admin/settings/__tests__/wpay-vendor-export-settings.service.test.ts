import { WpayVendorExportSettingsService } from '../services/wpay-vendor-export-settings.service';

describe('WpayVendorExportSettingsService', () => {
  it('reads and writes only the vendor download flag', async () => {
    const repository = {
      getAllowVendorDataDownload: jest.fn().mockResolvedValue(false),
      putAllowVendorDataDownload: jest.fn().mockResolvedValue(true),
    };
    const service = new WpayVendorExportSettingsService(repository);

    await expect(service.getVendorExportSettings()).resolves.toEqual({
      allowDataDownload: false,
    });
    await expect(service.putVendorExportSettings({ allowDataDownload: true })).resolves.toEqual({
      allowDataDownload: true,
    });
    expect(repository.putAllowVendorDataDownload).toHaveBeenCalledWith(true);
  });
});
