import {
  isPetStoreWalkinPromoAudience,
  lockPetStoreWalkinCashbackRedeem,
  lockRedeemScopeWhenEarnedAtWalkinStore,
  payloadHasCashbackBenefit,
  redeemNeedsWalkinLock,
} from '../pet-store-walkin-redeem';

const STORE_ID = 'cat-store';

describe('pet-store-walkin-redeem', () => {
  it('treats Anywhere and empty Same category as needing a lock', () => {
    expect(redeemNeedsWalkinLock({ letter: 'F', channels: ['paybill'] })).toBe(true);
    expect(redeemNeedsWalkinLock({ letter: 'C', channels: ['paybill'] })).toBe(true);
    expect(
      redeemNeedsWalkinLock({ letter: 'C', categoryId: STORE_ID, channels: ['paybill'] })
    ).toBe(false);
  });

  it('detects walk-in audience from publish Store category', () => {
    expect(
      isPetStoreWalkinPromoAudience({
        vcf: {
          publish: { letter: 'C', categoryIds: [STORE_ID] },
          visitSource: { letter: 'F' },
        },
        storeCategoryIds: [STORE_ID],
      })
    ).toBe(true);
    expect(
      isPetStoreWalkinPromoAudience({
        vcf: {
          publish: { letter: 'C', categoryIds: ['cat-vet'] },
          visitSource: { letter: 'F' },
        },
        storeCategoryIds: [STORE_ID],
      })
    ).toBe(false);
  });

  it('locks Anywhere cashback redeem to Store + paybill', () => {
    const next = lockPetStoreWalkinCashbackRedeem({
      hasCashback: true,
      storeCategoryIds: [STORE_ID],
      vcf: {
        benefitMode: 'cashback',
        publish: { letter: 'C', categoryIds: [STORE_ID], categoryId: STORE_ID },
        visitSource: { letter: 'F', width: 'general' },
        redeem: { letter: 'F', channels: ['tele', 'appointment', 'paybill', 'ecommerce'] },
      },
    });
    expect(next.redeem).toEqual({
      letter: 'C',
      categoryIds: [STORE_ID],
      categoryId: STORE_ID,
      channels: ['paybill'],
    });
  });

  it('locks walk-in vendor publish to Same vendor + paybill', () => {
    const next = lockPetStoreWalkinCashbackRedeem({
      hasCashback: true,
      storeCategoryIds: [STORE_ID],
      publishVendorsAreWalkin: true,
      vcf: {
        benefitMode: 'both',
        publish: { letter: 'V', vendorIds: ['v1', 'v2'], vendorId: 'v1' },
        visitSource: { letter: 'F', width: 'general' },
        redeem: { letter: 'F', channels: ['paybill', 'ecommerce'] },
      },
    });
    expect(next.redeem).toEqual({
      letter: 'V',
      vendorIds: ['v1', 'v2'],
      vendorId: 'v1',
      channels: ['paybill'],
    });
  });

  it('does not override an intentional Same category redeem', () => {
    const redeem = {
      letter: 'C',
      categoryId: STORE_ID,
      categoryIds: [STORE_ID],
      channels: ['paybill', 'ecommerce'],
    };
    const next = lockPetStoreWalkinCashbackRedeem({
      hasCashback: true,
      storeCategoryIds: [STORE_ID],
      vcf: {
        publish: { letter: 'C', categoryIds: [STORE_ID] },
        visitSource: { letter: 'F' },
        redeem,
      },
    });
    expect(next.redeem).toEqual(redeem);
  });

  it('detects cashback from benefit mode and benefit rows', () => {
    expect(payloadHasCashbackBenefit({ benefitMode: 'cashback' })).toBe(true);
    expect(
      payloadHasCashbackBenefit({
        benefitJson: [{ type: 'CASHBACK', value: 50 }],
      })
    ).toBe(true);
    expect(
      payloadHasCashbackBenefit({
        benefitJson: [{ type: 'DISCOUNT', value: 50 }],
      })
    ).toBe(false);
  });

  it('locks cashback earned at a walk-in Store to that same vendor only', () => {
    const locked = lockRedeemScopeWhenEarnedAtWalkinStore({
      redeemScope: {
        letter: 'F',
        channels: ['tele', 'appointment', 'paybill', 'ecommerce'],
      },
      storeCategoryIds: [STORE_ID],
      paymentVendorId: 'vendor-walkin-1',
      paymentCategoryId: STORE_ID,
      paymentRoleName: 'pet_store_walkin',
    });
    expect(locked).toEqual({
      letter: 'V',
      vendorId: 'vendor-walkin-1',
      vendorIds: ['vendor-walkin-1'],
      channels: ['paybill'],
    });
  });

  it('does not lock Anywhere cashback earned at a non-store vendor', () => {
    const redeem = { letter: 'F', channels: ['paybill'] };
    expect(
      lockRedeemScopeWhenEarnedAtWalkinStore({
        redeemScope: redeem,
        storeCategoryIds: [STORE_ID],
        paymentVendorId: 'vet-1',
        paymentCategoryId: 'cat-vet',
        paymentRoleName: 'vet_clinic',
      })
    ).toEqual(redeem);
  });
});
