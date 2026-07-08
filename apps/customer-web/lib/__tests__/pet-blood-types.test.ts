import {
  getAllValidBloodTypeKeys,
  getBloodTypeDescription,
  getBloodTypeLabel,
  getBloodTypeOptions,
  isBloodTypeKeyForSpecies,
  normalizeBloodTypeKey,
} from '../pet-blood-types';

const CANONICAL_KEYS = [
  'dog:dea1_positive',
  'dog:dea1_negative',
  'dog:dea3',
  'dog:dea4',
  'dog:dea5',
  'dog:dea6',
  'dog:dea7',
  'dog:dea8',
  'dog:dal',
  'dog:kai1',
  'dog:kai2',
  'dog:unknown',
  'cat:type_a',
  'cat:type_b',
  'cat:type_ab',
  'cat:mik_positive',
  'cat:mik_negative',
  'cat:fea_other',
  'cat:unknown',
];

describe('pet-blood-types', () => {
  it('exposes the canonical stable key set', () => {
    expect(getAllValidBloodTypeKeys().sort()).toEqual([...CANONICAL_KEYS].sort());
  });

  it('returns species-specific options', () => {
    const dogKeys = getBloodTypeOptions('Dog').map((option) => option.key);
    const catKeys = getBloodTypeOptions('Cat').map((option) => option.key);

    expect(dogKeys).toContain('dog:dea1_positive');
    expect(dogKeys).not.toContain('cat:type_a');
    expect(catKeys).toContain('cat:type_b');
    expect(catKeys).not.toContain('dog:dea4');
  });

  it('maps labels and descriptions', () => {
    expect(getBloodTypeLabel('dog:dea1_positive')).toBe('DEA 1 Positive');
    expect(getBloodTypeDescription('cat:type_a')).toContain('Most common type globally');
  });

  it('normalizes valid keys and rejects invalid or mismatched species', () => {
    expect(normalizeBloodTypeKey('dog:dea4', 'Dog')).toBe('dog:dea4');
    expect(normalizeBloodTypeKey('dog:dea4', 'Cat')).toBeUndefined();
    expect(normalizeBloodTypeKey('legacy-label', 'Dog')).toBeUndefined();
    expect(normalizeBloodTypeKey('', 'Dog')).toBeUndefined();
  });

  it('checks species prefixes', () => {
    expect(isBloodTypeKeyForSpecies('cat:type_ab', 'Cat')).toBe(true);
    expect(isBloodTypeKeyForSpecies('cat:type_ab', 'Dog')).toBe(false);
  });

  it('marks unknown keys distinctly from empty values', () => {
    expect(normalizeBloodTypeKey('dog:unknown', 'Dog')).toBe('dog:unknown');
    expect(normalizeBloodTypeKey(undefined, 'Dog')).toBeUndefined();
  });
});
