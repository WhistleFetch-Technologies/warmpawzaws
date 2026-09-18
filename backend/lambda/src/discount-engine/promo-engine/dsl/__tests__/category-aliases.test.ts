import {
  expandPromoCategoryAliases,
  normalizePromoCategory,
  persistIstDateTime,
} from '../category-aliases';

describe('normalizePromoCategory', () => {
  it('maps VET / vet / veterinary to veterinary', () => {
    expect(normalizePromoCategory('VET')).toBe('veterinary');
    expect(normalizePromoCategory('vet')).toBe('veterinary');
    expect(normalizePromoCategory('veterinary')).toBe('veterinary');
  });

  it('maps shop / ECOMMERCE to ecommerce', () => {
    expect(normalizePromoCategory('shop')).toBe('ecommerce');
    expect(normalizePromoCategory('ECOMMERCE')).toBe('ecommerce');
  });

  it('does not treat WPAY as a service category', () => {
    expect(normalizePromoCategory('WPAY')).toBe('');
    expect(normalizePromoCategory('wpay')).toBe('');
  });
});

describe('expandPromoCategoryAliases', () => {
  it('includes VET when matching a veterinary promo', () => {
    const aliases = expandPromoCategoryAliases('veterinary');
    expect(aliases).toEqual(expect.arrayContaining(['veterinary', 'vet', 'VET']));
  });
});

describe('persistIstDateTime', () => {
  it('appends +05:30 to datetime-local without timezone', () => {
    expect(persistIstDateTime('2026-09-17T17:29')).toBe('2026-09-17T17:29:00+05:30');
  });

  it('leaves an explicit offset unchanged', () => {
    expect(persistIstDateTime('2026-09-17T17:29:00+05:30')).toBe('2026-09-17T17:29:00+05:30');
  });
});
