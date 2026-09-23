import { parseWalletRedeemQuery } from '../../vcf/parse-wallet-query';

describe('parseWalletRedeemQuery', () => {
  it('accepts a spend channel and vendor so V/C/F cashback can unlock', () => {
    expect(
      parseWalletRedeemQuery({
        serviceCategory: 'vet',
        channel: 'paybill',
        vendorId: 'v1',
      })
    ).toEqual({
      serviceCategory: 'vet',
      channel: 'paybill',
      vendorId: 'v1',
      categoryId: null,
      ecommerceCategoryId: null,
    });
  });

  it('drops an unknown channel so redeemAllows does not treat junk as spendable', () => {
    expect(parseWalletRedeemQuery({ channel: 'giftcard', serviceCategory: 'vet' }).channel).toBeNull();
  });
});
