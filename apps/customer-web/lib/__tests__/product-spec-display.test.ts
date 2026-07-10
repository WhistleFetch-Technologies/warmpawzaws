import {
  displayProductSpecValue,
  isMeaningfulProductSpecValue,
  meaningfulSpecEntries,
} from '../ecommerce/product-spec-display';

describe('isMeaningfulProductSpecValue', () => {
  it('returns false for null, undefined, empty, and placeholder strings', () => {
    expect(isMeaningfulProductSpecValue(null)).toBe(false);
    expect(isMeaningfulProductSpecValue(undefined)).toBe(false);
    expect(isMeaningfulProductSpecValue('')).toBe(false);
    expect(isMeaningfulProductSpecValue('   ')).toBe(false);
    expect(isMeaningfulProductSpecValue('null')).toBe(false);
    expect(isMeaningfulProductSpecValue('NULL')).toBe(false);
    expect(isMeaningfulProductSpecValue('undefined')).toBe(false);
    expect(isMeaningfulProductSpecValue(0)).toBe(false);
  });

  it('returns true for normal text and numbers', () => {
    expect(isMeaningfulProductSpecValue('Crunchy treats')).toBe(true);
    expect(isMeaningfulProductSpecValue('Petz')).toBe(true);
    expect(isMeaningfulProductSpecValue(2.5)).toBe(true);
  });
});

describe('displayProductSpecValue', () => {
  it('returns empty string for placeholder values', () => {
    expect(displayProductSpecValue('null')).toBe('');
    expect(displayProductSpecValue(null)).toBe('');
  });

  it('returns formatted text for meaningful values', () => {
    expect(displayProductSpecValue('Made in India')).toBe('Made in India');
    expect(displayProductSpecValue(42)).toBe('42');
  });
});

describe('meaningfulSpecEntries', () => {
  it('filters dimension keys and empty or placeholder values', () => {
    expect(
      meaningfulSpecEntries({
        length_cm: 10,
        Material: 'Cotton',
        key_features: 'null',
        color: '',
      }),
    ).toEqual([['Material', 'Cotton']]);
  });
});
