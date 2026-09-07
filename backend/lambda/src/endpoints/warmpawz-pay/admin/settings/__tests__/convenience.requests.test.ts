import { parseUpdateConvenienceSettingsRequest } from '../dto/convenience.requests';

describe('parseUpdateConvenienceSettingsRequest', () => {
  it('accepts non-negative fee and GST rates plus burnMode and fee modes', () => {
    expect(
      parseUpdateConvenienceSettingsRequest({
        platformFee: 30,
        platformFeeMode: 'fixed',
        platformFeeGstRate: 18,
        convenienceFee: 20,
        convenienceFeeMode: 'percent',
        convenienceGstRate: 18,
        platformGstRate: 18,
        burnMode: true,
      }),
    ).toEqual({
      platformFee: 30,
      platformFeeMode: 'fixed',
      platformFeeGstRate: 18,
      convenienceFee: 20,
      convenienceFeeMode: 'percent',
      convenienceGstRate: 18,
      platformGstRate: 18,
      burnMode: true,
    });
  });

  it('rejects negative values', () => {
    expect(() =>
      parseUpdateConvenienceSettingsRequest({
        platformFee: 0,
        platformFeeMode: 'fixed',
        platformFeeGstRate: 18,
        convenienceFee: -1,
        convenienceFeeMode: 'fixed',
        convenienceGstRate: 18,
        platformGstRate: 18,
        burnMode: false,
      }),
    ).toThrow();
  });

  it('rejects invalid fee modes', () => {
    expect(() =>
      parseUpdateConvenienceSettingsRequest({
        platformFee: 1,
        platformFeeMode: 'share',
        platformFeeGstRate: 18,
        convenienceFee: 1,
        convenienceFeeMode: 'fixed',
        convenienceGstRate: 18,
        platformGstRate: 18,
        burnMode: false,
      }),
    ).toThrow();
  });
});
