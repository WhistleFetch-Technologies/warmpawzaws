import {
  ALL_VALID_BLOOD_TYPE_KEYS,
  isBloodTypeKeyForSpecies,
  isValidBloodTypeKey,
  normalizeBloodTypeForStorage,
  resolveBloodTypeFromPayload,
  sanitizeBloodTypeInput,
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

describe('pet-blood-types backend mirror', () => {
  it('matches the canonical frontend key set', () => {
    expect([...ALL_VALID_BLOOD_TYPE_KEYS].sort()).toEqual([...CANONICAL_KEYS].sort());
  });

  it('validates known keys and species prefixes', () => {
    expect(isValidBloodTypeKey('dog:dea3')).toBe(true);
    expect(isValidBloodTypeKey('horse:dea1')).toBe(false);
    expect(isBloodTypeKeyForSpecies('cat:type_b', 'Cat')).toBe(true);
    expect(isBloodTypeKeyForSpecies('cat:type_b', 'Dog')).toBe(false);
  });

  it('sanitizes storage values', () => {
    expect(normalizeBloodTypeForStorage('dog:dea1_positive', 'Dog')).toBe('dog:dea1_positive');
    expect(normalizeBloodTypeForStorage('dog:dea1_positive', 'Cat')).toBeUndefined();
    expect(normalizeBloodTypeForStorage('invalid', 'Dog')).toBeUndefined();
  });

  it('rejects invalid write payloads', () => {
    expect(sanitizeBloodTypeInput('dog:dea4', 'dog')).toEqual({ ok: true, value: 'dog:dea4' });
    expect(sanitizeBloodTypeInput('dog:dea4', 'cat')).toEqual({
      ok: false,
      error: 'Invalid blood type for this pet species',
    });
    expect(sanitizeBloodTypeInput('bogus', 'Dog')).toEqual({
      ok: false,
      error: 'Invalid blood type for this pet species',
    });
    expect(sanitizeBloodTypeInput('', 'Dog')).toEqual({ ok: true, value: undefined });
  });

  it('resolves blood type from nested payload fields', () => {
    expect(
      resolveBloodTypeFromPayload(
        {
          type: 'Dog',
          medicalHistory: { bloodType: 'dog:unknown' },
        },
        'Dog'
      )
    ).toEqual({ ok: true, value: 'dog:unknown' });

    expect(
      resolveBloodTypeFromPayload(
        {
          type: 'Cat',
          healthRecords: { bloodType: 'dog:dea1_positive' },
        },
        'Cat'
      )
    ).toEqual({
      ok: false,
      error: 'Invalid blood type for this pet species',
    });
  });
});
