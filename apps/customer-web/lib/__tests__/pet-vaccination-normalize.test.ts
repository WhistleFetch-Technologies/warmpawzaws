import { flatMapFromVaccinationEntries, mapVaccineLabelToSlot } from '../vaccine-label-mapping';
import { normalizeVaccinationsFromApi } from '../pet-profile-display';

describe('vaccine-label-mapping', () => {
  it('maps DHPP to distemper', () => {
    expect(mapVaccineLabelToSlot('DHPP Vaccine')).toBe('distemper');
  });
});

describe('normalizeVaccinationsFromApi', () => {
  it('parses medical_history.vaccinations array', () => {
    const v = normalizeVaccinationsFromApi({
      medical_history: {
        vaccinations: [
          { name: 'Rabies Vaccine', date: '2025-06-03' },
          { name: 'DHPP Vaccine', date: '2025-07-01' },
        ],
      },
    });
    expect(v.rabies).toBe('2025-06-03');
    expect(v.distemper).toBe('2025-07-01');
  });

  it('merges vaccination_records flat map with wizard array', () => {
    const v = normalizeVaccinationsFromApi({
      vaccination_records: { rabies: '2024-01-01' },
      medical_history: {
        vaccinations: [{ name: 'DHPP Vaccine', date: '2025-01-01' }],
      },
    });
    expect(v.rabies).toBe('2024-01-01');
    expect(v.distemper).toBe('2025-01-01');
  });
});

describe('flatMapFromVaccinationEntries', () => {
  it('handles Bordetella as other slot', () => {
    const flat = flatMapFromVaccinationEntries([
      { name: 'Bordetella (Kennel Cough) Vaccine', date: '2025-05-01' },
    ]);
    expect(flat.other).toBe('2025-05-01');
  });
});
