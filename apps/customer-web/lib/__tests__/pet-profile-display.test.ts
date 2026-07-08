import { formatBloodType } from '../pet-profile-display';

describe('formatBloodType', () => {
  it('returns Not recorded for empty or invalid values', () => {
    expect(formatBloodType()).toBe('Not recorded');
    expect(formatBloodType('')).toBe('Not recorded');
    expect(formatBloodType('legacy-value', 'Dog')).toBe('Not recorded');
  });

  it('returns Not tested / Unknown for explicit unknown keys', () => {
    expect(formatBloodType('dog:unknown', 'Dog')).toBe('Not tested / Unknown');
    expect(formatBloodType('cat:unknown', 'Cat')).toBe('Not tested / Unknown');
  });

  it('returns the display label for valid keys', () => {
    expect(formatBloodType('dog:dea1_negative', 'Dog')).toBe('DEA 1 Negative');
    expect(formatBloodType('cat:type_a', 'Cat')).toBe('Type A');
  });
});
