import {
  extractHealthRecordsForClient,
  extractVaccinationsForClient,
  flatMapFromVaccinationEntries,
  mapVaccineLabelToSlot,
} from '../pet-health-normalize';

describe('mapVaccineLabelToSlot', () => {
  it('maps DHPP to distemper slot', () => {
    expect(mapVaccineLabelToSlot('DHPP Vaccine')).toBe('distemper');
  });

  it('maps rabies and parvo labels', () => {
    expect(mapVaccineLabelToSlot('Rabies Vaccine')).toBe('rabies');
    expect(mapVaccineLabelToSlot('Parvovirus')).toBe('parvovirus');
  });
});

describe('flatMapFromVaccinationEntries', () => {
  it('flattens Add Pet wizard array', () => {
    const flat = flatMapFromVaccinationEntries([
      { name: 'Rabies Vaccine', date: '2025-01-15' },
      { name: 'DHPP Vaccine', date: '2025-02-20' },
    ]);
    expect(flat.rabies).toBe('2025-01-15');
    expect(flat.distemper).toBe('2025-02-20');
  });
});

describe('extractVaccinationsForClient', () => {
  it('reads medical_history.vaccinations array from Add Pet POST', () => {
    const result = extractVaccinationsForClient({
      medical_history: {
        vaccinations: [
          { name: 'Rabies Vaccine', date: '2025-03-01' },
          { name: 'DHPP Vaccine', date: '2025-04-10' },
        ],
      },
    });
    expect(result.rabies).toBe('2025-03-01');
    expect(result.distemper).toBe('2025-04-10');
  });
});

describe('extractHealthRecordsForClient', () => {
  it('joins allergy arrays and drops literal none', () => {
    expect(
      extractHealthRecordsForClient({ allergies: ['chicken', 'pollen'] }).allergies
    ).toBe('chicken, pollen');
    expect(extractHealthRecordsForClient({ allergies: ['None'] }).allergies).toBe('');
  });
});
