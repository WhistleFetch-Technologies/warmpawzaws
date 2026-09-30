import {
  audienceScopeEntries,
  describeAudienceScope,
  inheritRedeemScopeFromAudience,
  mapRedeemFromAudience,
  normalizeScopeMulti,
  normalizeVcfAudience,
  syncRedeemAfterAudience,
  validateVcfAudience,
  validateVcfBenefits,
  withScopeList,
} from '../promo-engine/vcf';
import { createEmptyVcf } from '../promo-engine/types';

describe('validateVcfAudience', () => {
  it('accepts platform visit source and publish', () => {
    expect(validateVcfAudience(createEmptyVcf())).toEqual([]);
  });
  it('requires at least one vendor for V and one category for C', () => {
    const v = createEmptyVcf();
    v.visitSource.letter = 'V';
    expect(validateVcfAudience(v)).toContain('Visit source: pick at least one vendor');
    v.visitSource.letter = 'C';
    expect(validateVcfAudience(v)).toContain('Visit source: pick at least one category');
    v.publish = { letter: 'C', categoryIds: [] };
    expect(validateVcfAudience(v)).toContain('Publish: pick at least one category');
  });
  it('accepts category lists on visit source and publish', () => {
    const v = createEmptyVcf();
    v.visitSource = { letter: 'C', categoryIds: ['vet', 'groom'], width: 'general' };
    v.publish = { letter: 'C', categoryIds: ['vet', 'groom'] };
    expect(validateVcfAudience(v)).toEqual([]);
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

describe('audience scope lists', () => {
  it('reads a singular-only scope as a list of one', () => {
    expect(
      audienceScopeEntries({ letter: 'V', vendorId: 'a', vendorName: 'A' }, 'V')
    ).toEqual({ ids: ['a'], names: ['A'] });
    expect(audienceScopeEntries({ letter: 'F' }, 'V')).toEqual({ ids: [], names: [] });
  });

  it('normalizes lists, mirrors the first entry, and clears the other letter', () => {
    const next = normalizeScopeMulti({
      letter: 'C',
      categoryIds: ['vet', 'groom', 'vet'],
      categoryNames: ['Vet Care', 'Grooming', 'Vet Care'],
      vendorId: 'stale',
      vendorName: 'Stale',
    });
    expect(next).toMatchObject({
      categoryIds: ['vet', 'groom'],
      categoryNames: ['Vet Care', 'Grooming'],
      categoryId: 'vet',
      categoryName: 'Vet Care',
    });
    expect(next.vendorId).toBeUndefined();
    expect(next.vendorName).toBeUndefined();
  });

  it('clears every id for platform scope', () => {
    const next = normalizeScopeMulti({ letter: 'F', categoryIds: ['vet'], vendorId: 'a' });
    expect(next).toEqual({ letter: 'F' });
  });

  it('stamps pooled counting on visit source', () => {
    const v = createEmptyVcf();
    v.visitSource = { letter: 'C', categoryId: 'vet', width: 'general' };
    const next = normalizeVcfAudience(v);
    expect(next.visitSource).toMatchObject({ categoryIds: ['vet'], countMode: 'pooled' });
  });

  it('replaces a list with withScopeList and keeps names aligned', () => {
    const next = withScopeList({ letter: 'V' }, 'V', { ids: ['a', 'b'], names: ['A'] });
    expect(next).toMatchObject({
      vendorIds: ['a', 'b'],
      vendorNames: ['A', 'b'],
      vendorId: 'a',
      vendorName: 'A',
    });
  });

  it('describes scopes for review', () => {
    expect(
      describeAudienceScope({ letter: 'C', categoryIds: ['v', 'g'], categoryNames: ['Vet Care', 'Grooming'] })
    ).toBe('C (Vet Care, Grooming)');
    expect(describeAudienceScope({ letter: 'F' })).toBe('F');
  });

  it('seeds Same category redeem with the whole publish list', () => {
    const v = createEmptyVcf();
    v.publish = { letter: 'C', categoryIds: ['vet', 'groom'], categoryNames: ['Vet Care', 'Grooming'] };
    expect(mapRedeemFromAudience(v, 'C')).toMatchObject({
      letter: 'C',
      categoryIds: ['vet', 'groom'],
      categoryNames: ['Vet Care', 'Grooming'],
      categoryId: 'vet',
    });
  });

  it('inherits the whole visit-source vendor list for Same vendor', () => {
    const v = createEmptyVcf();
    v.visitSource = { letter: 'V', vendorIds: ['a', 'b'], vendorNames: ['A', 'B'], width: 'general' };
    expect(inheritRedeemScopeFromAudience(v, 'V')).toEqual({
      vendorId: 'a',
      vendorName: 'A',
      vendorIds: ['a', 'b'],
      vendorNames: ['A', 'B'],
    });
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
