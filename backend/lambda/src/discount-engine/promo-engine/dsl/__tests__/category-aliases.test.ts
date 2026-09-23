import {
  expandPromoCategoryAliases,
  normalizePromoCategory,
  persistIstDateTime,
  toDatetimeLocalIst,
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

describe('toDatetimeLocalIst', () => {
  it('converts UTC ISO Z so datetime-local can show the IST clock time', () => {
    expect(toDatetimeLocalIst('2026-09-17T11:59:00.000Z')).toBe('2026-09-17T17:29');
  });

  it('keeps an already-local picker value', () => {
    expect(toDatetimeLocalIst('2026-09-17T17:29')).toBe('2026-09-17T17:29');
  });

  it('round-trips persistIstDateTime through Date.toISOString()', () => {
    const persisted = persistIstDateTime('2026-09-17T17:29');
    expect(toDatetimeLocalIst(new Date(persisted as string).toISOString())).toBe('2026-09-17T17:29');
  });

  it('returns empty for blank input so a cleared picker does not invent a date', () => {
    expect(toDatetimeLocalIst('')).toBe('');
    expect(toDatetimeLocalIst(null)).toBe('');
  });
});
