import {
  buildPetLoyaltyResponseFields,
  buildSinglePetCreateLoyaltyFields,
  buildSinglePetUpdateLoyaltyFields,
  createEmptyPetLoyaltyBatchState,
  recordPetInsertLoyalty,
  recordPetUpdateLoyalty,
} from '../pet-loyalty-response';

describe('pet-loyalty-response', () => {
  it('records create + vaccination on insert with vaccination payload', () => {
    const fields = buildSinglePetCreateLoyaltyFields('cust-1', 'pet-1', {
      vaccinations: [{ name: 'Rabies', date: '2024-01-01' }],
    });
    expect(fields.petCreated).toBe(true);
    expect(fields.vaccinationUpdated).toBe(true);
    expect(fields.loyaltyEligibleCreates).toEqual([{ petId: 'pet-1' }]);
    expect(fields.loyaltyEligibleVaccinationUpdates).toEqual([{ petId: 'pet-1' }]);
  });

  it('records create only when no vaccination in payload', () => {
    const fields = buildSinglePetCreateLoyaltyFields('cust-1', 'pet-2', {
      name: 'Buddy',
    });
    expect(fields.petCreated).toBe(true);
    expect(fields.vaccinationUpdated).toBe(false);
    expect(fields.loyaltyEligibleCreates).toHaveLength(1);
    expect(fields.loyaltyEligibleVaccinationUpdates).toHaveLength(0);
  });

  it('does not record vaccination when update snapshot unchanged', () => {
    const before = {
      medical_history: { vaccinations: [{ name: 'Rabies', date: '2024-01-01' }] },
    };
    const after = {
      medical_history: { vaccinations: [{ name: 'Rabies', date: '2024-01-01' }] },
    };
    const fields = buildSinglePetUpdateLoyaltyFields(
      'cust-1',
      'pet-3',
      before,
      after,
      { vaccinations: [{ name: 'Rabies', date: '2024-01-01' }] }
    );
    expect(fields.petCreated).toBe(false);
    expect(fields.vaccinationUpdated).toBe(false);
  });

  it('batch state accumulates multiple creates', () => {
    const state = createEmptyPetLoyaltyBatchState();
    recordPetInsertLoyalty(state, 'p1', { name: 'A' });
    recordPetInsertLoyalty(state, 'p2', {
      vaccinations: [{ name: 'DHPP', date: '2024-02-01' }],
    });
    const fields = buildPetLoyaltyResponseFields(state, 'cust-1');
    expect(fields.loyaltyEligibleCreates).toHaveLength(2);
    expect(fields.loyaltyEligibleVaccinationUpdates).toHaveLength(1);
    expect(fields.petCreated).toBe(true);
  });

  it('records meaningful vaccination update only once per change', () => {
    const state = createEmptyPetLoyaltyBatchState();
    const before = { medical_history: { vaccinations: [] } };
    const after = {
      medical_history: { vaccinations: [{ name: 'Rabies', date: '2024-03-01' }] },
    };
    recordPetUpdateLoyalty(state, 'pet-4', before, after, {
      vaccinations: [{ name: 'Rabies', date: '2024-03-01' }],
    });
    const fields = buildPetLoyaltyResponseFields(state, 'cust-1', 'pet-4');
    expect(fields.vaccinationUpdated).toBe(true);
    expect(fields.loyaltyEligibleVaccinationUpdates).toEqual([{ petId: 'pet-4' }]);
  });
});
