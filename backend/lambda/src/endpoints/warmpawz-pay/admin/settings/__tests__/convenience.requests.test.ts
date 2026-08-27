import { parseUpdateConvenienceSettingsRequest } from '../dto/convenience.requests';

describe('parseUpdateConvenienceSettingsRequest', () => {
  it('accepts non-negative convenience and GST rates', () => {
    expect(
      parseUpdateConvenienceSettingsRequest({
        convenienceFee: 20,
        convenienceGstRate: 18,
        platformGstRate: 18,
      }),
    ).toEqual({
      convenienceFee: 20,
      convenienceGstRate: 18,
      platformGstRate: 18,
    });
  });

  it('rejects negative values', () => {
    expect(() =>
      parseUpdateConvenienceSettingsRequest({
        convenienceFee: -1,
        convenienceGstRate: 18,
        platformGstRate: 18,
      }),
    ).toThrow();
  });
});
