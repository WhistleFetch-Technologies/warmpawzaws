import { flatMapFromVaccinationEntries, mapVaccineLabelToSlot } from '../vaccine-label-mapping';
import {
  extractVaccinationEntriesFromApi,
  normalizeVaccinationsFromApi,
} from '../pet-profile-display';
import { flushPendingListItem } from '../pet-form-helpers';

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

describe('extractVaccinationEntriesFromApi', () => {
  it('returns one row per wizard vaccine with dates', () => {
    const entries = extractVaccinationEntriesFromApi({
      medical_history: {
        vaccinations: [
          { name: 'Rabies Vaccine', date: '2025-06-03' },
          { name: 'DHPP Vaccine', date: '2025-07-01' },
          { name: 'Bordetella (Kennel Cough) Vaccine', date: '2025-05-01' },
          { name: 'Leptospirosis Vaccine', date: '2025-08-15' },
          { name: 'Canine Influenza Vaccine', date: '2025-09-01' },
        ],
      },
    });
    expect(entries).toHaveLength(5);
    expect(entries.map((e) => e.name)).toEqual([
      'Rabies Vaccine',
      'DHPP Vaccine',
      'Bordetella (Kennel Cough) Vaccine',
      'Leptospirosis Vaccine',
      'Canine Influenza Vaccine',
    ]);
    expect(entries[3].date).toBe('2025-08-15');
  });

  it('excludes entries without dates', () => {
    const entries = extractVaccinationEntriesFromApi({
      medical_history: {
        vaccinations: [
          { name: 'Rabies Vaccine', date: '2025-06-03' },
          { name: 'DHPP Vaccine', date: '' },
        ],
      },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Rabies Vaccine');
  });

  it('keeps multiple other-slot vaccines as separate rows', () => {
    const entries = extractVaccinationEntriesFromApi({
      medical_history: {
        vaccinations: [
          { name: 'Bordetella (Kennel Cough) Vaccine', date: '2025-05-01' },
          { name: 'Leptospirosis Vaccine', date: '2025-06-10' },
        ],
      },
    });
    expect(entries).toHaveLength(2);
    expect(entries[0].date).toBe('2025-05-01');
    expect(entries[1].date).toBe('2025-06-10');
  });
});

describe('flushPendingListItem', () => {
  it('appends pending text when not empty', () => {
    expect(flushPendingListItem([], 'chicken')).toEqual(['chicken']);
  });

  it('does not duplicate existing items', () => {
    expect(flushPendingListItem(['Chicken'], 'chicken')).toEqual(['Chicken']);
  });

  it('ignores blank pending text', () => {
    expect(flushPendingListItem(['pollen'], '  ')).toEqual(['pollen']);
  });
});
