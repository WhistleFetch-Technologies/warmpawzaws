import {
  buildPetLoyaltyResponseFields,
  buildSinglePetCreateLoyaltyFields,
  buildSinglePetUpdateLoyaltyFields,
  createEmptyPetLoyaltyBatchState,
  recordPetInsertLoyalty,
  recordPetUpdateLoyalty,
} from '../pet-loyalty-response';

const completePet = {
  name: 'Bruno',
  species: 'dog',
  breed: 'Indie',
  gender: 'male',
  profile_photo_url: 'https://example.com/bruno.jpg',
  medical_history: { dob: '2022-01-15' },
};

const incompletePet = {
  name: 'Bruno',
  species: 'dog',
  breed: null,
  gender: 'male',
  profile_photo_url: null,
  medical_history: {},
};

describe('pet-loyalty-response', () => {
  it('records create + vaccination on complete insert with vaccination payload', () => {
    const fields = buildSinglePetCreateLoyaltyFields(
      'cust-1',
      'pet-1',
      {
        ...completePet,
        medical_history: {
          dob: '2022-01-15',
          vaccinations: [{ name: 'Rabies', date: '2024-01-01' }],
        },
      },
      { vaccinations: [{ name: 'Rabies', date: '2024-01-01' }] }
    );
    expect(fields.petCreated).toBe(true);
    expect(fields.petProfileCompleted).toBe(true);
    expect(fields.vaccinationUpdated).toBe(true);
    expect(fields.loyaltyEligibleCreates).toEqual([{ petId: 'pet-1' }]);
    expect(fields.loyaltyEligibleVaccinationUpdates).toEqual([{ petId: 'pet-1' }]);
  });

  it('does not award profile points on incomplete onboarding create', () => {
    const fields = buildSinglePetCreateLoyaltyFields(
      'cust-1',
      'pet-2',
      { name: 'Buddy', species: 'dog' },
      { name: 'Buddy', onboardingRelaxed: true }
    );
    expect(fields.petCreated).toBe(true);
    expect(fields.petProfileCompleted).toBe(false);
    expect(fields.vaccinationUpdated).toBe(false);
    expect(fields.loyaltyEligibleCreates).toHaveLength(0);
    expect(fields.loyaltyEligibleVaccinationUpdates).toHaveLength(0);
  });

  it('does not record vaccination when update snapshot unchanged', () => {
    const before = {
      ...completePet,
      medical_history: { dob: '2022-01-15', vaccinations: [{ name: 'Rabies', date: '2024-01-01' }] },
    };
    const after = {
      ...completePet,
      medical_history: { dob: '2022-01-15', vaccinations: [{ name: 'Rabies', date: '2024-01-01' }] },
    };
    const fields = buildSinglePetUpdateLoyaltyFields(
      'cust-1',
      'pet-3',
      before,
      after,
      { vaccinations: [{ name: 'Rabies', date: '2024-01-01' }] }
    );
    expect(fields.petCreated).toBe(false);
    expect(fields.petProfileCompleted).toBe(false);
    expect(fields.vaccinationUpdated).toBe(false);
  });

  it('batch state awards only complete creates', () => {
    const state = createEmptyPetLoyaltyBatchState();
    recordPetInsertLoyalty(state, 'p1', { name: 'A', species: 'dog' }, { name: 'A' });
    recordPetInsertLoyalty(
      state,
      'p2',
      {
        ...completePet,
        medical_history: {
          dob: '2022-01-15',
          vaccinations: [{ name: 'DHPP', date: '2024-02-01' }],
        },
      },
      { vaccinations: [{ name: 'DHPP', date: '2024-02-01' }] }
    );
    const fields = buildPetLoyaltyResponseFields(state, 'cust-1');
    expect(fields.petCreated).toBe(true);
    expect(fields.petProfileCompleted).toBe(true);
    expect(fields.loyaltyEligibleCreates).toEqual([{ petId: 'p2' }]);
    expect(fields.loyaltyEligibleVaccinationUpdates).toHaveLength(1);
  });

  it('awards profile points once when update completes the profile', () => {
    const after = { ...completePet };
    const fields = buildSinglePetUpdateLoyaltyFields(
      'cust-1',
      'pet-4',
      incompletePet,
      after,
      { name: 'Bruno', breed: 'Indie' }
    );
    expect(fields.petProfileCompleted).toBe(true);
    expect(fields.loyaltyEligibleCreates).toEqual([{ petId: 'pet-4' }]);
    expect(fields.vaccinationUpdated).toBe(false);
  });

  it('does not re-award profile points on a later update of a complete pet', () => {
    const fields = buildSinglePetUpdateLoyaltyFields(
      'cust-1',
      'pet-5',
      completePet,
      { ...completePet, weight_kg: 12 },
      { weight: 12 }
    );
    expect(fields.petProfileCompleted).toBe(false);
    expect(fields.loyaltyEligibleCreates).toHaveLength(0);
  });

  it('records vaccination-only update without profile award', () => {
    const before = { ...completePet, medical_history: { dob: '2022-01-15', vaccinations: [] } };
    const after = {
      ...completePet,
      medical_history: { dob: '2022-01-15', vaccinations: [{ name: 'Rabies', date: '2024-03-01' }] },
    };
    const fields = buildSinglePetUpdateLoyaltyFields(
      'cust-1',
      'pet-6',
      before,
      after,
      { vaccinations: [{ name: 'Rabies', date: '2024-03-01' }] }
    );
    expect(fields.petProfileCompleted).toBe(false);
    expect(fields.loyaltyEligibleCreates).toHaveLength(0);
    expect(fields.vaccinationUpdated).toBe(true);
    expect(fields.loyaltyEligibleVaccinationUpdates).toEqual([{ petId: 'pet-6' }]);
  });
});
