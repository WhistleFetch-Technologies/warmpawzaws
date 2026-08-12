import {
  hasMeaningfulPetInput,
  validateRequiredPetFields,
} from '../pet-profile-validation';

const emptyWizard = {
  name: '',
  type: 'Dog',
  breed: '',
  dateOfBirth: '',
  gender: 'Male',
  photo: '',
};

describe('pet-profile-validation onboarding', () => {
  it('strict:false allows empty core fields', () => {
    expect(validateRequiredPetFields(emptyWizard, null, { strict: false })).toEqual({});
  });

  it('strict:false still validates invalid DOB format', () => {
    const errors = validateRequiredPetFields(
      { ...emptyWizard, dateOfBirth: 'not-a-date' },
      null,
      { strict: false },
    );
    expect(errors.dateOfBirth).toBeDefined();
  });

  it('strict:true requires photo and core fields', () => {
    const errors = validateRequiredPetFields(emptyWizard, null, { strict: true });
    expect(errors.photo).toBeDefined();
    expect(errors.name).toBeDefined();
    expect(errors.breed).toBeDefined();
  });

  it('hasMeaningfulPetInput is false for wizard defaults only', () => {
    expect(hasMeaningfulPetInput(emptyWizard, null)).toBe(false);
  });

  it('hasMeaningfulPetInput is true when name is provided', () => {
    expect(hasMeaningfulPetInput({ ...emptyWizard, name: 'Bruno' }, null)).toBe(true);
  });

  it('hasMeaningfulPetInput is true when vaccination date is provided', () => {
    expect(
      hasMeaningfulPetInput(
        {
          ...emptyWizard,
          vaccinations: [{ name: 'Rabies', lastDate: '2024-01-01' }],
        },
        null,
      ),
    ).toBe(true);
  });
});
