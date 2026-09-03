import { parseUpdateConvenienceSettingsRequest } from '../dto/convenience.requests';

describe('parseUpdateConvenienceSettingsRequest', () => {
  it('accepts non-negative fee and GST rates plus burnMode', () => {
    expect(
      parseUpdateConvenienceSettingsRequest({
        platformFee: 30,
        platformFeeGstRate: 18,
        convenienceFee: 20,
        convenienceGstRate: 18,
        platformGstRate: 18,
        burnMode: true,
      }),
    ).toEqual({
      platformFee: 30,
      platformFeeGstRate: 18,
      convenienceFee: 20,
      convenienceGstRate: 18,
      platformGstRate: 18,
      burnMode: true,
    });
  });

  it('rejects negative values', () => {
    expect(() =>
      parseUpdateConvenienceSettingsRequest({
        platformFee: 0,
        platformFeeGstRate: 18,
        convenienceFee: -1,
        convenienceGstRate: 18,
        platformGstRate: 18,
        burnMode: false,
      }),
    ).toThrow();
  });
});
