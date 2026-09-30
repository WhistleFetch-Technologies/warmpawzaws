import { matchesPublish, parseVcfConfig, publishScopeSize, scopeIds } from '../parse-config';
import { visitCountForPromo } from '../visit-count';
import { rankEligible } from '../rank-eligible';
import { emptyChannelCells, emptyVisitProfile, type RankedPromo } from '../types';

function baseVcf(overrides: Record<string, unknown>) {
  return {
    vcf: {
      visitSource: { letter: 'F', width: 'general' },
      visitLoop: { kind: 'visit_number', n: 1 },
      benefitMode: 'discount',
      publish: { letter: 'F' },
      ...overrides,
    },
  };
}

describe('parseVcfConfig multi scope', () => {
  it('merges the singular id into the list without duplicates', () => {
    const vcf = parseVcfConfig(
      baseVcf({
        visitSource: { letter: 'C', categoryId: 'vet', categoryIds: ['vet', 'groom', 'train'], width: 'general' },
        publish: { letter: 'C', categoryIds: ['groom', 'train'], categoryId: 'vet' },
      })
    );
    expect(vcf?.visitSource.categoryIds).toEqual(['vet', 'groom', 'train']);
    expect(vcf?.visitSource.categoryId).toBe('vet');
    expect(vcf?.visitSource.countMode).toBe('pooled');
    expect(vcf?.publish.categoryIds).toEqual(['groom', 'train', 'vet']);
    expect(vcf?.publish.categoryId).toBe('groom');
  });

  it('reads an older singular-only row as a list of one', () => {
    const vcf = parseVcfConfig(baseVcf({ publish: { letter: 'V', vendorId: 'clinic-1' } }));
    expect(vcf?.publish.vendorIds).toEqual(['clinic-1']);
    expect(scopeIds(vcf!.publish)).toEqual(['clinic-1']);
  });

  it('rejects V/C publish with an empty list', () => {
    expect(parseVcfConfig(baseVcf({ publish: { letter: 'C', categoryIds: [] } }))).toBeNull();
    expect(parseVcfConfig(baseVcf({ publish: { letter: 'V', vendorIds: [''] } }))).toBeNull();
  });

  it('drops ids that do not belong to the letter', () => {
    const vcf = parseVcfConfig(
      baseVcf({ publish: { letter: 'C', categoryIds: ['vet'], vendorId: 'stale', vendorIds: ['stale'] } })
    );
    expect(vcf?.publish.vendorId).toBeUndefined();
    expect(vcf?.publish.vendorIds).toBeUndefined();
  });

  it('inherits the whole publish list into Same category redeem', () => {
    const vcf = parseVcfConfig(
      baseVcf({
        benefitMode: 'cashback',
        publish: { letter: 'C', categoryIds: ['vet', 'groom'] },
        redeem: { letter: 'C', channels: ['paybill'] },
      })
    );
    expect(vcf?.redeem?.categoryIds).toEqual(['vet', 'groom']);
    expect(vcf?.redeem?.categoryId).toBe('vet');
  });

  it('inherits the whole visit-source vendor list when publish is platform', () => {
    const vcf = parseVcfConfig(
      baseVcf({
        benefitMode: 'cashback',
        visitSource: { letter: 'V', vendorIds: ['a', 'b'], width: 'general' },
        redeem: { letter: 'V', channels: ['paybill'] },
      })
    );
    expect(vcf?.redeem?.vendorIds).toEqual(['a', 'b']);
  });
});

describe('matchesPublish with lists', () => {
  it('matches any listed category and nothing else', () => {
    const publish = { letter: 'C' as const, categoryIds: ['vet', 'groom', 'train'] };
    expect(matchesPublish(publish, { categoryId: 'train' })).toBe(true);
    expect(matchesPublish(publish, { categoryId: 'vet' })).toBe(true);
    expect(matchesPublish(publish, { categoryId: 'boarding' })).toBe(false);
    expect(matchesPublish(publish, { categoryId: null })).toBe(false);
  });

  it('matches any listed vendor and ignores category', () => {
    const publish = { letter: 'V' as const, vendorIds: ['a', 'b'] };
    expect(matchesPublish(publish, { vendorId: 'b', categoryId: 'x' })).toBe(true);
    expect(matchesPublish(publish, { vendorId: 'c', categoryId: 'x' })).toBe(false);
  });

  it('keeps singular-only publish working', () => {
    expect(matchesPublish({ letter: 'V', vendorId: 'a' }, { vendorId: 'a' })).toBe(true);
  });

  it('reports list size for ranking; platform has none', () => {
    expect(publishScopeSize({ letter: 'C', categoryIds: ['a', 'b', 'a'] })).toBe(2);
    expect(publishScopeSize({ letter: 'F' })).toBeUndefined();
  });
});

describe('pooled visit count', () => {
  const profile = emptyVisitProfile();
  profile.categories.vet = emptyChannelCells();
  profile.categories.groom = { ...emptyChannelCells(), appointment: { count: 2, lastAt: null } };
  profile.categories.train = { ...emptyChannelCells(), paybill: { count: 1, lastAt: null } };
  profile.categories.boarding = { ...emptyChannelCells(), appointment: { count: 5, lastAt: null } };
  profile.vendors.a = { categoryId: 'vet', roleId: 'r', ...emptyChannelCells(), tele: { count: 1, lastAt: null } };
  profile.vendors.b = { categoryId: 'vet', roleId: 'r', ...emptyChannelCells(), paybill: { count: 2, lastAt: null } };

  it('sums visits across every listed category and ignores the rest', () => {
    expect(
      visitCountForPromo(profile, {
        letter: 'C',
        categoryIds: ['vet', 'groom', 'train'],
        width: 'general',
      })
    ).toBe(3);
  });

  it('counts a duplicate id once', () => {
    expect(
      visitCountForPromo(profile, {
        letter: 'C',
        categoryId: 'groom',
        categoryIds: ['groom', 'groom'],
        width: 'general',
      })
    ).toBe(2);
  });

  it('respects specific channels across the pool', () => {
    expect(
      visitCountForPromo(profile, {
        letter: 'C',
        categoryIds: ['groom', 'train'],
        width: 'specific',
        channels: ['paybill'],
      })
    ).toBe(1);
  });

  it('pools vendor lists too', () => {
    expect(visitCountForPromo(profile, { letter: 'V', vendorIds: ['a', 'b'], width: 'general' })).toBe(3);
  });
});

describe('ranking with publish lists', () => {
  const row = (id: string, letter: RankedPromo['publishLetter'], size?: number, priority = 0): RankedPromo => ({
    promotionId: id,
    publishLetter: letter,
    publishScopeSize: size,
    priority,
    updatedAt: '2026-09-01',
    discount: 10,
    cashback: 0,
  });

  it('lets the smaller list win within the same letter, even over higher priority', () => {
    const { winner, fallbacks } = rankEligible([row('group', 'C', 3, 99), row('training', 'C', 1, 0)]);
    expect(winner?.promotionId).toBe('training');
    expect(fallbacks).toEqual([{ promotionId: 'group', reason: 'LOST_TO_MORE_SPECIFIC' }]);
  });

  it('still ranks the letter above list size', () => {
    const { winner } = rankEligible([row('cat', 'C', 1), row('vendors', 'V', 50)]);
    expect(winner?.promotionId).toBe('vendors');
  });

  it('falls back to priority when list sizes match', () => {
    const { winner, fallbacks } = rankEligible([row('low', 'C', 2, 1), row('high', 'C', 2, 5)]);
    expect(winner?.promotionId).toBe('high');
    expect(fallbacks[0].reason).toBe('LOST_TO_PRIORITY');
  });

  it('treats a missing size as the widest', () => {
    const { winner } = rankEligible([row('legacy', 'C', undefined, 9), row('sized', 'C', 4, 0)]);
    expect(winner?.promotionId).toBe('sized');
  });
});
