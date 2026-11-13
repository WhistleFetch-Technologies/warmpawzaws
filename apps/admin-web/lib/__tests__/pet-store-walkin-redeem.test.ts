import {
  ensureDraftWalkinCashbackRedeem,
  lockPetStoreWalkinCashbackRedeem,
  redeemNeedsWalkinLock,
} from '../promo-engine/pet-store-walkin-redeem';
import { createEmptyDraft, createEmptyVcf } from '../promo-engine/types';

const STORE_ID = 'cat-store';

describe('admin pet-store-walkin-redeem', () => {
  it('locks Anywhere cashback on Store publish to Store + paybill', () => {
    const vcf = createEmptyVcf();
    vcf.benefitMode = 'cashback';
    vcf.publish = { letter: 'C', categoryIds: [STORE_ID], categoryId: STORE_ID };
    vcf.redeem = {
      letter: 'F',
      channels: ['tele', 'appointment', 'paybill', 'ecommerce'],
    };
    const next = lockPetStoreWalkinCashbackRedeem({
      vcf: vcf as unknown as Record<string, unknown>,
      hasCashback: true,
      storeCategoryIds: [STORE_ID],
    });
    expect(next.redeem).toEqual({
      letter: 'C',
      categoryIds: [STORE_ID],
      categoryId: STORE_ID,
      channels: ['paybill'],
    });
  });

  it('ensureDraftWalkinCashbackRedeem updates draft redeem', () => {
    const draft = createEmptyDraft('draft-walkin');
    draft.vcf = createEmptyVcf();
    draft.vcf.benefitMode = 'cashback';
    draft.vcf.publish = { letter: 'C', categoryIds: [STORE_ID], categoryId: STORE_ID };
    draft.benefitJson = [{ type: 'CASHBACK', mode: 'FIXED', value: 20, expiryDays: 30 }];
    expect(redeemNeedsWalkinLock(draft.vcf.redeem)).toBe(true);
    const next = ensureDraftWalkinCashbackRedeem(draft, [STORE_ID]);
    expect(next.vcf?.redeem).toMatchObject({
      letter: 'C',
      categoryId: STORE_ID,
      channels: ['paybill'],
    });
  });
});
