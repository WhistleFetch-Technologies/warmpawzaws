import { normalizeVaccinationDateToIso } from '../pet-profile-display';

describe('normalizeVaccinationDateToIso', () => {
  it('passes through ISO dates', () => {
    expect(normalizeVaccinationDateToIso('2025-06-03')).toBe('2025-06-03');
  });

  it('converts DD-MM-YYYY to ISO', () => {
    expect(normalizeVaccinationDateToIso('03-06-2025')).toBe('2025-06-03');
    expect(normalizeVaccinationDateToIso('02/06/2026')).toBe('2026-06-02');
  });

  it('returns undefined for empty input', () => {
    expect(normalizeVaccinationDateToIso('')).toBeUndefined();
    expect(normalizeVaccinationDateToIso(null)).toBeUndefined();
  });
});
