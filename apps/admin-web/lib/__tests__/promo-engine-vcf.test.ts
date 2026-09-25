import {
  mapRedeemFromAudience,
  syncRedeemAfterAudience,
  validateVcfAudience,
  validateVcfBenefits,
} from '../promo-engine/vcf';
import { createEmptyVcf } from '../promo-engine/types';

describe('validateVcfAudience', () => {
  it('accepts platform visit source and publish', () => {
    expect(validateVcfAudience(createEmptyVcf())).toEqual([]);
  });
  it('requires a vendor id for V and a category id for C', () => {
    const v = createEmptyVcf();
    v.visitSource.letter = 'V';
    expect(validateVcfAudience(v)).toContain('Visit source: pick a vendor');
    v.visitSource.letter = 'C';
    expect(validateVcfAudience(v)).toContain('Visit source: pick a category');
  });
  it('requires a channel when width is specific', () => {
    const v = createEmptyVcf();
    v.visitSource.width = 'specific';
    v.visitSource.channels = [];
    expect(validateVcfAudience(v)[0]).toMatch(/at least one/);
  });
});

describe('mapRedeemFromAudience', () => {
  it('copies publish vendor onto Same vendor redeem', () => {
    const v = createEmptyVcf();
    v.publish = { letter: 'V', vendorId: 'clinic-1', vendorName: 'Bindu Vet' };
    v.visitSource = { letter: 'V', vendorId: 'other', vendorName: 'Other', width: 'general' };
    expect(mapRedeemFromAudience(v, 'V')).toMatchObject({
      letter: 'V',
      vendorId: 'clinic-1',
      vendorName: 'Bindu Vet',
      vendorIds: ['clinic-1'],
    });
  });

  it('copies visit category when publish is not category', () => {
    const v = createEmptyVcf();
    v.visitSource = { letter: 'C', categoryId: 'cat-vet', categoryName: 'Vet Care', width: 'general' };
    v.publish = { letter: 'F' };
    expect(mapRedeemFromAudience(v, 'C')).toMatchObject({
      letter: 'C',
      categoryId: 'cat-vet',
      categoryName: 'Vet Care',
      categoryIds: ['cat-vet'],
    });
  });

  it('preserves multi-vendor redeem when Audience publish changes', () => {
    const v = createEmptyVcf();
    v.publish = { letter: 'V', vendorId: 'a', vendorName: 'A' };
    v.redeem = {
      letter: 'V',
      vendorId: 'a',
      vendorName: 'A',
      vendorIds: ['a', 'b'],
      vendorNames: ['A', 'B'],
      channels: ['paybill'],
    };
    const next = syncRedeemAfterAudience({
      ...v,
      publish: { letter: 'V', vendorId: 'z', vendorName: 'Z' },
    });
    expect(next.redeem?.vendorIds).toEqual(['a', 'b']);
    expect(next.redeem?.vendorId).toBe('a');
    expect(next.redeem?.channels).toEqual(['paybill']);
  });

  it('seeds from Audience when redeem vendor list is empty', () => {
    const v = createEmptyVcf();
    v.publish = { letter: 'V', vendorId: 'b', vendorName: 'B' };
    v.redeem = { letter: 'V', channels: ['paybill'] };
    const next = syncRedeemAfterAudience(v);
    expect(next.redeem?.vendorId).toBe('b');
    expect(next.redeem?.vendorIds).toEqual(['b']);
  });
});

describe('validateVcfBenefits', () => {
  it('requires max discount when both are on', () => {
    const v = createEmptyVcf();
    v.benefitMode = 'both';
    expect(validateVcfBenefits(v, true, true)).toContain(
      'Both requires a max discount greater than 0'
    );
  });

  it('accepts Same vendor after mapping from publish', () => {
    const v = createEmptyVcf();
    v.benefitMode = 'cashback';
    v.expiryDays = 30;
    v.publish = { letter: 'V', vendorId: 'clinic-1', vendorName: 'Bindu Vet' };
    v.redeem = mapRedeemFromAudience(v, 'V');
    expect(validateVcfBenefits(v, false, true)).toEqual([]);
  });
});
